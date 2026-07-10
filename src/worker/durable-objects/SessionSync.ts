import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { syncSession } from "src/lib/db/schema";
import {
  computeAudience,
  isSocketAlive,
  resolveChainUpdate,
  sameMembers,
  sanitizeSubtree,
  type AudienceSocketInfo,
} from "./session-sync-logic";

interface SocketMetadata {
  isMaster: boolean;
  connectionId: string;
  /** Stable per-browser-tab id. Multiple sockets from the same tab to this DO
   *  (e.g. a relay's upstream + a component's own follower connection) share
   *  one clientId so they're counted as a single client, not double-counted. */
  clientId: string;
  /** When this socket connected (ms epoch). Used as the liveness baseline until
   *  the socket has sent its first heartbeat ping, so a socket that connects and
   *  dies without ever pinging still ages out instead of counting forever. */
  connectedAt: number;
  /** Set when the client announced its departure with a "leave" message (e.g.
   *  navigating away). Excluded from the audience immediately, without waiting
   *  for an unreliable/delayed close event or the liveness sweep. */
  left?: boolean;
  /** For relaying followers: the set of client ids watching through this
   *  follower (its own transitive audience), reported via a relay-subtree
   *  message. Counting by identity — rather than summing counts — means a client
   *  reachable both directly and through a relay is counted once, so relay
   *  reconfiguration can never double-count. Undefined for regular followers. */
  subtree?: string[];
}

// ─── Shared state shape (persisted + broadcast) ───────────────────────────────

export interface SessionSyncState {
  songId: string | null;
  versionId: string | null;
  transposeSteps: number | null;
  masterAvatar: string | null;
  masterNickname: string | null;
  masterId: string | null;
  isMasterConnected?: boolean;
  /** Full relay chain: [originatorId, ..., currentMasterId].
   *  Empty array means standalone (not relaying). */
  chainPath: string[];
  /** Nickname of chainPath[0]. Null when standalone. */
  originatorNickname: string | null;
}

// ─── WebSocket message types (server → client) ────────────────────────────────

export interface SyncMessage extends SessionSyncState {
  type: "sync";
  /** Sent only in the initial sync to the connecting socket. */
  isMaster?: boolean;
}

export interface PongMessage {
  type: "pong";
}

export interface MasterReplacedMessage {
  type: "master-replaced";
}

export interface ClientCountMessage {
  type: "client-count";
  connectedClients: number;
  /** The audience as distinct client ids; a relaying follower forwards this
   *  upstream so its subtree is counted by identity, not by a summed count. */
  clients: string[];
}

/** Broadcast when a relay master detects a cycle in the chain. */
export interface LoopDetectedMessage {
  type: "loop-detected";
  /** The chain that forms the loop. */
  chainPath: string[];
  /** Number of masters involved in the loop. */
  loopSize: number;
}

export type SessionSyncWSMessage =
  | SyncMessage
  | PongMessage
  | MasterReplacedMessage
  | ClientCountMessage
  | LoopDetectedMessage;

// ─── WebSocket message types (client → server) ────────────────────────────────

export interface UpdateSongMessage {
  type: "update-song";
  songId: string;
  versionId?: string;
  transposeSteps: number;
  /** Full relay chain including the sender as last element. Omitted by a
   *  standalone originator — the DO defaults to [masterId]. */
  chainPath?: string[];
  /** Nickname of chainPath[0]. Null/omitted when standalone. */
  originatorNickname?: string | null;
  /** True for relayed content — skips the D1 write so relay content doesn't
   *  pollute the sessions list. */
  isRelay?: boolean;
}

/** Sent right before the client closes its socket (see handleLeave). */
export interface LeaveMessage {
  type: "leave";
}

/** A relaying follower reporting the distinct client ids watching through it. */
export interface RelaySubtreeMessage {
  type: "relay-subtree";
  clients: string[];
}

/** A relay master reporting a detected cycle (no loopSize — the DO derives it). */
export interface LoopDetectedReportMessage {
  type: "loop-detected";
  chainPath: string[];
}

/** Heartbeat — answered by the runtime auto-response, never reaches the DO. */
export interface PingMessage {
  type: "ping";
}

export type SessionSyncClientMessage =
  | UpdateSongMessage
  | LeaveMessage
  | RelaySubtreeMessage
  | LoopDetectedReportMessage
  | PingMessage;

// ─── Durable Object ───────────────────────────────────────────────────────────

export class SessionSync extends DurableObject<Env> {
  private masterWebSocket: WebSocket | null = null;
  private masterConnectionId: string | null = null;
  private masterId: string | null = null;
  private isNewSession = true;

  // Mutable broadcast state
  masterNickname: string | null = null;
  masterAvatar: string | null = null;
  currentSongId: string | null = null;
  currentVersionId: string | null = null;
  currentTransposeSteps: number | null = null;
  currentChainPath: string[] = [];
  currentOriginatorNickname: string | null = null;

  private pendingDbWrite: {
    masterId: string;
    songId: string | null;
    versionId: string | null;
  } | null = null;

  private readonly DB_WRITE_DEBOUNCE = 5000;

  /** A follower socket is treated as dead once the runtime hasn't seen its
   *  heartbeat ping for this long. The client pings every 90s, so this is ~2
   *  missed pings — enough to drop ghosts (sleep / crash / dropped network) that
   *  never sent a close frame, without flapping on a single late ping. */
  private readonly STALE_AFTER_MS = 200_000;

  /** How often the alarm re-counts live followers and pushes the result to the
   *  master, so the count self-corrects as ghosts age out even when no
   *  connect/disconnect event fires (e.g. a tab closed without a clean close). */
  private readonly SWEEP_INTERVAL_MS = 60_000;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Server-side heartbeat. The runtime auto-replies to the client's ping
    // without waking the DO, and records the time of each ping per socket
    // (getWebSocketAutoResponseTimestamp) — giving us free liveness detection
    // for ghost connections that died without sending a close frame.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(
        JSON.stringify({ type: "ping" }),
        JSON.stringify({ type: "pong" }),
      ),
    );

    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<SessionSyncState>("state");
      if (stored) {
        this.currentSongId = stored.songId;
        this.currentVersionId = stored.versionId;
        this.currentTransposeSteps = stored.transposeSteps;
        this.masterAvatar = stored.masterAvatar;
        this.masterNickname = stored.masterNickname;
        this.masterId = stored.masterId;
        this.currentChainPath = stored.chainPath ?? [];
        this.currentOriginatorNickname = stored.originatorNickname ?? null;
        // Reconstructed from storage with an existing song → not a new session,
        // so a same-song update after a hibernation wake won't write a duplicate
        // discovery row. A genuinely fresh DO keeps the field's `true` default.
        this.isNewSession = stored.songId === null;
      }

      for (const ws of this.ctx.getWebSockets()) {
        const meta = this.readMeta(ws);
        if (meta?.isMaster && !meta.left) {
          this.masterWebSocket = ws;
          this.masterConnectionId = meta.connectionId;
          break;
        }
      }

      this.pendingDbWrite =
        (await this.ctx.storage.get<typeof this.pendingDbWrite>(
          "pendingDbWrite",
        )) ?? null;
    });
  }

  // ── Public entry point ───────────────────────────────────────────────────────

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }
    if (request.method === "POST") {
      return this.handlePost(request);
    }
    // Snapshot of current sync state. Prune a stale master first so a fresh
    // visitor isn't told the master is connected when its socket is a ghost.
    this.pruneStaleMaster();
    return new Response(JSON.stringify(this.buildSyncState()), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── HTTP POST ────────────────────────────────────────────────────────────────

  private async handlePost(request: Request) {
    let body: { songId: string | null } | null = null;
    try {
      body = (await request.json()) as { songId: string | null };
    } catch {
      return new Response(JSON.stringify({ error: "Bad Request" }), {
        status: 400,
      });
    }

    if (body.songId === null && this.masterId) {
      // Full stop: null out state and broadcast to all clients
      this.currentSongId = null;
      this.currentVersionId = null;
      this.currentTransposeSteps = null;
      this.currentChainPath = [];
      this.currentOriginatorNickname = null;
      await this.persistState();
      await this.scheduleDbWrite(
        { masterId: this.masterId, songId: null, versionId: null },
        true,
      );
      this.broadcast({ type: "sync", ...this.buildSyncState() });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── WebSocket upgrade ────────────────────────────────────────────────────────

  private async handleWebSocket(request: Request) {
    const url = new URL(request.url);
    const roleParam = url.searchParams.get("role");
    const masterNicknameParam = url.searchParams.get("masterNickname");
    const masterIdParam = url.searchParams.get("masterId");
    const masterAvatarParam = url.searchParams.get("masterAvatar");

    // Backend has already verified authorization, so we trust the role parameter
    const isMaster = roleParam === "master";

    // Session identity (nickname / id / avatar) is derived server-side in
    // sessions.ts from the DB — never from the client — so it's safe to apply
    // on any connection. This lets a follower reaching a fresh (or renamed)
    // DO still see whose session it is.
    let identityChanged = false;
    if (masterNicknameParam && masterIdParam) {
      identityChanged =
        this.masterNickname !== masterNicknameParam ||
        this.masterId !== masterIdParam;
      this.masterNickname = masterNicknameParam;
      this.masterId = masterIdParam;
    }
    if (masterAvatarParam && masterAvatarParam !== this.masterAvatar) {
      this.masterAvatar = masterAvatarParam;
      identityChanged = true;
    }
    if (identityChanged) await this.persistState();

    if (isMaster) {
      // Only force the immediate "appear in discovery" D1 write for a session
      // that has no song yet. A reconnect/hibernation wake that already has
      // song state is NOT new — treating it as new writes a duplicate row.
      this.isNewSession = this.currentSongId === null;
    }

    // Displace any existing master connection
    if (isMaster && this.masterWebSocket) {
      try {
        // Send the message before closing — it's a reliable WS message and
        // guaranteed to arrive before the close frame, giving the client a
        // chance to set "kicked" before any reconnect logic fires. The close
        // reason alone is not reliable in CF hibernation mode.
        this.masterWebSocket.send(JSON.stringify({ type: "master-replaced" }));
        this.masterWebSocket.close(1000, "New master connected");
      } catch {
        /* stale socket */
      }
      this.masterWebSocket = null;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const connectionId = crypto.randomUUID();
    // Stable per-tab id supplied by the client; fall back to the per-socket id
    // when absent (older clients) so each such socket counts independently.
    const clientId = url.searchParams.get("cid") || connectionId;

    server.serializeAttachment({
      isMaster,
      connectionId,
      clientId,
      connectedAt: Date.now(),
    } satisfies SocketMetadata);

    // Enable hibernation - accept the new socket
    this.ctx.acceptWebSocket(server);

    if (isMaster) {
      this.masterWebSocket = server;
      this.masterConnectionId = connectionId;
      // Inform all existing clients that the master is live. The new master
      // itself is excluded — it gets the isMaster-tagged initial sync below.
      this.broadcast(
        { type: "sync", ...this.buildSyncState(), isMasterConnected: true },
        server,
      );
    }

    // Give the connecting socket its initial state snapshot
    server.send(
      JSON.stringify({ type: "sync", ...this.buildSyncState(), isMaster }),
    );

    this.notifyMasterOfClientCount();
    await this.scheduleNextSweep();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Incoming WebSocket messages ──────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Heartbeat pings are handled by the runtime (setWebSocketAutoResponse) and
    // never reach here.
    let data: SessionSyncClientMessage;
    try {
      data = JSON.parse(message.toString());
    } catch {
      return; // malformed frame — follower sockets are unauthenticated
    }

    const meta = this.readMeta(ws);
    if (!meta) return; // stale socket

    // Explicit departure (sent right before the client closes the socket).
    // Reliable even when the close event is delayed, so the count corrects now.
    if (data.type === "leave") {
      this.handleLeave(ws, meta);
      return;
    }

    // relay-subtree comes from FOLLOWER sockets: a relaying follower reports the
    // distinct client ids watching through it, so this session's audience
    // includes the whole subtree behind it — counted by identity.
    if (data.type === "relay-subtree" && !meta.isMaster) {
      const subtree = sanitizeSubtree(data.clients);
      if (!sameMembers(meta.subtree ?? [], subtree)) {
        ws.serializeAttachment({ ...meta, subtree });
        this.notifyMasterOfClientCount();
      }
      return;
    }

    if (!meta.isMaster || this.masterConnectionId !== meta.connectionId) return;

    if (data.type === "update-song") {
      await this.handleUpdateSong(data);
    } else if (data.type === "loop-detected") {
      this.handleLoopDetected(data.chainPath);
    }
  }

  private async handleUpdateSong(data: UpdateSongMessage) {
    const isFirstSong = this.isNewSession;
    // Normalized so "no version" compares equal to the stored null.
    const versionId = data.versionId ?? null;
    const { chainPath: newChainPath, originatorNickname: newOriginatorNickname, shouldWriteToDb } =
      resolveChainUpdate({
        incomingChainPath: data.chainPath,
        masterId: this.masterId,
        masterNickname: this.masterNickname,
        incomingOriginatorNickname: data.originatorNickname,
        isRelay: data.isRelay,
        isFirstSong,
        wasRelaying: this.currentChainPath.length > 1,
        currentSongId: this.currentSongId,
        currentVersionId: this.currentVersionId,
        songId: data.songId,
        versionId,
      });

    if (shouldWriteToDb && this.masterId) {
      await this.scheduleDbWrite(
        { masterId: this.masterId, songId: data.songId, versionId },
        isFirstSong,
      );
      this.isNewSession = false;
    }

    this.currentSongId = data.songId;
    this.currentVersionId = versionId;
    this.currentTransposeSteps = data.transposeSteps;
    this.currentChainPath = newChainPath;
    this.currentOriginatorNickname = newOriginatorNickname;

    await this.persistState();
    this.broadcast({ type: "sync", ...this.buildSyncState() });
    // Ack with a fresh audience count — the master UI shows it live.
    this.notifyMasterOfClientCount();
  }

  /** A relay master detected a loop and is informing us. Broadcast to all clients
   *  so the notification cascades down the relay chain. */
  private handleLoopDetected(chainPath: string[]) {
    this.broadcast({
      type: "loop-detected",
      chainPath,
      // The detecting master's ID appears twice in the loop path
      // (once mid-chain, once appended), so count unique masters.
      loopSize: new Set(chainPath).size,
    });
  }

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────

  async webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    const meta = this.readMeta(ws);
    if (meta) this.handleDeparture(ws, meta);
    else this.notifyMasterOfClientCount(ws);
  }

  /** Client announced it is leaving (see "leave" message). Mark the socket gone
   *  so it drops out of the audience right away, without waiting for the close
   *  event, then reconcile master state and the count exactly as a close would. */
  private handleLeave(ws: WebSocket, meta: SocketMetadata) {
    if (meta.left) return;
    ws.serializeAttachment({ ...meta, left: true });
    this.handleDeparture(ws, meta);
  }

  /** Shared teardown for a follower/master that left (via close or "leave"):
   *  clears master state if it was the active master, and refreshes the count. */
  private handleDeparture(ws: WebSocket, meta: SocketMetadata) {
    if (meta.isMaster && this.masterConnectionId === meta.connectionId) {
      this.masterWebSocket = null;
      this.masterConnectionId = null;
      this.broadcast({
        type: "sync",
        ...this.buildSyncState(),
        isMasterConnected: false,
      });
    }
    this.notifyMasterOfClientCount(ws);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private buildSyncState(): SessionSyncState {
    return {
      songId: this.currentSongId,
      versionId: this.currentVersionId,
      transposeSteps: this.currentTransposeSteps,
      masterAvatar: this.masterAvatar,
      masterNickname: this.masterNickname,
      masterId: this.masterId,
      isMasterConnected: this.masterWebSocket !== null,
      chainPath: this.currentChainPath,
      originatorNickname: this.currentOriginatorNickname,
    };
  }

  private async persistState() {
    await this.ctx.storage.put("state", this.buildSyncState());
  }

  /** Attachment read that tolerates stale sockets (deserialize can throw). */
  private readMeta(ws: WebSocket): SocketMetadata | null {
    try {
      return ws.deserializeAttachment() as SocketMetadata;
    } catch {
      return null;
    }
  }

  private broadcast(data: SessionSyncWSMessage, except?: WebSocket) {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(msg);
      } catch {
        /* stale */
      }
    }
  }

  private isAlive(ws: WebSocket, connectedAt: number): boolean {
    const lastPing = this.ctx.getWebSocketAutoResponseTimestamp(ws);
    const lastSeen = lastPing?.getTime() ?? connectedAt;
    return isSocketAlive(lastSeen, Date.now(), this.STALE_AFTER_MS);
  }

  /** Followers are pruned by liveness in computeAudience, but isMasterConnected
   *  comes straight from masterWebSocket — a master that died without a close
   *  frame would look connected forever. When the master socket has gone stale,
   *  drop it (closing it so a live-but-frozen client reconnects rather than
   *  keep talking into a socket the DO no longer honors) and tell followers. */
  private pruneStaleMaster() {
    const ws = this.masterWebSocket;
    if (!ws) return;
    const meta = this.readMeta(ws);
    if (meta && this.isAlive(ws, meta.connectedAt)) return;
    try {
      ws.close(1011, "Master connection stale");
    } catch {
      /* already gone */
    }
    this.masterWebSocket = null;
    this.masterConnectionId = null;
    this.broadcast({
      type: "sync",
      ...this.buildSyncState(),
      isMasterConnected: false,
    });
  }

  /** Duplicate sockets from one tab share a clientId and collapse naturally
   *  via computeAudience's Set. Master sockets (incl. a lingering just-kicked
   *  one) and ghosts are excluded there too. */
  private audience(excludeWs?: WebSocket): Set<string> {
    const sockets: AudienceSocketInfo[] = [];
    for (const w of this.ctx.getWebSockets()) {
      if (w === excludeWs) continue;
      const meta = this.readMeta(w);
      if (!meta) continue; // stale socket
      sockets.push({
        isMaster: meta.isMaster,
        left: meta.left,
        alive: this.isAlive(w, meta.connectedAt),
        clientId: meta.clientId ?? meta.connectionId,
        subtree: meta.subtree,
      });
    }
    return computeAudience(sockets);
  }

  private notifyMasterOfClientCount(closingWs?: WebSocket) {
    if (!this.masterWebSocket) return;
    const clients = [...this.audience(closingWs)];
    try {
      this.masterWebSocket.send(
        JSON.stringify({
          type: "client-count",
          connectedClients: clients.length,
          clients,
        }),
      );
    } catch {
      /* stale */
    }
  }

  // ── D1 persistence (debounced) ───────────────────────────────────────────────

  private async scheduleDbWrite(
    data: { masterId: string; songId: string | null; versionId: string | null },
    immediate = false,
  ) {
    // debounced DB write to minimize rows written during randomize
    this.pendingDbWrite = data;
    await this.ctx.storage.put("pendingDbWrite", this.pendingDbWrite);

    if (immediate) {
      await this.flushDbWrite();
    } else {
      // Schedule alarm for subsequent songs (this persists across hibernation)
      await this.ctx.storage.setAlarm(Date.now() + this.DB_WRITE_DEBOUNCE);
    }
  }

  async alarm() {
    await this.flushDbWrite();
    // Liveness sweep: drop a ghost master, re-count followers (isAlive excludes
    // ghosts), refresh the master, and keep the alarm going until the count
    // settles to zero.
    this.pruneStaleMaster();
    this.notifyMasterOfClientCount();
    await this.scheduleNextSweep();
  }

  /** Keep the periodic liveness sweep running while live followers remain (incl.
   *  ghosts still aging out), so the count keeps self-correcting; it stops once
   *  the count has settled to zero. No-op if an alarm is already pending (e.g. a
   *  debounced DB write), whose handler reschedules the sweep when it fires. */
  private async scheduleNextSweep() {
    if (this.audience().size === 0) return;
    if ((await this.ctx.storage.getAlarm()) !== null) return;
    await this.ctx.storage.setAlarm(Date.now() + this.SWEEP_INTERVAL_MS);
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
}
