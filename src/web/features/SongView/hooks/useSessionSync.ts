import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  SessionSyncState,
  SesssionSyncWSMessage,
} from "src/worker/durable-objects/SessionSync";

export function useSessionSync(
  masterNickname: string | undefined,
  isMaster: boolean,
  enabled: boolean = true,
  initialState?: SessionSyncState,
) {
  if (initialState && initialState.masterNickname !== masterNickname) {
    console.warn(
      "Session sync received initialState.nickname",
      initialState.masterNickname,
      "but masterNickname",
      masterNickname,
    );
  }
  const [currentState, setCurrentState] = useState<SessionSyncState | null>(
    initialState ?? null,
  );

  const [connectedClients, setConnectedClients] = useState<number | undefined>(
    undefined,
  );
  const [isConnected, setIsConnected] = useState(false);

  // Changing this value forces the useEffect to restart the connection
  const [retryTrigger, setRetryTrigger] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);

  // FIXED: Queue both the songId AND transposeSteps for when the WS reconnects
  const pendingSongUpdateRef = useRef<{
    songId: string;
    transposeSteps: number;
  } | null>(null);

  // Track "missed pongs" to detect zombie connections
  const missedPongsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);

  // Exponential backoff state
  const retryCountRef = useRef(0);
  // FIXED: Create a state specifically for the UI to read during render
  const [retryAttemptUI, setRetryAttemptUI] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);

  // Helper to sync ref to UI state safely
  const updateRetryCount = useCallback((newCount: number) => {
    retryCountRef.current = newCount;
    setRetryAttemptUI(newCount);
  }, []);

  // Keep role ref fresh
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  // Helper function to calculate exponential backoff delay
  const getBackoffDelay = useCallback((retryCount: number): number => {
    // Base delay of 1 second, doubles each time, max 30 seconds
    const baseDelay = 1000;
    const maxDelay = 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

    // Add jitter (±25%) to prevent thundering herd
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return delay + jitter;
  }, []);

  // Helper function to reset heartbeat timeout
  const resetHeartbeat = useCallback((ws: WebSocket) => {
    missedPongsRef.current = 0;

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (missedPongsRef.current >= 1) {
        // no message since last ping (not even pong)
        console.warn("[WS] Connection dead (no pong), forcing reconnect");
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ type: "ping" }));
      missedPongsRef.current += 1;
    }, 90_000); // 90s - CF timeout is supposedly 100s
  }, []);

  // ---- Public API ----
  const updateSong = useCallback(
    (songId: string, transposeSteps: number) => {
      if (!isMasterRef.current) return;

      const ws = socketRef.current;
      // If connected, send immediately
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "update-song", songId, transposeSteps }),
        );
        pendingSongUpdateRef.current = null;
      } else {
        // If disconnected (or previously kicked), queue this update and force a reconnect
        console.log(
          "[WS] Disconnected/Kicked. Queuing update and reconnecting...",
        );
        // FIXED: Store both properties
        pendingSongUpdateRef.current = { songId, transposeSteps };
        // Reset retry count on user-initiated action
        updateRetryCount(0);
        setRetryTrigger((prev) => prev + 1);
      }
    },
    [updateRetryCount],
  );

  // ---- WebSocket Lifecycle ----
  useEffect(() => {
    if (!enabled || !masterNickname) return;

    // DEBOUNCE: Wait 100ms before connecting.
    // This prevents "interrupted" errors during React Strict Mode double-mounts
    // or rapid re-renders.
    const connectTimer = setTimeout(() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        `${protocol}//${window.location.host}/api/session/${masterNickname}`,
      );
      url.searchParams.set("role", isMaster ? "master" : "follower");

      console.debug(
        `[WS] Connecting (Attempt ${retryCountRef.current + 1})...`,
      );
      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      // handlers
      ws.onopen = () => {
        console.debug("[WS] Connected");
        setIsConnected(true);

        // Reset retry count on successful connection
        updateRetryCount(0);

        // FIXED: Extract both properties when flushing
        if (isMaster && pendingSongUpdateRef.current) {
          console.log("[WS] Flushing queued song update...");
          ws.send(
            JSON.stringify({
              type: "update-song",
              songId: pendingSongUpdateRef.current.songId,
              transposeSteps: pendingSongUpdateRef.current.transposeSteps,
            }),
          );
          pendingSongUpdateRef.current = null;
        }

        // Start heartbeat
        resetHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        const data: SesssionSyncWSMessage = JSON.parse(event.data);

        // Reset heartbeat on ANY message received
        resetHeartbeat(ws);

        if (data.type === "pong") {
          return;
        }

        if (data.type === "update-ok") {
          setConnectedClients(data.connectedClients);
        }

        if (data.type === "sync") {
          // ignore sync message if isMaster
          if (isMaster) return;
          setCurrentState({
            songId: data.songId,
            transposeSteps: data.transposeSteps,
            masterAvatar: data.masterAvatar,
            masterNickname: data.masterNickname,
            masterId: data.masterId,
          });
        }

        if (data.type === "master-replaced") {
          toast.info("Session taken over by another device.");
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Don't retry if replaced by another master or component is unmounting
        if (event.reason === "New master connected") return;

        // Only trigger retry if this socket is still the "current" one
        if (socketRef.current === ws) {
          const backoffDelay = getBackoffDelay(retryCountRef.current);
          console.debug(
            `[WS] Closed. Retrying in ${Math.round(backoffDelay / 1000)}s (attempt ${retryCountRef.current + 1})...`,
          );

          // Update both the ref and the UI state
          updateRetryCount(retryCountRef.current + 1);

          retryTimeoutRef.current = window.setTimeout(() => {
            setRetryTrigger((prev) => prev + 1);
          }, backoffDelay);
        }
      };

      ws.onerror = (error) => {
        console.error("[WS] Error occurred", error);
        ws.close();
      };
    }, 100);

    // CLEANUP
    return () => {
      clearTimeout(connectTimer);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [
    enabled,
    masterNickname,
    isMaster,
    retryTrigger,
    resetHeartbeat,
    getBackoffDelay,
    updateRetryCount, // Added dependency
  ]);

  // Online/Offline Detection
  useEffect(() => {
    if (!enabled || !masterNickname) return;

    const handleOnline = () => {
      console.debug("[WS] Online detected, reconnecting immediately");
      toast.info(
        `Reconnected: Attempting to ${isMaster ? "broadcast" : "reload feed!"}`,
      );
      updateRetryCount(0);
      setRetryTrigger((prev) => prev + 1);
    };

    const handleOffline = () => {
      setIsConnected(false);
      console.warn("[WS] Browser went offline");
      toast.warning("Connection to feed lost");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, masterNickname, isMaster, updateRetryCount]);

  return {
    sessionState: currentState,
    connectedClients,
    updateSong,
    isConnected,
    retryAttempt: retryAttemptUI, // FIXED: Now strictly returning React state
  };
}
