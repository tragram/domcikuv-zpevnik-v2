import { useState, useEffect, useRef } from 'react';
import { SyncMessage } from 'src/worker/durable-objects/SessionSync';

export function useSessionSync(masterId: string | undefined, isMaster: boolean) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if(masterId === undefined) {
    throw new Error("masterId is required for useSessionSync");
  }
  
  // Update ref when isMaster changes
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  useEffect(() => {
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
        // The socket will be closed by the server shortly
        setIsConnected(false);
        // Optionally: show a notification to the user
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code, event.reason);
      setIsConnected(false);
      
      // If we're the master and got disconnected by another master, show a message
      if (isMaster && event.reason === "New master connected") {
        console.warn("Another master connection has taken over");
        // Optionally: you could show a toast/notification to the user here
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
    };
  }, [masterId, isMaster]);

  // Only masters can set the song on their feed
  const updateSong = (songId: string) => {
    if (isMasterRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "update-song", songId }));
      setCurrentSongId(songId);
    }
  };

  return { currentSongId, updateSong, isConnected };
}