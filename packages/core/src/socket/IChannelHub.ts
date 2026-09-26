/**
 * ============================================================
 *  CHANNEL HUB — Vertrag zwischen Socket-Dog und Hub-Service
 * ============================================================
 *
 *  Der Hub lebt ausserhalb von core (z. B. services/ChannelHub.ts)
 *  und wird per `WebSocketChannelRetriever.initService(hub)` gebunden.
 *  So bleibt core frei von ws/http-Abhaengigkeiten.
 * ============================================================
 */

/** Ein Teilnehmer einer Lobby — eigenes shared-Objekt, das nur er selbst mutiert. */
export interface ChannelPeer {
    /** Peer-Identitaet (Client erzeugt, persistiert per sessionStorage) */
    peerId: string;
    /** Letzte Lebenszeichen-Zeit in ms seit Epoch (heartbeat / patch / join) */
    lastSeen: number;
    /** Frei wuehlbares Datenobjekt — andere Peers lesen nur, der Owner schreibt. */
    shared: Record<string, unknown>;
}

/** Stand eines Channels zum Zeitpunkt des Hunts. */
export interface ChannelState {
    /** Eindeutige Channel-Id (vom Caller geliefert oder vom Hub erzeugt). */
    channelId: string;
    /** True, wenn der Channel mit diesem Aufruf neu entstanden ist. */
    created: boolean;
    /**
     * WebSocket-Pfad ODER absolute URL fuer die Live-Verbindung.
     * - Ohne PUBLIC_API_BASE_URL: relativer Pfad (z. B. "/api/channels?channelId=xyz") —
     *   der Client setzt Protokoll/Host aus `location` davor.
     * - Mit PUBLIC_API_BASE_URL: absolute ws(s)://-URL.
     * Der Share-Link wird NICHT vom Dog erzeugt — der Client baut ihn aus
     * `location.origin + location.pathname + channelQuery`,
     * damit jeder Kennel der den Dog einbindet, seinen eigenen Pfad teilen kann.
     */
    wsUrl: string;
    /** Name des Query-Parameters, der die Einladung in eine Lobby traegt. */
    channelParam: "channelId";
    /**
     * Fertiger Einladungs-Query: `"?channelId=" + encodeURIComponent(channelId)`.
     * Immer gefuellt — auch wenn die Lobby mit diesem Aufruf frisch und zufaellig entstanden ist.
     */
    channelQuery: string;
    /** Aktuelle Teilnehmer inkl. ihrer shared-Objekte (zum Snapshot-Zeitpunkt). */
    peers: ChannelPeer[];
    /** Empfohlenes Heartbeat-Intervall in Sekunden fuer Clients. */
    heartbeatSec: number;
}

/**
 * Vertrag des Hub-Service. Der Hub haelt In-Memory-Raeume,
 * verwaltet Heartbeats/TTL und broadcastet Patches.
 */
export interface IChannelHub {
    /** Liefert eine neue, kurze Channel-Id (URL-tauglich). */
    newChannelId(): string;
    /** Joint einen Channel oder erzeugt ihn, wenn er nicht existiert. */
    joinOrCreate(channelId: string): { created: boolean; peers: ChannelPeer[] };
    /** Aktueller Snapshot aller Peers. Leeres Array, wenn der Channel nicht existiert. */
    snapshot(channelId: string): ChannelPeer[];
    /** Empfohlenes Heartbeat-Intervall in Sekunden. */
    heartbeatSec(): number;
    /**
     * Der Pfad, auf dem der Hub den Upgrade annimmt (z. B. "/api/channels").
     * EINZIGE Quelle der Wahrheit: der Dog baut seine wsUrl daraus, statt den Pfad
     * ein zweites Mal aus der Umgebung zu erraten.
     */
    wsPath(): string;
}
