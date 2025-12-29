import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export function useSessionSync(
  masterId: string | undefined,
  isMaster: boolean,
  enabled: boolean = true
) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>();
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);
  const pendingSongIdRef = useRef<string | undefined>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  
  // Keep role ref fresh for WS callbacks
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  // ---- send update to server ----
  const sendSongUpdate = useCallback((songId: string) => {
    console.debug("[WS] Sending song update:", songId);
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send update, socket not open. State:", ws?.readyState);
      return;
    }

    ws.send(JSON.stringify({ type: "update-song", songId }));
    pendingSongIdRef.current = undefined;
  }, []);

  // master update
  const updateSong = useCallback(
    (songId: string) => {
      if (!isMasterRef.current) {
        console.warn("[WS] updateSong called but not master");
        return;
      }

      console.debug("[WS] Master queuing song update:", songId);
      pendingSongIdRef.current = songId;
      setCurrentSongId(songId);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        sendSongUpdate(songId);
      } else {
        console.debug("[WS] Socket not ready, update queued");
      }
    },
    [sendSongUpdate]
  );

  // ---- WebSocket lifecycle ----
  useEffect(() => {
    if (!enabled || !masterId) {
      console.debug("[WS] Session sync disabled or no masterId");
      return;
    }

    console.debug("[WS] Initializing WebSocket for masterId:", masterId, "isMaster:", isMaster);

    // Clear any existing connection first
    if (socketRef.current) {
      console.debug("[WS] Closing existing socket before creating new one");
      socketRef.current.close();
      socketRef.current = null;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/session/${masterId}`;
    console.debug("[WS] Connecting to:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.debug("[WS] Connected as", isMasterRef.current ? "master" : "follower");
      setIsConnected(true);

      // Start ping interval to keep connection alive
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          console.debug("[WS] Sending keepalive ping");
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 10_000); // Every 10 seconds

      // Re-push pending state if we are master
      if (isMasterRef.current && pendingSongIdRef.current) {
        console.debug("[WS] Sending pending update:", pendingSongIdRef.current);
        sendSongUpdate(pendingSongIdRef.current);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.debug("[WS] Message received:", data);

      if (data.type === "sync") {
        const songId = data.songId ?? undefined;
        
        setCurrentSongId((prevSongId) => {
          if (prevSongId === songId) {
            console.debug("[WS] Song ID unchanged:", songId);
            return prevSongId;
          }
          console.debug("[WS] Updating song ID:", prevSongId, "->", songId);
          return songId;
        });

        // Clear pending if this confirms our update
        if (pendingSongIdRef.current === songId) {
          console.debug("[WS] Pending update confirmed");
          pendingSongIdRef.current = undefined;
        }
      }

      if (data.type === "master-replaced") {
        console.warn("[WS] Master replaced by another connection");
        setIsConnected(false);
        toast.info("Your session has been taken over by another connection.");
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      setIsConnected(false);
      toast.error("WebSocket error. Connection will retry.");
    };

    ws.onclose = (event) => {
      console.log("[WS] Closed. Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
      setIsConnected(false);

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Only attempt reconnect if this is still the current socket and we're still enabled
      if (socketRef.current === ws && enabled) {
        // Don't reconnect if intentionally closed by new master
        if (event.reason === "New master connected") {
          console.warn("[WS] Not reconnecting - replaced by new master");
          return;
        }

        console.debug("[WS] Scheduling reconnect in 2 seconds...");
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.debug("[WS] Attempting reconnect...");
          // This will trigger the effect to run again
          socketRef.current = null;
        }, 2000);
      }
    };

    // Cleanup function
    return () => {
      console.debug("[WS] Cleanup: closing connection");
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Only close if this effect owns the socket
      if (socketRef.current === ws) {
        ws.close();
        socketRef.current = null;
      }
    };
  }, [enabled, masterId, isMaster, sendSongUpdate]);

  // ---- Online / Offline notifications ----
  useEffect(() => {
    if (!enabled || !masterId) return;

    const handleOffline = () => {
      setIsConnected(false);
      console.warn("[WS] Browser went offline");
      toast.warning("Connection to feed lost");
    };

    const handleOnline = () => {
      console.info("[WS] Browser back online");
      toast.info("Connection to feed restored");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, masterId]);

  return { currentSongId, updateSong, isConnected };
}