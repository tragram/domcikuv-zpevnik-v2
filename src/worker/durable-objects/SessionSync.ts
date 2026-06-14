import { DurableObject } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { syncSession } from "src/lib/db/schema";

interface Env {
  DB: D1Database;
}

/** Order-insensitive equality for two id lists (used to skip no-op updates). */
function sameMembers(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

interface SocketMetadata {
  isMaster: boolean;
  masterId: string;
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

// ─── WebSocket message types ──────────────────────────────────────────────────

export interface SyncMessage extends SessionSyncState {
  type: "sync";
  /** Sent only in the initial sync to the connecting socket. */
  isMaster?: boolean;
}

export interface PongMessage {
  type: "pong";
}

export interface UpdateOKMessage {
  type: "update-ok";
  connectedClients: number;
  /** The audience as distinct client ids; a relaying follower forwards this
   *  upstream so its subtree is counted by identity, not by a summed count. */
  clients: string[];
}

export interface MasterReplacedMessage {
  type: "master-replaced";
  message?: string;
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

export type SesssionSyncWSMessage =
  | SyncMessage
  | PongMessage
  | UpdateOKMessage
  | MasterReplacedMessage
  | ClientCountMessage
  | LoopDetectedMessage;

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
      }

      const activeMasterWs = this.ctx
        .getWebSockets()
        .find((ws) => ws.deserializeAttachment().isMaster);
      this.masterWebSocket = activeMasterWs ?? null;
      this.masterConnectionId = activeMasterWs
        ? activeMasterWs.deserializeAttachment().connectionId
        : null;

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
    // Snapshot of current sync state
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

    if (isMaster && masterNicknameParam && masterIdParam) {
      this.masterNickname = masterNicknameParam;
      this.masterId = masterIdParam;
      this.isNewSession = true;
    }
    if (masterAvatarParam) this.masterAvatar = masterAvatarParam;

    // Displace any existing master connection
    if (isMaster && this.masterWebSocket) {
      try {
        this.masterWebSocket.send(
          JSON.stringify({
            type: "master-replaced",
            message: "Another master has connected",
          }),
        );
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
      masterId: this.masterId,
      connectionId,
      clientId,
      connectedAt: Date.now(),
    });

    // Enable hibernation - accept the new socket
    this.ctx.acceptWebSocket(server);

    if (isMaster) {
      this.masterWebSocket = server;
      this.masterConnectionId = connectionId;
      // Inform all existing clients that the master is live
      this.broadcast({
        type: "sync",
        ...this.buildSyncState(),
        isMasterConnected: true,
      });
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
    const data = JSON.parse(message.toString());

    const meta = ws.deserializeAttachment() as SocketMetadata;

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
      const subtree = Array.isArray(data.clients)
        ? (data.clients as unknown[]).filter(
            (c): c is string => typeof c === "string",
          )
        : [];
      if (!sameMembers(meta.subtree ?? [], subtree)) {
        ws.serializeAttachment({ ...meta, subtree });
        this.notifyMasterOfClientCount();
      }
      return;
    }

    if (!meta.isMaster || this.masterConnectionId !== meta.connectionId) return;

    if (data.type === "update-song") {
      await this.handleUpdateSong(
        data as {
          songId: string;
          versionId?: string;
          transposeSteps: number;
          chainPath?: string[];
          originatorNickname?: string;
          isRelay?: boolean;
        },
      );
    } else if (data.type === "loop-detected") {
      this.handleLoopDetected(data.chainPath as string[]);
    }
  }

  private async handleUpdateSong(data: {
    songId: string;
    versionId?: string;
    transposeSteps: number;
    chainPath?: string[];
    originatorNickname?: string;
    /** When true this is a relayed update — skip D1 write so relay content
     *  doesn't pollute the sessions list. */
    isRelay?: boolean;
  }) {
    // If the master provides a chainPath it includes itself as the last element.
    // Fall back to a standalone chain with just this master's ID.
    const newChainPath =
      data.chainPath && data.chainPath.length > 0
        ? data.chainPath
        : this.masterId
          ? [this.masterId]
          : [];

    // Originator nickname: relayed from upstream, or this master for standalone.
    const newOriginatorNickname =
      newChainPath.length > 1
        ? (data.originatorNickname ?? null)
        : this.masterNickname;

    // Only write to D1 for first-party (non-relay) updates so the sessions list
    // reflects the master's own choices, not relayed content.
    // `wasRelaying` forces a write when the master returns to first-party
    // broadcasting — even with an unchanged songId — so they reappear in the
    // sessions list after the null they sent to hide while relaying.
    const isFirstSong = this.isNewSession;
    const wasRelaying = this.currentChainPath.length > 1;
    if (
      !data.isRelay &&
      this.masterId &&
      data.songId &&
      (isFirstSong ||
        wasRelaying ||
        data.songId !== this.currentSongId ||
        data.versionId !== this.currentVersionId)
    ) {
      await this.scheduleDbWrite(
        {
          masterId: this.masterId,
          songId: data.songId,
          versionId: data.versionId ?? null,
        },
        isFirstSong,
      );
      this.isNewSession = false;
    }

    this.currentSongId = data.songId;
    this.currentVersionId = data.versionId ?? null;
    this.currentTransposeSteps = data.transposeSteps;
    this.currentChainPath = newChainPath;
    this.currentOriginatorNickname = newOriginatorNickname;

    await this.persistState();
    this.broadcast({ type: "sync", ...this.buildSyncState() });

    const clients = [...this.audience()];
    this.masterWebSocket?.send(
      JSON.stringify({
        type: "update-ok",
        connectedClients: clients.length,
        clients,
      }),
    );
  }

  /** A relay master detected a loop and is informing us. Broadcast to all clients
   *  so the notification cascades down the relay chain. */
  private handleLoopDetected(chainPath: string[]) {
    const msg: LoopDetectedMessage = {
      type: "loop-detected",
      chainPath,
      // The detecting master's ID appears twice in the loop path
      // (once mid-chain, once appended), so count unique masters.
      loopSize: new Set(chainPath).size,
    };
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(raw);
      } catch {
        /* stale */
      }
    }
  }

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────

  async webSocketClose(ws: WebSocket, _code: number, _reason: string) {
    this.handleDeparture(ws, ws.deserializeAttachment() as SocketMetadata);
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

  private broadcast(data: SyncMessage) {
    const msg = JSON.stringify(data);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* stale */
      }
    }
  }

  /** A socket is alive if it was seen within STALE_AFTER_MS — "seen" being its
   *  last heartbeat ping, or (before the first ping) its connect time, so a
   *  socket that dies before ever pinging (e.g. a reload before the first
   *  heartbeat) still ages out instead of counting forever. */
  private isAlive(ws: WebSocket, connectedAt: number): boolean {
    const lastPing = this.ctx.getWebSocketAutoResponseTimestamp(ws);
    const lastSeen = lastPing?.getTime() ?? connectedAt;
    return Date.now() - lastSeen < this.STALE_AFTER_MS;
  }

  /** The distinct client ids following this session. Each alive follower socket
   *  contributes its own clientId plus every id in the subtree it reported
   *  (relay-subtree). Because it is a set, a client reachable both directly and
   *  through a relay — e.g. during a relay reconfiguration — is counted once.
   *  Duplicate sockets from one tab share a clientId and collapse naturally.
   *  Master sockets (incl. a lingering just-kicked one) and ghosts are excluded. */
  private audience(excludeWs?: WebSocket): Set<string> {
    const clients = new Set<string>();
    for (const w of this.ctx.getWebSockets()) {
      if (w === excludeWs) continue;
      let meta: SocketMetadata;
      try {
        meta = w.deserializeAttachment() as SocketMetadata;
      } catch {
        continue; // stale socket
      }
      if (meta.isMaster) continue;
      if (meta.left) continue; // announced departure
      if (!this.isAlive(w, meta.connectedAt)) continue; // ghost: no clean close
      clients.add(meta.clientId ?? meta.connectionId);
      if (meta.subtree) for (const id of meta.subtree) clients.add(id);
    }
    return clients;
  }

  private countClients(excludeWs?: WebSocket): number {
    return this.audience(excludeWs).size;
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
    if (data.songId === undefined) return;
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
    // Liveness sweep: re-count (isAlive excludes ghosts), refresh the master, and
    // keep the alarm going until the count settles to zero.
    this.notifyMasterOfClientCount();
    await this.scheduleNextSweep();
  }

  /** Keep the periodic liveness sweep running while live followers remain (incl.
   *  ghosts still aging out), so the count keeps self-correcting; it stops once
   *  the count has settled to zero. No-op if an alarm is already pending (e.g. a
   *  debounced DB write), whose handler reschedules the sweep when it fires. */
  private async scheduleNextSweep() {
    if (this.countClients() === 0) return;
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
