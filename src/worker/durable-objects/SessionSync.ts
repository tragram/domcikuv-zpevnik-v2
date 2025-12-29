import { DurableObject } from "cloudflare:workers";

interface Env {}

// Data we stick to the WebSocket handle
interface SocketMetadata {
  isMaster: boolean;
}

interface SessionSyncState {
  songId: string | null;
  transposeSteps: number | null;
}

export interface SyncMessage extends SessionSyncState {
  type: "sync";
}

export class SessionSync extends DurableObject<Env> {
  currentSongId: string | null = null;
  currentTransposeSteps: number | null = null;
  private masterWebSocket: WebSocket | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<SessionSyncState>("state");
      this.masterWebSocket =
        this.ctx
          .getWebSockets()
          .find((webSocket) => webSocket.deserializeAttachment().isMaster) ||
        null;
      this.currentSongId = stored?.songId || null;
      this.currentTransposeSteps = stored?.transposeSteps || null;
    });
  }

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Upgrade Required", { status: 426 });
    }

    const url = new URL(request.url);
    const roleParam = url.searchParams.get("role");

    // Backend has already verified authorization, so we trust the role parameter
    const isMaster = roleParam === "master";

    // If this is a master connection and we already have one, disconnect the old one FIRST
    if (isMaster && this.masterWebSocket) {
      const oldMaster = this.masterWebSocket;
      this.masterWebSocket = null;

      try {
        // Send a message to the old master informing them they're being replaced
        oldMaster.send(
          JSON.stringify({
            type: "master-replaced",
            message: "Another master has connected",
          })
        );

        // Close the old master connection
        oldMaster.close(1000, "New master connected");
      } catch (e) {
        console.error("Error closing previous master:", e);
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Attach the role to the socket BEFORE accepting it
    server.serializeAttachment({ isMaster });

    // Enable hibernation - accept the new socket
    this.ctx.acceptWebSocket(server);

    // Track the master WebSocket AFTER accepting it
    if (isMaster) {
      this.masterWebSocket = server;
    }

    // Initial Sync:
    // If you are a follower and master is connected, get the song.
    // If you are the master, get the last song you had (state recovery).
    server.send(
      JSON.stringify({
        type: "sync",
        songId: this.currentSongId,
        transposeSteps: this.currentTransposeSteps,
        isMaster,
      } as SyncMessage)
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message.toString());

    // Handle Ping - REPLY WITH PONG
    if (data.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }
    const meta = ws.deserializeAttachment() as SocketMetadata;

    // Only process messages from the current Master
    // Also verify this socket IS the current master socket
    if (!meta.isMaster || ws !== this.masterWebSocket) {
      return;
    }

    try {
      if (data.type === "update-song") {
        this.currentSongId = data.songId;
        this.currentTransposeSteps = data.transposeSteps;
        await this.ctx.storage.put("state", {
          songId: data.songId,
          transposeSteps: data.transposeSteps,
        } as SessionSyncState);

        // Broadcast to everyone
        this.broadcast({
          type: "sync",
          songId: this.currentSongId,
          transposeSteps: this.currentTransposeSteps,
        } as SyncMessage);
      }
    } catch (e) {
      console.error("WS Message Error:", e);
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean
  ) {
    const meta = ws.deserializeAttachment() as SocketMetadata;
    // If the master disconnects, clear our reference
    if (meta.isMaster && this.masterWebSocket === ws) {
      this.masterWebSocket = null;
    }
  }

  private broadcast(data: SyncMessage) {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch (e) {
        // Handle closed/stale sockets
      }
    }
  }
}
