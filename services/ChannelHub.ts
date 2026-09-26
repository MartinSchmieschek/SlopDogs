/**
 * ============================================================
 *  CHANNEL HUB — In-Memory-Lobby-Server
 * ============================================================
 *  Haelt Lobby-Raeume im Prozess-Speicher, akzeptiert WebSocket-
 *  Verbindungen und broadcastet Patches an die Mitspieler.
 *
 *  Lebenszyklus eines Channels:
 *    - leer + > TTL_MS ohne Peers  →  wird vom Sweeper entsorgt
 *    - join          →  Peer in Map, Snapshot an den Joinenden, peer-joined an die anderen
 *    - patch         →  shared mergen (replace), peer-patch an alle anderen
 *    - ping          →  pong (lastSeen aktualisieren)
 *    - close/timeout →  peer-left an die anderen
 *
 *  Owner-Schutz: jede WebSocket-Verbindung haelt {channelId, peerId},
 *  die per `join` festgelegt werden. Patches mit fremder peerId werden ignoriert.
 * ============================================================
 */

import type { IncomingMessage, Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import type { ChannelPeer, IChannelHub } from "@slopdogs/core";

interface InternalPeer {
    peerId: string;
    lastSeen: number;
    shared: Record<string, unknown>;
    sockets: Set<any>; // ein Peer kann theoretisch mehrere Tabs haben
}

interface Room {
    peers: Map<string, InternalPeer>;
    /** Wann der Raum zuletzt mindestens 1 Peer hatte (fuer TTL-Sweeper). */
    lastPopulatedAt: number;
}

export interface ChannelHubOptions {
    heartbeatSec?: number;
    /** Empty-Room-TTL in Sekunden — leere Raeume werden danach entsorgt. */
    emptyTtlSec?: number;
    /** Max bytes pro WS-Nachricht. */
    maxMessageBytes?: number;
    /** Max Peers pro Channel. */
    maxPeersPerChannel?: number;
    /** WS-Pfad (Default: /api/channels) */
    path?: string;
}

const DEFAULTS = {
    heartbeatSec: 20,
    emptyTtlSec: 300,
    maxMessageBytes: 16 * 1024,
    maxPeersPerChannel: 50,
    path: "/api/channels",
};

export class ChannelHub implements IChannelHub {
    private rooms = new Map<string, Room>();
    private opts: Required<ChannelHubOptions>;
    private sweeperTimer: NodeJS.Timeout | undefined;

    constructor(opts: ChannelHubOptions = {}) {
        this.opts = {
            heartbeatSec: opts.heartbeatSec ?? DEFAULTS.heartbeatSec,
            emptyTtlSec: opts.emptyTtlSec ?? DEFAULTS.emptyTtlSec,
            maxMessageBytes: opts.maxMessageBytes ?? DEFAULTS.maxMessageBytes,
            maxPeersPerChannel: opts.maxPeersPerChannel ?? DEFAULTS.maxPeersPerChannel,
            path: opts.path ?? DEFAULTS.path,
        };
    }

    // ---------- IChannelHub ----------

    newChannelId(): string {
        // 10-stellige URL-taugliche Id; reicht fuer eine Lobby (kein Geheimnis, nur ein Token).
        const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
        let id = "";
        for (let i = 0; i < 10; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
        // Fallback-Eindeutigkeit: wenn doch Kollision, haengen wir randomUUID-Praefix an.
        if (this.rooms.has(id)) id = id + "-" + randomUUID().slice(0, 8);
        return id;
    }

    joinOrCreate(channelId: string): { created: boolean; peers: ChannelPeer[] } {
        const existed = this.rooms.has(channelId);
        const room = this.getOrCreate(channelId);
        return { created: !existed, peers: this.publicPeers(room) };
    }

    snapshot(channelId: string): ChannelPeer[] {
        const room = this.rooms.get(channelId);
        return room ? this.publicPeers(room) : [];
    }

    heartbeatSec(): number {
        return this.opts.heartbeatSec;
    }

    /** Der Pfad, auf dem dieser Hub lauscht — derselbe, den `attach` prueft. */
    wsPath(): string {
        return this.opts.path;
    }

    // ---------- HTTP/WS attach ----------

    /**
     * Haengt einen WebSocketServer an einen bestehenden http.Server.
     * Lazy-importiert `ws`, damit core unabhaengig bleibt und Tests
     * ohne installiertes ws-Modul laufen koennen.
     */
    async attach(server: HttpServer): Promise<void> {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const wsMod = require("ws");
        const WebSocketServer = wsMod.WebSocketServer ?? wsMod.Server;
        if (!WebSocketServer) throw new Error("ChannelHub.attach: 'ws' Modul ohne WebSocketServer-Export");

        const wss = new WebSocketServer({ noServer: true, maxPayload: this.opts.maxMessageBytes });
        const path = this.opts.path;

        server.on("upgrade", (req: IncomingMessage, socket: any, head: Buffer) => {
            const url = new URL(req.url || "/", "http://x");
            if (url.pathname !== path) return; // andere Upgrade-Handler bedienen sich
            const channelId = (url.searchParams.get("channelId") || "").trim().toLowerCase();
            if (!channelId) {
                socket.write("HTTP/1.1 400 Bad Request\r\n\r\n"); socket.destroy(); return;
            }
            wss.handleUpgrade(req, socket, head, (ws: any) => this.onConnection(ws, channelId));
        });

        // Sweeper laueft jede Minute, kickt tote Peers + entsorgt TTL-faellige Raeume.
        this.sweeperTimer = setInterval(() => this.sweep(), 60 * 1000);
        if (this.sweeperTimer.unref) this.sweeperTimer.unref();
    }

    stop(): void {
        if (this.sweeperTimer) { clearInterval(this.sweeperTimer); this.sweeperTimer = undefined; }
    }

    // ---------- Internals ----------

    private onConnection(ws: any, channelId: string): void {
        const room = this.getOrCreate(channelId);
        let myPeerId: string | undefined; // wird beim 'join' verbindlich gesetzt

        ws.on("message", (raw: Buffer) => {
            let msg: any;
            try { msg = JSON.parse(raw.toString("utf8")); } catch { return; }
            if (!msg || typeof msg !== "object") return;

            switch (msg.type) {
                case "join": {
                    const pid = typeof msg.peerId === "string" ? msg.peerId.slice(0, 64) : "";
                    if (!pid) return;
                    if (room.peers.size >= this.opts.maxPeersPerChannel && !room.peers.has(pid)) {
                        try { ws.close(1013, "channel full"); } catch { /* ignore */ }
                        return;
                    }
                    myPeerId = pid;
                    const shared = sanitizeShared(msg.shared);
                    let peer = room.peers.get(pid);
                    if (!peer) {
                        peer = { peerId: pid, lastSeen: Date.now(), shared, sockets: new Set([ws]) };
                        room.peers.set(pid, peer);
                        this.broadcast(room, ws, { type: "peer-joined", peerId: pid, shared });
                    } else {
                        peer.sockets.add(ws);
                        peer.lastSeen = Date.now();
                        peer.shared = shared;
                        this.broadcast(room, ws, { type: "peer-patch", peerId: pid, shared });
                    }
                    room.lastPopulatedAt = Date.now();
                    // Snapshot an den Joinenden
                    safeSend(ws, { type: "snapshot", peers: this.publicPeers(room) });
                    break;
                }
                case "patch": {
                    if (!myPeerId || msg.peerId !== myPeerId) return; // Owner-Schutz
                    const peer = room.peers.get(myPeerId);
                    if (!peer) return;
                    peer.shared = sanitizeShared(msg.shared);
                    peer.lastSeen = Date.now();
                    this.broadcast(room, ws, { type: "peer-patch", peerId: myPeerId, shared: peer.shared });
                    break;
                }
                case "ping": {
                    if (myPeerId) {
                        const peer = room.peers.get(myPeerId);
                        if (peer) peer.lastSeen = Date.now();
                    }
                    safeSend(ws, { type: "pong" });
                    break;
                }
            }
        });

        const onLeave = () => {
            if (!myPeerId) return;
            const peer = room.peers.get(myPeerId);
            if (!peer) return;
            peer.sockets.delete(ws);
            if (peer.sockets.size === 0) {
                room.peers.delete(myPeerId);
                this.broadcast(room, ws, { type: "peer-left", peerId: myPeerId });
            }
        };
        ws.on("close", onLeave);
        ws.on("error", () => { try { ws.close(); } catch { /* ignore */ } });
    }

    private getOrCreate(channelId: string): Room {
        let room = this.rooms.get(channelId);
        if (!room) {
            room = { peers: new Map(), lastPopulatedAt: Date.now() };
            this.rooms.set(channelId, room);
        }
        return room;
    }

    private publicPeers(room: Room): ChannelPeer[] {
        return Array.from(room.peers.values()).map(p => ({
            peerId: p.peerId, lastSeen: p.lastSeen, shared: p.shared,
        }));
    }

    private broadcast(room: Room, exceptWs: any, msg: any): void {
        const data = JSON.stringify(msg);
        for (const peer of room.peers.values()) {
            for (const s of peer.sockets) {
                if (s === exceptWs) continue;
                try { s.send(data); } catch { /* ignore */ }
            }
        }
    }

    private sweep(): void {
        const now = Date.now();
        const ttlMs = this.opts.emptyTtlSec * 1000;
        const peerMaxIdleMs = this.opts.heartbeatSec * 3 * 1000; // 3x Heartbeat → tot

        for (const [channelId, room] of this.rooms) {
            // Tote Peers entfernen
            for (const [pid, peer] of room.peers) {
                if (peer.sockets.size === 0 && now - peer.lastSeen > peerMaxIdleMs) {
                    room.peers.delete(pid);
                    this.broadcast(room, null, { type: "peer-left", peerId: pid });
                }
            }
            if (room.peers.size > 0) {
                room.lastPopulatedAt = now;
            } else if (now - room.lastPopulatedAt > ttlMs) {
                this.rooms.delete(channelId);
            }
        }
    }
}

function sanitizeShared(v: unknown): Record<string, unknown> {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return v as Record<string, unknown>;
}

function safeSend(ws: any, msg: any): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
}
