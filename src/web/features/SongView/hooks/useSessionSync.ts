import { useState, useEffect, useRef } from 'react';
import { SyncMessage } from 'src/worker/durable-objects/SessionSync';

export function useSessionSync(masterId: string | undefined, isMaster: boolean) {
  const [currentSongId, setCurrentSongId] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const isMasterRef = useRef(isMaster);

  if(masterId === undefined) {
    throw new Error("masterId is required for useSessionSync");
  }
  // Update ref when isMaster changes
  useEffect(() => {
    isMasterRef.current = isMaster;
  }, [isMaster]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // TODO: replace with Hono API
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/session/${masterId}`);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as SyncMessage;
      if (data.type === "sync") {
        setCurrentSongId(data.songId ?? undefined);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsConnected(false);
    };
    // keep the WS alive - Cloudflare closes idle WS after 100s and opening a new one counts as another worker call
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 45000);

    socketRef.current = ws;

    return () => {
      clearInterval(pingInterval);
      ws.close();
    };
  }, [masterId]);

  // only masters can set the song on their feed
  const updateSong = (songId: string) => {
    if (isMaster && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "update-song", songId }));
      setCurrentSongId(songId);
    }
  };

  return { currentSongId, updateSong, isConnected };
}