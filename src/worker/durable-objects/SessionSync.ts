import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { syncSession } from "src/lib/db/schema";

interface Env {
  DB: D1Database;
}

// Data we stick to the WebSocket handle
interface SocketMetadata {
  isMaster: boolean;
  masterId: string;
}

export interface SessionSyncState {
  songId: string | null;
  transposeSteps: number | null;
  masterAvatar: string | null;
  masterNickname: string | null;
  masterId: string | null;
}

export interface SyncMessage extends SessionSyncState {
  type: "sync";
}

export interface PongMessage {
  type: "pong";
}

export interface UpdateOKMessage {
  type: "update-ok";
  connectedClients: number;
}

export interface MasterReplacedMessage {
  type: "master-replaced";
}

export type SesssionSyncWSMessage =
  | SyncMessage
  | PongMessage
  | UpdateOKMessage
  | MasterReplacedMessage;
export class SessionSync extends DurableObject<Env> {
  private masterWebSocket: WebSocket | null = null;
  private masterId: string | null = null;

  masterNickname: string | null = null;
  masterAvatar: string | null = null;
  currentTransposeSteps: number | null = null;
  currentSongId: string | null = null;

  private pendingDbWrite: {
    masterId: string;
    songId: string;
  } | null = null;

  // DB-related
  private readonly DB_WRITE_DEBOUNCE = 5000; // [ms]

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<SessionSyncState>("state");
      this.currentSongId = stored?.songId || null;
      this.currentTransposeSteps = stored?.transposeSteps || null;
      this.masterAvatar = stored?.masterAvatar || null;
      this.masterNickname = stored?.masterNickname || null;
      this.masterId = stored?.masterId || null;
      this.masterWebSocket =
        this.ctx
          .getWebSockets()
          .find((webSocket) => webSocket.deserializeAttachment().isMaster) ||
        null;

      // Restore pending write if exists
      this.pendingDbWrite =
        (await this.ctx.storage.get<{
          masterId: string;
          masterNickname: string;
          songId: string;
        }>("pendingDbWrite")) || null;
    });
  }

  async fetch(request: Request) {
    // Handle HTTP GET (The Snapshot)
    const isWS = request.headers.get("Upgrade") === "websocket";
    if (!isWS) {
      return new Response(
        JSON.stringify({
          songId: this.currentSongId,
          transposeSteps: this.currentTransposeSteps,
          masterNickname: this.masterNickname,
          masterAvatar: this.masterAvatar,
          masterId: this.masterId,
        } as SessionSyncState),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const url = new URL(request.url);
    const roleParam = url.searchParams.get("role");
    const masterNicknameParam = url.searchParams.get("masterNickname");
    const masterIdParam = url.searchParams.get("masterId");

    // Backend has already verified authorization, so we trust the role parameter
    const isMaster = roleParam === "master";

    // Store userId and masterId when master connects
    if (isMaster && masterNicknameParam && masterIdParam) {
      this.masterNickname = masterNicknameParam;
      this.masterId = masterIdParam;
    }
    const masterAvatarParam = url.searchParams.get("masterAvatar");
    if (masterAvatarParam) {
      this.masterAvatar = masterAvatarParam;
    }
    // If this is a master connection and we already have one, disconnect the old one
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

    server.serializeAttachment({
      isMaster,
    });

    // Enable hibernation - accept the new socket
    this.ctx.acceptWebSocket(server);

    if (isMaster) {
      this.masterWebSocket = server;
    }

    // initial sync
    server.send(
      JSON.stringify({
        type: "sync",
        songId: this.currentSongId,
        transposeSteps: this.currentTransposeSteps,
        masterAvatar: this.masterAvatar,
        masterNickname: this.masterNickname,
        masterId: this.masterId,
        isMaster,
      } as SyncMessage)
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = JSON.parse(message.toString());

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
        // Schedule debounced DB write using stored userId and masterId on new song
        if (
          this.masterNickname &&
          this.masterId &&
          data.songId &&
          data.songId !== this.currentSongId
        ) {
          await this.scheduleDbWrite({
            masterId: this.masterId,
            songId: data.songId,
          });
        }
        this.currentSongId = data.songId;
        this.currentTransposeSteps = data.transposeSteps;

        await this.ctx.storage.put("state", {
          songId: data.songId,
          transposeSteps: data.transposeSteps,
          masterAvatar: this.masterAvatar,
          masterNickname: this.masterNickname,
          masterId: this.masterId,
        } as SessionSyncState);

        // Broadcast to everyone
        this.broadcast({
          type: "sync",
          songId: this.currentSongId,
          transposeSteps: this.currentTransposeSteps,
          masterAvatar: this.masterAvatar,
          masterNickname: this.masterNickname,
          masterId: this.masterId,
        } as SyncMessage);

        this.masterWebSocket.send(
          JSON.stringify({
            type: "update-ok",
            connectedClients: this.ctx.getWebSockets().length - 1,
          })
        );
      }
    } catch (e) {
      console.error("WS Message Error:", e);
    }
  }

  private async scheduleDbWrite(data: {
    masterId: string;
    songId: string | null;
  }) {
    // debounced DB write to minimze rows written during randomize
    if (!data.songId) {
      return;
    }

    // Store pending write
    this.pendingDbWrite = {
      masterId: data.masterId,
      songId: data.songId, // written like this to keep TS happy about songId
    };
    await this.ctx.storage.put("pendingDbWrite", this.pendingDbWrite);

    // Schedule alarm (this persists across hibernation)
    const alarmTime = Date.now() + this.DB_WRITE_DEBOUNCE;
    await this.ctx.storage.setAlarm(alarmTime);
  }

  async alarm() {
    await this.flushDbWrite();
  }

  private async flushDbWrite() {
    if (!this.pendingDbWrite) {
      return;
    }

    try {
      const db = drizzle(this.env.DB);
      await db.insert(syncSession).values({
        masterId: this.pendingDbWrite.masterId,
        songId: this.pendingDbWrite.songId,
      });
    } catch (e) {
      console.error("Failed to write to D1:", e);
    } finally {
      this.pendingDbWrite = null;
      await this.ctx.storage.delete("pendingDbWrite");
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
      this.masterNickname = null;
      this.masterId = null;
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
