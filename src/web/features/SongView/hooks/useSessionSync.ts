import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  SessionSyncState,
  SesssionSyncWSMessage,
} from "src/worker/durable-objects/SessionSync";

/**
 * Stable identifier for this browser tab, shared by every useSessionSync
 * instance in the tab. The DO uses it to deduplicate the follower count: if a
 * tab opens more than one connection to the same session (for example a relay
 * page whose relay hook AND its rendered SongView both connect upstream), the
 * tab is still counted as a single follower.
 *
 * Persisted in sessionStorage so it survives a page reload: a reload's new
 * socket reuses the id, collapsing with the old (not-yet-closed) socket on the
 * DO instead of counting as a second follower. sessionStorage is per-tab and
 * cleared when the tab closes, so distinct tabs still get distinct ids.
 */
function resolveTabClientId(): string {
  const fresh = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `cid-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  try {
    if (typeof sessionStorage === "undefined") return fresh();
    const existing = sessionStorage.getItem("sessionSyncTabId");
    if (existing) return existing;
    const id = fresh();
    sessionStorage.setItem("sessionSyncTabId", id);
    return id;
  } catch {
    return fresh();
  }
}

const TAB_CLIENT_ID = resolveTabClientId();

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

/** State exposed by useMasterRelay when a relay is active. */
export type RelayStatus = {
  /** Whether the relay is actively bridging upstream content downstream. */
  active: boolean;
  /** Whether a cycle was detected in the relay chain. */
  loopDetected: boolean;
  /** The full chain path at the time of detection / current relay. */
  chainPath: string[];
  /** Nickname of the chain originator. */
  originatorNickname: string | null;
  /** Number of unique masters in the loop (set only when loopDetected). */
  loopSize?: number;
};

export type FeedStatus = {
  isMaster: boolean;
  enabled: boolean;
  isConnected: boolean;
  connectedClients: number | undefined;
  connectionStatus: ConnectionStatus;
  retryAttempt: number;
  sessionState?: SessionSyncState;
  /** Set when a loop-detected message is received from the upstream DO. */
  loopInfo?: { detected: boolean; chainPath: string[]; loopSize: number };
  /** Populated by useMasterRelay when the relay feature is in use. */
  relay?: RelayStatus;
};

export function useSessionSync(
  masterNickname: string | undefined,
  isMaster: boolean,
  enabled: boolean = true,
  initialState?: SessionSyncState,
  onKicked?: () => void,
) {
  if (
    initialState?.masterNickname &&
    initialState.masterNickname !== masterNickname
  ) {
    console.warn(
      `Session sync received initialState.nickname ${initialState.masterNickname} but masterNickname ${masterNickname}`,
    );
  }

  const [sessionState, setSessionState] = useState<SessionSyncState | null>(
    initialState ?? null,
  );
  const [connectedClients, setConnectedClients] = useState<number | undefined>(
    undefined,
  );
  // Distinct client ids in this session's audience (master role). Forwarded
  // upstream by a relay so its subtree is counted by identity, not summed.
  const [audienceClients, setAudienceClients] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [loopInfo, setLoopInfo] = useState<
    { detected: boolean; chainPath: string[]; loopSize: number } | undefined
  >(undefined);

  const socketRef = useRef<WebSocket | null>(null);
  const pendingUpdateRef = useRef<{
    songId: string;
    versionId?: string;
    transposeSteps: number;
    chainPath?: string[];
    originatorNickname?: string | null;
    isRelay?: boolean;
  } | null>(null);
  // Loop notifications queued while the socket is still connecting — loop
  // detection often fires right after navigation, before the WS is open.
  const pendingLoopRef = useRef<string[] | null>(null);
  // Last relay-subtree (audience client ids) reported upstream (follower role).
  // Kept in a ref so it can be re-sent after a reconnect — a fresh socket has a
  // fresh attachment on the upstream DO, which would otherwise forget it. The
  // companion key is the order-insensitive signature used to skip no-op resends.
  const relaySubtreeRef = useRef<string[] | null>(null);
  const relaySubtreeKeyRef = useRef<string | null>(null);
  // Content key of the last sync, used to clear loopInfo only when the
  // broadcast content genuinely changed (loop resolved), not on mere
  // connection-state toggles.
  const lastSyncKeyRef = useRef<string | null>(null);
  const pingIntervalRef = useRef<number | undefined>(undefined);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const missedPongsRef = useRef(0);
  // Set when the server displaces us as master — suppresses reconnect in onclose.
  const kickedRef = useRef(false);
  const onKickedRef = useRef(onKicked);
  useEffect(() => {
    onKickedRef.current = onKicked;
  }, [onKicked]);

  const cleanupSockets = useCallback(() => {
    if (socketRef.current) {
      const ws = socketRef.current;
      ws.onclose = null; // Prevent reconnect loop during teardown
      // Explicit departure over the still-open socket: delivered reliably even
      // when the close frame / webSocketClose is delayed, so the DO drops us
      // from the audience immediately (e.g. when this tab navigates away).
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "leave" }));
        } catch {
          /* socket already gone */
        }
      }
      ws.close();
      socketRef.current = null;
    }
    clearTimeout(reconnectTimeoutRef.current);
    clearInterval(pingIntervalRef.current);
  }, []);

  const connect = useCallback(() => {
    function attemptConnection() {
      cleanupSockets();
      if (!enabled || !masterNickname) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        `${protocol}//${window.location.host}/api/session/${encodeURIComponent(
          masterNickname,
        )}`,
      );
      url.searchParams.set("role", isMaster ? "master" : "follower");
      // Stable per-tab id so the DO can collapse duplicate connections from
      // this tab to the same session into a single counted client.
      url.searchParams.set("cid", TAB_CLIENT_ID);

      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("connected");
        setRetryAttempt(0);
        missedPongsRef.current = 0;

        // Flush any pending update (master only)
        if (isMaster && pendingUpdateRef.current) {
          ws.send(
            JSON.stringify({
              type: "update-song",
              ...pendingUpdateRef.current,
            }),
          );
          pendingUpdateRef.current = null;
        }

        // Flush a queued loop notification (master only) — without this the
        // cascade dies whenever the loop is detected before the WS is open.
        if (isMaster && pendingLoopRef.current) {
          ws.send(
            JSON.stringify({
              type: "loop-detected",
              chainPath: pendingLoopRef.current,
            }),
          );
          pendingLoopRef.current = null;
        }

        // Re-report our subtree after (re)connect (follower only) — the upstream
        // DO tracks it on the socket attachment, which is fresh now.
        if (!isMaster && relaySubtreeRef.current !== null) {
          ws.send(
            JSON.stringify({
              type: "relay-subtree",
              clients: relaySubtreeRef.current,
            }),
          );
        }

        // Heartbeat: ping every 90s, close if pong is missed
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (missedPongsRef.current >= 1) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "ping" }));
          missedPongsRef.current++;
        }, 90_000);
      };

      ws.onmessage = (event) => {
        missedPongsRef.current = 0; // Reset heartbeat on ANY message
        const data: SesssionSyncWSMessage = JSON.parse(event.data);

        if (data.type === "update-ok" || data.type === "client-count") {
          setConnectedClients(data.connectedClients);
          setAudienceClients(data.clients ?? []);
        } else if (data.type === "sync" && !isMaster) {
          // Ignore a null song: keep showing the last one (better stale than
          // blank). A master sends null to leave the discovery list or when
          // stopping; the song and its chain context are preserved either way.
          const ignoreNull = data.songId === null;
          setSessionState((prev) => ({
            songId: ignoreNull ? (prev?.songId ?? null) : data.songId,
            versionId: ignoreNull ? (prev?.versionId ?? null) : data.versionId,
            transposeSteps: ignoreNull
              ? (prev?.transposeSteps ?? null)
              : data.transposeSteps,
            masterAvatar: data.masterAvatar,
            masterNickname: data.masterNickname,
            masterId: data.masterId,
            isMasterConnected: data.isMasterConnected,
            chainPath: ignoreNull
              ? (prev?.chainPath ?? [])
              : (data.chainPath ?? []),
            originatorNickname: ignoreNull
              ? (prev?.originatorNickname ?? null)
              : (data.originatorNickname ?? null),
          }));
          // New broadcast *content* (song or chain changed) means the chain
          // restructured — any previously reported loop is resolved. Syncs that
          // only toggle connection state (or carry null) must NOT clear it.
          if (!ignoreNull) {
            const syncKey = JSON.stringify([
              data.songId,
              data.versionId,
              data.chainPath ?? [],
            ]);
            if (
              lastSyncKeyRef.current !== null &&
              lastSyncKeyRef.current !== syncKey
            ) {
              setLoopInfo(undefined);
            }
            lastSyncKeyRef.current = syncKey;
          }
        } else if (data.type === "master-replaced") {
          kickedRef.current = true;
          onKickedRef.current?.();
        } else if (data.type === "loop-detected") {
          setLoopInfo({
            detected: true,
            chainPath: data.chainPath,
            loopSize: data.loopSize,
          });
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        clearInterval(pingIntervalRef.current);

        if (event.reason === "New master connected" || kickedRef.current) {
          kickedRef.current = true;
          onKickedRef.current?.();
          return;
        }

        setConnectionStatus("reconnecting");
        setRetryAttempt((prev) => {
          const delay = Math.min(1000 * Math.pow(2, prev), 30000);
          const jitterDelay = delay + delay * 0.25 * (Math.random() * 2 - 1);
          reconnectTimeoutRef.current = window.setTimeout(
            attemptConnection,
            jitterDelay,
          );
          return prev + 1;
        });
      };

      ws.onerror = () => ws.close();
    }

    attemptConnection();
  }, [enabled, masterNickname, isMaster, cleanupSockets]);

  // Main mount / reconnect effect
  useEffect(() => {
    connect();
    return () => {
      cleanupSockets();
    };
  }, [connect, cleanupSockets]);

  // Online / offline detection
  useEffect(() => {
    if (!enabled || !masterNickname) return;

    const handleOnline = () => {
      toast.info(
        `Reconnected: Attempting to ${isMaster ? "broadcast" : "reload feed!"}`,
      );
      setRetryAttempt(0);
      setConnectionStatus("connecting");
      connect();
    };

    const handleOffline = () => {
      setIsConnected(false);
      setConnectionStatus("disconnected");
      toast.warning("Connection to feed lost");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, masterNickname, isMaster, connect]);

  /**
   * Send an update-song message to the Durable Object.
   *
   * @param chainPath    Full relay chain including this master as last element.
   *                     Omit (or pass undefined) for a standalone originator —
   *                     the DO will default to [masterId].
   * @param originatorNickname  Nickname of chainPath[0]. Pass null for standalone.
   * @param isRelay      When true the DO will skip its D1 write so relay content
   *                     doesn't show the master as sharing in the sessions list.
   */
  const updateSong = useCallback(
    (
      songId: string,
      transposeSteps: number,
      versionId?: string,
      chainPath?: string[],
      originatorNickname?: string | null,
      isRelay?: boolean,
    ) => {
      if (!isMaster) return;

      const payload = {
        type: "update-song",
        songId,
        transposeSteps,
        versionId,
        ...(chainPath !== undefined && { chainPath }),
        ...(originatorNickname !== undefined && { originatorNickname }),
        ...(isRelay && { isRelay: true }),
      };

      const ws = socketRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        pendingUpdateRef.current = null;
      } else {
        pendingUpdateRef.current = {
          songId,
          transposeSteps,
          versionId,
          chainPath,
          originatorNickname,
          isRelay,
        };

        if (
          !ws ||
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING
        ) {
          setRetryAttempt(0);
          setConnectionStatus("connecting");
          connect();
        }
      }
    },
    [isMaster, connect],
  );

  /**
   * Send a loop-detected notification to the Durable Object.
   * The DO will broadcast it to all connected clients so the signal cascades
   * through the relay chain. Queued and flushed on open if not yet connected.
   */
  const notifyLoopDetected = useCallback((chainPath: string[]) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "loop-detected", chainPath }));
    } else {
      pendingLoopRef.current = chainPath;
    }
  }, []);

  /**
   * Report this client's audience (the distinct client ids watching through it)
   * to the session it follows (follower role only). Used by relaying followers
   * so the upstream session counts the whole subtree behind them by identity.
   * Deduped (order-insensitive) and re-sent automatically after reconnects.
   */
  const reportRelaySubtree = useCallback((clients: string[]) => {
    const key = [...clients].sort().join(",");
    if (relaySubtreeKeyRef.current === key) return;
    relaySubtreeKeyRef.current = key;
    relaySubtreeRef.current = clients;
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "relay-subtree", clients }));
    }
    // If not open: onopen re-reports from relaySubtreeRef.
  }, []);

  const feedStatus = useMemo(
    () =>
      ({
        isMaster,
        enabled,
        isConnected,
        connectedClients,
        connectionStatus,
        retryAttempt,
        sessionState,
        loopInfo,
      }) as FeedStatus,
    [
      isMaster,
      enabled,
      isConnected,
      connectedClients,
      connectionStatus,
      retryAttempt,
      sessionState,
      loopInfo,
    ],
  );

  return {
    feedStatus,
    updateSong,
    notifyLoopDetected,
    reportRelaySubtree,
    /** Audience client ids (master role) — forwarded upstream by a relay. */
    audienceClients,
  };
}
