import { DurableObject } from "cloudflare:workers";

interface Env { }

// Data we stick to the WebSocket handle
interface SocketMetadata {
    isMaster: boolean;
}

export interface SyncMessage {
    type: "sync";
    songId: string | null;
}

export class SessionSync extends DurableObject<Env> {
    currentSongId: string | null = null;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.ctx.blockConcurrencyWhile(async () => {
            const stored = await this.ctx.storage.get<{ songId: string }>("state");
            this.currentSongId = stored?.songId || null;
        });
    }

    async fetch(request: Request) {
        if (request.headers.get("Upgrade") !== "websocket") {
            return new Response("Upgrade Required", { status: 426 });
        }

        const url = new URL(request.url);
        const isMaster = url.searchParams.get("role") === "master";

        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);

        // Enable hibernation
        this.ctx.acceptWebSocket(server);
        // Attach the role to the socket so we know who's who when they speak or leave
        server.serializeAttachment({ isMaster });

        // Initial Sync: 
        // If you are a follower and master is connected, get the song.
        // If you are the master, get the last song you had (state recovery).
        server.send(JSON.stringify({
            type: "sync",
            songId: this.currentSongId,
            isMaster
        } as SyncMessage));

        return new Response(null, { status: 101, webSocket: client });
    }

    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        const data = JSON.parse(message.toString());
        // handle Ping
        if (data.type === "ping") {
            // We don't even need to reply. 
            // The act of receiving data resets the Cloudflare idle timer.
            return;
        }

        const meta = ws.deserializeAttachment() as SocketMetadata;

        // only process messages from the Master
        if (!meta.isMaster) return;

        try {
            if (data.type === "update-song") {
                // TODO: ensure only one master per session
                this.currentSongId = data.songId;
                await this.ctx.storage.put("state", { songId: data.songId });

                // Broadcast to everyone
                this.broadcast({ type: "sync", songId: this.currentSongId });
            }
        } catch (e) {
            console.error("WS Message Error:", e);
        }
    }

    private broadcast(data: SyncMessage) {
        const msg = JSON.stringify(data);
        for (const ws of this.ctx.getWebSockets()) {
            try {
                ws.send(msg);
            } catch (e) {
                // Handle closed/stale sockets
            }
        }
    }
}