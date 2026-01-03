import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { SesssionSyncWSMessage } from "src/worker/durable-objects/SessionSync";

export function useSessionSync(
  masterNickname: string | undefined,
  isMaster: boolean,
  enabled: boolean = true
) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>();
  const [connectedClients, setConnectedClients] = useState<number>(0);
  const [currentTransposeSteps, setCurrentTransposeSteps] = useState<
    number | undefined
  >();
  const [isConnected, setIsConnected] = useState(false);

  // Changing this value forces the useEffect to restart the connection
  const [retryTrigger, setRetryTrigger] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);

  // Queue a song update to send immediately upon reconnection
  const pendingSongUpdateRef = useRef<string | null>(null);

  // Track "missed pongs" to detect zombie connections
  const missedPongsRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);

  // Keep role ref fresh
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  // Helper function to reset heartbeat timeout
  const resetHeartbeat = useCallback((ws: WebSocket) => {
    missedPongsRef.current = 0;
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    pingIntervalRef.current = window.setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (missedPongsRef.current >= 1) { // no message since last ping (not even pong)
        console.warn("[WS] Connection dead (no pong), forcing reconnect");
        ws.close();
        return;
      }
      ws.send(JSON.stringify({ type: "ping" }));
      missedPongsRef.current += 1;
    }, 90_000); // 90s - CF timeout is supposedly 100s (https://community.cloudflare.com/t/cloudflare-websocket-timeout/5865)
  }, []);

  // ---- Public API ----
  const updateSong = useCallback((songId: string, transposeSteps: number) => {
    if (!isMasterRef.current) return;

    const ws = socketRef.current;

    // If connected, send immediately
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "update-song", songId, transposeSteps }));
      pendingSongUpdateRef.current = null;
    } else {
      // If disconnected (or previously kicked), queue this update and force a reconnect
      console.log(
        "[WS] Disconnected/Kicked. Queuing update and reconnecting..."
      );
      pendingSongUpdateRef.current = songId;
      setRetryTrigger((prev) => prev + 1);
    }
  }, []);

  // ---- WebSocket Lifecycle ----
  useEffect(() => {
    if (!enabled || !masterNickname) return;

    // DEBOUNCE: Wait 100ms before connecting.
    // This prevents "interrupted" errors during React Strict Mode double-mounts
    // or rapid re-renders.
    const connectTimer = setTimeout(() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        `${protocol}//${window.location.host}/api/session/${masterNickname}`
      );
      url.searchParams.set("role", isMaster ? "master" : "follower");

      console.debug(`[WS] Connecting (Attempt ${retryTrigger})...`);
      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      // handlers
      ws.onopen = () => {
        console.debug("[WS] Connected");
        setIsConnected(true);

        // If we reconnected because the user tried to change the song, flush that update now
        if (isMaster && pendingSongUpdateRef.current) {
          console.log("[WS] Flushing queued song update...");
          ws.send(
            JSON.stringify({
              type: "update-song",
              songId: pendingSongUpdateRef.current,
            })
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
          setCurrentSongId(data.songId ?? undefined);
          setCurrentTransposeSteps(data.transposeSteps ?? undefined);
        }

        if (data.type === "master-replaced") {
          toast.info("Session taken over by another device.");
          // We do NOT reconnect automatically here, preventing the "fighting" loop.
          // We only reconnect if the user calls updateSong() again.
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
          console.debug("[WS] Closed. Retrying in 3s...");
          setTimeout(() => setRetryTrigger((prev) => prev + 1), 3000);
        }
      };

      ws.onerror = (error) => {
        // We can't see the details of WS errors in JS, but we can log that it happened
        console.error("[WS] Error occurred", error);
        ws.close();
      };
    }, 100);

    // CLEANUP
    return () => {
      // 1. Clear the timer. If unmounted quickly, `new WebSocket` is never called.
      clearTimeout(connectTimer);

      // 2. Close existing socket if it exists
      if (socketRef.current) {
        socketRef.current.onclose = null; // Prevent retry triggering on cleanup
        socketRef.current.close();
        socketRef.current = null;
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [enabled, masterNickname, isMaster, retryTrigger, resetHeartbeat]);

  // Online/Offline Detection
  useEffect(() => {
    if (!enabled || !masterNickname) return;

    const handleOnline = () => {
      console.debug("[WS] Online detected, reconnecting immediately");
      toast.info(
        `Reconnected: Attempting to ${isMaster ? "broadcast" : "reload feed!"}`
      );
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
  }, [enabled, masterNickname, isMaster]);

  return {
    currentSongId,
    currentTransposeSteps,
    connectedClients,
    updateSong,
    isConnected,
  };
}