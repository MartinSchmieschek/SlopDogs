/**
 * ~~~ CLIENT ADDRESS — wer ruft wirklich an? ~~~
 *
 * Auf Render liegen zwei Proxys vor der App: Renders Cloudflare-Kante und ein Render-interner Hop (10.x).
 * Cloudflare HAENGT an X-Forwarded-For an (ueberschreibt nicht), Render haengt noch einmal an. Mit
 * `trust proxy = 1` ist `req.ip` deshalb der RECHTESTE Eintrag — die Cloudflare-Kante oder der 10.x-Hop,
 * nie der Client. Die Zahl der Eintraege ist nicht stabil (2 oder 3), Hops zaehlen hilft also nicht.
 *
 * Verlaesslich ist `CF-Connecting-IP`: Cloudflare setzt ihn bei jeder Anfrage selbst, ein vom Client
 * mitgeschickter Wert wird von Cloudflare mit 403 abgewiesen. Dieser Header wird nur gelesen, wenn er
 * eingeschaltet ist (CLIENT_IP_HEADER; Default `cf-connecting-ip` nur bei RENDER=true), und nur, wenn er
 * genau EINE gueltige IP traegt. Sonst gilt `req.ip` wie bisher (TRUST_PROXY_HOPS), lokal die Socket-Adresse.
 *
 * Der Schluessel einer Adresse fuer die Sperre je Quelle: IPv4 voll, IPv6 auf /64 (ein Haushalt = ein Praefix).
 */

import { isIP } from 'net';
import type { RequestHandler } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

/** Form der letzten anonymen Lauf-Anfrage — nur Zahlen und Schalter, keine Adressen. */
export interface AnonymousRequestShape {
    /** Anzahl der Eintraege in X-Forwarded-For (0 = Header fehlt). */
    xffEntries: number;
    hasCfConnectingIp: boolean;
    /** CF-Connecting-IP traegt genau eine gueltige IP. */
    cfConnectingIpValid: boolean;
    /** Name des Headers, aus dem die Client-IP kam; null = `req.ip`. */
    usedHeader: string | null;
    observedAt: string;
}

/** Was die Klasse von einem Request braucht (Express-Request oder Test-Attrappe). */
export interface ClientRequestLike {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
}

export class ClientAddress {
    static readonly CLOUDFLARE_HEADER = 'cf-connecting-ip';
    /** Praefixlaenge, auf die IPv6-Adressen fuer den Schluessel gekuerzt werden. */
    static readonly IPV6_PREFIX = 64;

    private lastShape: AnonymousRequestShape | null = null;

    /** @param header Kleingeschriebener Header-Name oder null (aus). */
    constructor(readonly header: string | null) {}

    /**
     * CLIENT_IP_HEADER gesetzt (auch leer) -> dieser Wert (leer = aus). Nicht gesetzt -> `cf-connecting-ip`
     * nur auf Render (RENDER=true, setzt die Plattform immer), sonst aus.
     */
    static headerFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
        const raw = env.CLIENT_IP_HEADER;
        if (raw !== undefined) {
            const name = raw.trim().toLowerCase();
            return name === '' ? null : name;
        }
        return env.RENDER === 'true' ? ClientAddress.CLOUDFLARE_HEADER : null;
    }

    static fromEnv(env: NodeJS.ProcessEnv = process.env): ClientAddress {
        return new ClientAddress(ClientAddress.headerFromEnv(env));
    }

    /** Genau eine gueltige IP (kein Komma, keine Liste) — sonst null. */
    static singleIp(value: string | string[] | undefined): string | null {
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (trimmed === '' || trimmed.includes(',')) return null;
        return isIP(trimmed) === 0 ? null : trimmed;
    }

    /** Schluessel fuer die Sperre je Quelle: IPv4 voll, IPv4-in-IPv6 als IPv4, IPv6 auf /64. */
    static keyOf(ip: string): string {
        return ipKeyGenerator(ip, ClientAddress.IPV6_PREFIX);
    }

    /** Die Client-IP: der eingeschaltete Header, wenn gueltig; sonst `req.ip`; sonst die Socket-Adresse. */
    ipOf(req: ClientRequestLike): string | null {
        return this.fromHeader(req) ?? req.ip ?? req.socket?.remoteAddress ?? null;
    }

    /** Merkt sich die Form einer anonymen Lauf-Anfrage fuer health_check (ohne Adressen). */
    observeAnonymous(req: ClientRequestLike, now: Date = new Date()): void {
        const cf = req.headers?.[ClientAddress.CLOUDFLARE_HEADER];
        this.lastShape = {
            xffEntries: ClientAddress.countForwarded(req.headers?.['x-forwarded-for']),
            hasCfConnectingIp: cf !== undefined,
            cfConnectingIpValid: ClientAddress.singleIp(cf) !== null,
            usedHeader: this.fromHeader(req) !== null ? this.header : null,
            observedAt: now.toISOString(),
        };
    }

    get lastAnonymousShape(): AnonymousRequestShape | null {
        return this.lastShape ? { ...this.lastShape } : null;
    }

    /**
     * Haengt die Client-IP an den Auth-Kontext (`req.ctx.clientIp`) — damit In-Process-Laeufe (MCP/Actions),
     * die nur den Kontext kennen, dieselbe Quelle bekommen wie HTTP. Nach der Auth-Kontext-Middleware montieren.
     */
    contextMiddleware(): RequestHandler {
        return (req, _res, next) => {
            if (req.ctx) req.ctx.clientIp = this.ipOf(req as ClientRequestLike);
            next();
        };
    }

    private fromHeader(req: ClientRequestLike): string | null {
        if (!this.header) return null;
        return ClientAddress.singleIp(req.headers?.[this.header]);
    }

    private static countForwarded(value: string | string[] | undefined): number {
        if (value === undefined) return 0;
        const joined = Array.isArray(value) ? value.join(',') : value;
        return joined.split(',').filter((part) => part.trim() !== '').length;
    }
}
