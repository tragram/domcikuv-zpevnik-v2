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
  connectionId: string;
}

export interface SessionSyncState {
  songId: string | null;
  versionId: string | null;
  transposeSteps: number | null;
  masterAvatar: string | null;
  masterNickname: string | null;
  masterId: string | null;
  isMasterConnected?: boolean;
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
  message?: string;
}

export type SesssionSyncWSMessage =
  | SyncMessage
  | PongMessage
  | UpdateOKMessage
  | MasterReplacedMessage;

export class SessionSync extends DurableObject<Env> {
  private masterWebSocket: WebSocket | null = null;
  private masterConnectionId: string | null = null;
  private masterId: string | null = null;
  private isNewSession: boolean = true; // Flag to track fresh connections

  masterNickname: string | null = null;
  masterAvatar: string | null = null;
  currentTransposeSteps: number | null = null;
  currentSongId: string | null = null;
  currentVersionId: string | null = null;

  private pendingDbWrite: {
    masterId: string;
    songId: string;
    versionId: string | null;
  } | null = null;

  // DB-related
  private readonly DB_WRITE_DEBOUNCE = 5000; // [ms]

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<SessionSyncState>("state");
      this.currentSongId = stored?.songId || null;
      this.currentVersionId = stored?.versionId || null;
      this.currentTransposeSteps = stored?.transposeSteps || null;
      this.masterAvatar = stored?.masterAvatar || null;
      this.masterNickname = stored?.masterNickname || null;
      this.masterId = stored?.masterId || null;

      // Restore active connection details in case of DO hibernation
      const activeMasterWs = this.ctx
        .getWebSockets()
        .find((webSocket) => webSocket.deserializeAttachment().isMaster);

      this.masterWebSocket = activeMasterWs || null;
      this.masterConnectionId = activeMasterWs
        ? activeMasterWs.deserializeAttachment().connectionId
        : null;

      // Restore pending write if exists
      this.pendingDbWrite =
        (await this.ctx.storage.get<{
          masterId: string;
          masterNickname: string;
          songId: string;
          versionId: string | null;
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
          versionId: this.currentVersionId,
          transposeSteps: this.currentTransposeSteps,
          masterNickname: this.masterNickname,
          masterAvatar: this.masterAvatar,
          masterId: this.masterId,
          isMasterConnected: this.masterWebSocket !== null,
        } as SessionSyncState),
        { headers: { "Content-Type": "application/json" } },
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
      this.isNewSession = true; // Reset flag so the first broadcast forces a D1 write
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
          }),
        );

        // Close the old master connection
        oldMaster.close(1000, "New master connected");
      } catch (e) {
        console.error("Error closing previous master:", e);
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const connectionId = crypto.randomUUID(); // Generate unique ID for this socket

    server.serializeAttachment({
      isMaster,
      masterId: this.masterId,
      connectionId,
    });

    // Enable hibernation - accept the new socket
    this.ctx.acceptWebSocket(server);

    if (isMaster) {
      this.masterWebSocket = server;
      this.masterConnectionId = connectionId; // Lock in the active connection ID

      // BROADCAST to followers that the master is officially connected
      this.broadcast({
        type: "sync",
        songId: this.currentSongId,
        versionId: this.currentVersionId,
        transposeSteps: this.currentTransposeSteps,
        masterAvatar: this.masterAvatar,
        masterNickname: this.masterNickname,
        masterId: this.masterId,
        isMasterConnected: true,
      } as SyncMessage);
    }

    // initial sync sent to the connecting client
    server.send(
      JSON.stringify({
        type: "sync",
        songId: this.currentSongId,
        versionId: this.currentVersionId,
        transposeSteps: this.currentTransposeSteps,
        masterAvatar: this.masterAvatar,
        masterNickname: this.masterNickname,
        masterId: this.masterId,
        isMasterConnected: this.masterWebSocket !== null,
        isMaster,
      } as SyncMessage),
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
    // Verify using connectionId to ensure proxy bugs don't cross wires
    if (!meta.isMaster || this.masterConnectionId !== meta.connectionId) {
      return;
    }

    try {
      if (data.type === "update-song") {
        const immediateWrite = this.isNewSession;

        if (
          this.masterNickname &&
          this.masterId &&
          data.songId &&
          (immediateWrite ||
            data.songId !== this.currentSongId ||
            data.versionId !== this.currentVersionId)
        ) {
          await this.scheduleDbWrite(
            {
              masterId: this.masterId,
              songId: data.songId,
              versionId: data.versionId ?? null,
            },
            immediateWrite,
          );
          this.isNewSession = false;
        }

        this.currentSongId = data.songId;
        this.currentVersionId = data.versionId ?? null;
        this.currentTransposeSteps = data.transposeSteps;

        await this.ctx.storage.put("state", {
          songId: data.songId,
          versionId: data.versionId ?? null,
          transposeSteps: data.transposeSteps,
          masterAvatar: this.masterAvatar,
          masterNickname: this.masterNickname,
          masterId: this.masterId,
        } as SessionSyncState);

        // Broadcast to everyone
        this.broadcast({
          type: "sync",
          songId: this.currentSongId,
          versionId: this.currentVersionId,
          transposeSteps: this.currentTransposeSteps,
          masterAvatar: this.masterAvatar,
          masterNickname: this.masterNickname,
          masterId: this.masterId,
          isMasterConnected: true,
        } as SyncMessage);

        this.masterWebSocket?.send(
          JSON.stringify({
            type: "update-ok",
            connectedClients: this.ctx.getWebSockets().length - 1,
          }),
        );
      }
    } catch (e) {
      console.error("WS Message Error:", e);
    }
  }

  private async scheduleDbWrite(
    data: { masterId: string; songId: string | null; versionId: string | null },
    isFirstSong: boolean = false,
  ) {
    // debounced DB write to minimize rows written during randomize
    if (!data.songId) {
      return;
    }

    // Store pending write
    this.pendingDbWrite = {
      masterId: data.masterId,
      songId: data.songId, // written like this to keep TS happy about songId
      versionId: data.versionId,
    };
    await this.ctx.storage.put("pendingDbWrite", this.pendingDbWrite);

    if (isFirstSong) {
      // Execute the database write immediately
      await this.flushDbWrite();
    } else {
      // Schedule alarm for subsequent songs (this persists across hibernation)
      const alarmTime = Date.now() + this.DB_WRITE_DEBOUNCE;
      await this.ctx.storage.setAlarm(alarmTime);
    }
  }

  async alarm() {
    await this.flushDbWrite();
  }

  private async flushDbWrite() {
    if (!this.pendingDbWrite) return;
    try {
      const db = drizzle(this.env.DB);
      await db.insert(syncSession).values({
        masterId: this.pendingDbWrite.masterId,
        songId: this.pendingDbWrite.songId,
        versionId: this.pendingDbWrite.versionId,
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
    wasClean: boolean,
  ) {
    const meta = ws.deserializeAttachment() as SocketMetadata;

    // Compare unique connection IDs instead of WebSocket proxies
    if (meta.isMaster && this.masterConnectionId === meta.connectionId) {
      this.masterWebSocket = null;
      this.masterConnectionId = null;

      this.broadcast({
        type: "sync",
        songId: this.currentSongId,
        versionId: this.currentVersionId,
        transposeSteps: this.currentTransposeSteps,
        masterAvatar: this.masterAvatar,
        masterNickname: this.masterNickname,
        masterId: this.masterId,
        isMasterConnected: false,
      } as SyncMessage);
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