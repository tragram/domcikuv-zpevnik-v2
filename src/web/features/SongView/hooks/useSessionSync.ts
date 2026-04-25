import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  SessionSyncState,
  SesssionSyncWSMessage,
} from "src/worker/durable-objects/SessionSync";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "kicked"
  | "disconnected";

export type FeedStatus = {
  isMaster: boolean;
  enabled: boolean;
  isConnected: boolean;
  connectedClients: number;
  connectionStatus: ConnectionStatus;
  retryAttempt: number;
  sessionState?: SessionSyncState;
};

export function useSessionSync(
  masterNickname: string | undefined,
  isMaster: boolean,
  enabled: boolean = true,
  initialState?: SessionSyncState,
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
  const [isConnected, setIsConnected] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");

  const socketRef = useRef<WebSocket | null>(null);
  const pendingUpdateRef = useRef<{
    songId: string;
    versionId?: string;
    transposeSteps: number;
  } | null>(null);
  const pingIntervalRef = useRef<number | undefined>(undefined);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const missedPongsRef = useRef(0);

  const cleanupSockets = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.onclose = null; // Prevent reconnect loop during teardown
      socketRef.current.close();
      socketRef.current = null;
    }
    clearTimeout(reconnectTimeoutRef.current);
    clearInterval(pingIntervalRef.current);
  }, []);

  const connect = useCallback(() => {
    // 1. Wrap the logic in a hoisted inner function
    function attemptConnection() {
      cleanupSockets();
      if (!enabled || !masterNickname) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        `${protocol}//${window.location.host}/api/session/${masterNickname}`,
      );
      url.searchParams.set("role", isMaster ? "master" : "follower");

      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("connected");
        setRetryAttempt(0);
        missedPongsRef.current = 0;

        // Flush pending updates if master
        if (isMaster && pendingUpdateRef.current) {
          ws.send(
            JSON.stringify({
              type: "update-song",
              ...pendingUpdateRef.current,
            }),
          );
          pendingUpdateRef.current = null;
        }

        // Start Heartbeat
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (missedPongsRef.current >= 1) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "ping" }));
          missedPongsRef.current++;
        }, 90_000); // 90s
      };

      ws.onmessage = (event) => {
        missedPongsRef.current = 0; // Reset heartbeat on ANY message
        const data: SesssionSyncWSMessage = JSON.parse(event.data);

        if (data.type === "update-ok" || data.type === "client-count") {
          setConnectedClients(data.connectedClients);
        } else if (data.type === "sync" && !isMaster) {
          setSessionState({
            songId: data.songId,
            versionId: data.versionId,
            transposeSteps: data.transposeSteps,
            masterAvatar: data.masterAvatar,
            masterNickname: data.masterNickname,
            masterId: data.masterId,
            isMasterConnected: data.isMasterConnected,
          });
        } else if (data.type === "master-replaced") {
          setConnectionStatus("kicked");
          toast.info("Session taken over by another device.");
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        clearInterval(pingIntervalRef.current);

        if (event.reason === "New master connected") {
          setConnectionStatus("kicked");
          return;
        }

        setConnectionStatus("reconnecting");
        setRetryAttempt((prev) => {
          const delay = Math.min(1000 * Math.pow(2, prev), 30000);
          const jitterDelay = delay + delay * 0.25 * (Math.random() * 2 - 1);

          // 2. Safely reference the inner hoisted function here instead of `connect`
          reconnectTimeoutRef.current = window.setTimeout(
            attemptConnection,
            jitterDelay,
          );
          return prev + 1;
        });
      };

      ws.onerror = () => ws.close();
    }

    // 3. Kick off the initial connection
    attemptConnection();
  }, [enabled, masterNickname, isMaster, cleanupSockets]);

  // Main Mount / Reconnect Effect
  useEffect(() => {
    connect();
    return () => {
      cleanupSockets();
    };
  }, [connect, cleanupSockets]);

  // Online/Offline Detection Effect
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

  // Public API
  const updateSong = useCallback(
    (songId: string, transposeSteps: number, versionId?: string) => {
      if (!isMaster) return;

      const ws = socketRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "update-song",
            songId,
            transposeSteps,
            versionId,
          }),
        );
        pendingUpdateRef.current = null;
      } else {
        pendingUpdateRef.current = { songId, transposeSteps, versionId };

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
      }) as FeedStatus,
    [
      isMaster,
      enabled,
      isConnected,
      connectedClients,
      connectionStatus,
      retryAttempt,
      sessionState,
    ],
  );

  return {
    feedStatus,
    updateSong,
  };
}
