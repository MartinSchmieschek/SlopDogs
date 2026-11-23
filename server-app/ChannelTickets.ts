// ChannelTickets — Verbindungs-Tickets fuer Lobby-WebSockets von Kennel-Seiten unter der CSP-Sandbox (fix/k-sandbox).
//
// Eine Kennel-Seite unter `/k/` laeuft mit opakem Origin: ihr WebSocket-Upgrade auf den ChannelHub traegt
// `Origin: null` und keinen Referer. Daran allein ist sie nicht von einer fremden Seite mit sandboxed iframe zu
// unterscheiden. Deshalb stellt der Server beim Kennel-Lauf (WebSocketChannelRetriever) ein Ticket aus, das die
// wsUrl als Query-Parameter traegt; die Netzgrenze (NetworkBoundary) laesst `Origin: null` am Hub-Pfad nur mit
// einem gueltigen Ticket fuer genau diese channelId zu.
//
// Form: `<ablauf in s seit Epoch>.<HMAC-SHA256 base64url>` ueber Version, channelId (normalisiert wie im Hub:
// trim + klein) und Ablauf. Der Schluessel entsteht je Prozess zufaellig, liegt nur in einem privaten Feld und
// verlaesst den Prozess nie (keine Env, kein Log, keine Antwort); ein Neustart macht alle Tickets ungueltig.
// Verglichen wird in konstanter Zeit.
//
// Laufzeit 12 h: die Lobby-Seite (ChannelLiveSnippetRetriever und eigene Clients aus der wsUrl) verbindet bei
// jedem Abbruch mit derselben, beim Lauf eingebetteten wsUrl neu (Backoff bis 15 s). Das Ticket muss also so
// lange halten, wie eine Seite offen bleibt — ein Spieleabend, ein Termin, ein Tag am Bildschirm. Laeuft es ab,
// verbindet die Seite erst nach einem Neuladen wieder (neuer Lauf, neues Ticket). Kuerzer hiesse Abbrueche
// mitten in der Sitzung; laenger verlaengert nur, wie lange ein einmal ausgeliefertes Ticket genuegt.
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { IChannelTicketIssuer } from '@martinschmieschek/slopdogs-core/runtime';

const VERSION = 'v1';
const MAC_BYTES = 32;
/** `<ablauf>.<mac>`: Ablauf in ganzen Sekunden, MAC als base64url ohne Auffuellung (32 Byte -> 43 Zeichen). */
const TICKET_FORM = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

export class ChannelTickets implements IChannelTicketIssuer {
    static readonly PARAM = 'ticket';
    static readonly DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

    readonly param = ChannelTickets.PARAM;
    readonly #key: Buffer = randomBytes(32);

    constructor(
        /** Der Pfad des ChannelHub (WS_PATH, Default /api/channels) — nur dort gilt ein Ticket. */
        readonly wsPath: string,
        private readonly ttlMs: number = ChannelTickets.DEFAULT_TTL_MS,
        private readonly now: () => number = Date.now,
    ) {}

    /** Dieselbe Normalisierung wie der ChannelHub beim Upgrade. */
    static normalize(channelId: string): string {
        return channelId.trim().toLowerCase();
    }

    issue(channelId: string): string {
        const expiresAt = Math.floor((this.now() + this.ttlMs) / 1000);
        return `${expiresAt}.${this.mac(ChannelTickets.normalize(channelId), expiresAt).toString('base64url')}`;
    }

    /** Gueltig, nicht abgelaufen und fuer genau diese channelId ausgestellt? */
    verify(channelId: string, ticket: string | null | undefined): boolean {
        const normalized = ChannelTickets.normalize(channelId);
        if (!normalized || typeof ticket !== 'string') return false;
        const match = TICKET_FORM.exec(ticket);
        if (!match) return false;
        const expiresAt = Number(match[1]);
        if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= this.now()) return false;
        const given = Buffer.from(match[2], 'base64url');
        // Nur die kanonische Schreibweise: base64url verwirft die letzten zwei Bit, zwei Schreibweisen waeren sonst gleich.
        if (given.length !== MAC_BYTES || given.toString('base64url') !== match[2]) return false;
        return timingSafeEqual(given, this.mac(normalized, expiresAt));
    }

    /**
     * Fuer die Netzgrenze: traegt dieser Upgrade-Pfad (mit Query) ein gueltiges Ticket fuer seine channelId?
     * Pfad und channelId liest sie wie der ChannelHub (exakter Pfad, erster channelId-Parameter).
     */
    admitsUpgradeUrl(rawUrl: string | undefined): boolean {
        let url: URL;
        try {
            url = new URL(rawUrl || '/', 'http://x');
        } catch {
            return false;
        }
        if (url.pathname !== this.wsPath) return false;
        return this.verify(url.searchParams.get('channelId') || '', url.searchParams.get(this.param));
    }

    private mac(normalizedChannelId: string, expiresAt: number): Buffer {
        return createHmac('sha256', this.#key).update(`${VERSION}\n${expiresAt}\n${normalizedChannelId}`).digest();
    }
}
