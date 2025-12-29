import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function useSessionSync(
  masterId: string | undefined, 
  isMaster: boolean,
  enabled: boolean = true
) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // Update ref when isMaster changes
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  useEffect(() => {
    // Don't connect if disabled, no masterId, or offline
    if (!enabled || !masterId || !navigator.onLine) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/session/${masterId}`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected as', isMaster ? 'master' : 'follower');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "sync") {
        setCurrentSongId(data.songId ?? undefined);
      } else if (data.type === "master-replaced") {
        console.warn("Master connection replaced:", data.message);
        setIsConnected(false);
        toast.info("Your session has been taken over by another connection.");
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      toast.error("Websocket error. Try reloading the page.");
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setIsConnected(false);
      
      if (isMaster && event.reason === "New master connected") {
        console.warn("Another master connection has taken over");
      }
    };
    
    // Keep the WS alive - Cloudflare closes idle WS after 100s
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 45000);

    socketRef.current = ws;

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.close();
      socketRef.current = null;
    };
  }, [masterId, isMaster, enabled]);

  // Handle online/offline events
  useEffect(() => {
    if (!enabled || !masterId) {
      return;
    }

    const handleOnline = () => {
      console.log('Connection restored, reconnecting WebSocket...');
      toast.info('Connection to feed restored')
      // The main effect will handle reconnection via its dependencies
    };

    const handleOffline = () => {
      console.log('Connection lost');
      toast.warning('Connection to feed lost');
      setIsConnected(false);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, masterId]);

  // Only masters can set the song on their feed
  const updateSong = (songId: string) => {
    if (isMasterRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "update-song", songId }));
      setCurrentSongId(songId);
    }
  };

  return { currentSongId, updateSong, isConnected };
}