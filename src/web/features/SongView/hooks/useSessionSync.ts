import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export function useSessionSync(
  masterId: string | undefined,
  isMaster: boolean,
  enabled: boolean = true
) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>();
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

  // ---- Public API ----
  const updateSong = useCallback((songId: string) => {
    if (!isMasterRef.current) return;

    const ws = socketRef.current;

    // If connected, send immediately
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "update-song", songId }));
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
    if (!enabled || !masterId) return;

    // DEBOUNCE: Wait 100ms before connecting.
    // This prevents "interrupted" errors during React Strict Mode double-mounts
    // or rapid re-renders.
    const connectTimer = setTimeout(() => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = new URL(
        `${protocol}//${window.location.host}/api/session/${masterId}`
      );
      url.searchParams.set("role", isMaster ? "master" : "follower");

      console.debug(`[WS] Connecting (Attempt ${retryTrigger})...`);
      const ws = new WebSocket(url.toString());
      socketRef.current = ws;

      // handlers
      ws.onopen = () => {
        console.debug("[WS] Connected");
        setIsConnected(true);
        missedPongsRef.current = 0;

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

        // Heartbeat
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (missedPongsRef.current >= 3) {
            console.warn("[WS] Connection dead (no pong), forcing reconnect");
            ws.close();
            return;
          }
          ws.send(JSON.stringify({ type: "ping" }));
          missedPongsRef.current += 1;
        }, 5000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "pong") {
          missedPongsRef.current = 0;
          return;
        }

        if (data.type === "sync") {
          // If we have a pending update (user clicked something while connecting),
          // ignore the server's old state so the UI doesn't flicker back.
          if (isMaster && pendingSongUpdateRef.current) return;
          setCurrentSongId(data.songId ?? undefined);
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
  }, [enabled, masterId, isMaster, retryTrigger]);

  // Online/Offline Detection
  useEffect(() => {
    if (!enabled || !masterId) return;

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
  }, [enabled, masterId, isMaster]);

  return { currentSongId, updateSong, isConnected };
}
