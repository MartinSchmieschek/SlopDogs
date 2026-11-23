/**
 * Netzgrenze (PLAN-DOG-PAKETE Spur L2): die Wand vor einem Dienst, in dem jede Anfrage Dog-Code anlegen und
 * laufen lassen darf — lokaler Modus (kein Login) und Dev-Modus (Super-User).
 *
 *   1. Nur im lokalen Modus: der Client muss aus einem privaten/Loopback-Bereich kommen, gelesen an der
 *      SOCKET-Adresse. X-Forwarded-For, CF-* und req.ip zaehlen nie — die schreibt, wer will.
 *   2. Host-Header muss auf der Liste stehen (eigener Hostname, <hostname>.local, Interface-IPs, localhost,
 *      127.0.0.1, [::1], jeweils mit Port; erweiterbar per LOCAL_ALLOWED_HOSTS). Das bricht DNS-Rebinding:
 *      die fremde Seite traegt im Browser ihren eigenen Namen im Host-Header.
 *   3. Schreibende Anfragen (nicht GET/HEAD/OPTIONS) und WebSocket-Upgrades: eine gesetzte Origin muss
 *      dieselbe Liste treffen. Das bricht CSRF per Formular-POST oder fetch von fremden Seiten.
 *   4. CORS-Freigabe nur fuer diese Origins.
 *   5. Ausnahme fuer Kennel-Seiten unter der CSP-Sandbox (opaker Origin): ihr Lobby-Upgrade am Hub-Pfad mit
 *      `Origin: null` geht nur mit einem gueltigen Ticket fuer genau diese channelId durch (ChannelTickets).
 *      Socket-, Proxy- und Host-Pruefung bleiben; eine gesetzte fremde Origin bleibt auch mit Ticket draussen.
 *
 * integration/production (ohne lokalen Modus) bekommen keine Grenze: dort sitzen Cloudflare/Render davor,
 * der Host-Header ist der oeffentliche Name, und der Login ist Pflicht (Exit 78).
 */
import net from 'net';
import os from 'os';
import type { IncomingMessage } from 'http';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { isLanAddress, parseHostEntry } from './LocalMode';
import type { ChannelTickets } from './ChannelTickets';

/** Was die Grenze von einer Anfrage liest — eine Express-Anfrage und ein Upgrade-IncomingMessage passen beide. */
export type BoundaryRequest = {
    method?: string;
    /** Pfad mit Query; Express: originalUrl (die Grenze sitzt an der Wurzel, beides ist gleich). */
    url?: string;
    headers: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string | null } | null;
};

export type BoundaryRejection = {
    error: 'client_not_in_lan' | 'proxied_request' | 'cross_site' | 'host_not_allowed' | 'origin_not_allowed';
    error_description: string;
};

/** Was das Geraet ueber sich weiss — injizierbar, damit Tests ohne echte Schnittstellen laufen. */
export type SystemIdentity = {
    hostname: () => string;
    interfaceAddresses: () => string[];
    /** CIDR der eigenen Schnittstellen (`2001:db8:1:2::5/64`) — fuer globale IPv6 im eigenen Netz. */
    interfaceCidrs?: () => string[];
};

const osInterfaces = () => Object.values(os.networkInterfaces()).flatMap((list) => list ?? []);

const OS_IDENTITY: SystemIdentity = {
    hostname: () => os.hostname(),
    interfaceAddresses: () => osInterfaces().map((entry) => entry.address),
    interfaceCidrs: () =>
        osInterfaces()
            .filter((entry) => !entry.internal && entry.cidr)
            .map((entry) => entry.cidr as string),
};

/**
 * Pfade, die einen Lauf ausloesen oder Daten liefern: API, MCP, Actions, Legacy-Save, oeffentliche Kennels und
 * ihre Swagger-Seiten, Auth. Lokal nimmt die Grenze dort NUR same-origin (oder ohne Sec-Fetch, z. B. curl/AI) an
 * — auch keine Cross-Site-Navigation: ein Link auf einer fremden Seite startet sonst einen Kennel.
 */
const PROTECTED_PREFIXES = ['/api', '/mcp', '/actions', '/save', '/k', '/auth', '/.well-known'] as const;

function isProtectedPath(url: string | undefined): boolean {
    const path = (url || '/').split('?')[0].toLowerCase();
    return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Kleinster Praefix einer eigenen IPv6-Schnittstelle, der als „eigenes Netz" zaehlt — /0../47 waere Fehlkonfiguration. */
const MIN_ON_LINK_IPV6_PREFIX = 48;

/**
 * Globale IPv6 im On-Link-Praefix einer eigenen Schnittstelle (Heimnetz mit GUA, z. B. FritzBox): diese Clients
 * stehen im selben Netz wie der Pi. Gedrosselt neu gelesen, wie die Interface-IPs (Praefixwechsel beim Provider).
 */
class OnLinkIpv6 {
    private blocks = new net.BlockList();
    private readAt = -Infinity;

    constructor(
        private readonly system: SystemIdentity,
        private readonly now: () => number,
    ) {
        this.read();
    }

    contains(raw: string | null | undefined): boolean {
        const address = (raw || '').split('%')[0].toLowerCase();
        if (!net.isIPv6(address) || address.startsWith('::ffff:')) return false;
        if (this.blocks.check(address, 'ipv6')) return true;
        if (this.now() - this.readAt < INTERFACE_REFRESH_MS) return false;
        this.read();
        return this.blocks.check(address, 'ipv6');
    }

    private read(): void {
        const blocks = new net.BlockList();
        for (const cidr of this.system.interfaceCidrs?.() ?? []) {
            const [address, prefixRaw] = cidr.split('/');
            const prefix = Number(prefixRaw);
            if (!net.isIPv6(address) || !Number.isInteger(prefix) || prefix < MIN_ON_LINK_IPV6_PREFIX || prefix > 128) continue;
            blocks.addSubnet(address.split('%')[0], prefix, 'ipv6');
        }
        this.blocks = blocks;
        this.readAt = this.now();
    }
}

/** Wie oft eine unbekannte IP-Adresse im Host-Header die Schnittstellen neu lesen darf (DHCP-Wechsel). */
const INTERFACE_REFRESH_MS = 30_000;

/** Rahmenschutz: keine fremde Seite bettet Kennels oder die UI ein (unsichtbare Laeufe, Clickjacking). */
const FRAME_HEADERS: ReadonlyArray<readonly [string, string]> = [
    ['Content-Security-Policy', "frame-ancestors 'self'"],
    ['X-Frame-Options', 'SAMEORIGIN'],
];

/** Methoden ohne Schreibwirkung — fuer sie entfaellt die Origin-Pruefung (Host- und Socket-Pruefung bleiben). */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** `name:port` in Kleinschreibung; IPv6 in eckigen Klammern. Der Schluessel der erlaubten Liste. */
type HostKey = string;

function hostKey(hostname: string, port: number): HostKey {
    return `${hostname.toLowerCase().replace(/\.$/, '')}:${port}`;
}

/** IPv6-Literal in die Klammer-Form des Host-Headers; Zonen-IDs fallen weg (kein Browser schickt sie). */
function bracketed(address: string): string {
    const bare = address.split('%')[0];
    return bare.includes(':') ? `[${bare}]` : bare;
}

/**
 * Header, die nur ein Proxy, Tunnel oder CDN setzt (ngrok, cloudflared, Tailscale Funnel, nginx …). Der lokale
 * Modus laeuft nie dahinter: ein Tunnel auf dem Pi verbindet von 127.0.0.1 und kann den Host-Header auf
 * `localhost` umschreiben — Socket- und Host-Pruefung saehen dann eine lokale Anfrage aus dem Internet.
 */
const PROXY_HEADERS = [
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'forwarded',
    'via',
    'x-real-ip',
    'cf-connecting-ip',
    'cf-ray',
    'true-client-ip',
];
const PROXY_HEADER_PREFIXES = ['tailscale-', 'ngrok-'];

function carriesProxyHeader(headers: BoundaryRequest['headers']): boolean {
    return Object.keys(headers).some((name) => {
        const lower = name.toLowerCase();
        return PROXY_HEADERS.includes(lower) || PROXY_HEADER_PREFIXES.some((p) => lower.startsWith(p));
    });
}

function parseOrigin(raw: string): { hostname: string; port: number } | null {
    try {
        const url = new URL(raw);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (url.username || url.password) return null;
        const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
        return { hostname: url.hostname, port };
    } catch {
        return null;
    }
}

function headerValue(headers: BoundaryRequest['headers'], name: string): string | undefined {
    const value = headers[name];
    return Array.isArray(value) ? value[0] : value;
}

/** Liste der Hosts, unter denen dieser Dienst erreichbar sein darf. */
export class AllowedHosts {
    private interfaceKeys = new Set<HostKey>();
    private interfacesReadAt = 0;

    private constructor(
        private readonly fixedKeys: ReadonlySet<HostKey>,
        private readonly ports: readonly number[],
        private readonly system: SystemIdentity,
        private readonly now: () => number,
    ) {
        this.readInterfaces();
    }

    /**
     * Defaults: `os.hostname()`, `<hostname>.local`, alle Interface-IPs, `localhost`, `127.0.0.1`, `[::1]` —
     * jeweils mit jedem Port aus `ports`. `extra` (LOCAL_ALLOWED_HOSTS): `name` gilt mit diesen Ports,
     * `name:port` genau so.
     */
    static of(
        ports: readonly number[],
        extra: readonly string[] = [],
        system: SystemIdentity = OS_IDENTITY,
        now: () => number = Date.now,
    ): AllowedHosts {
        const hostname = system.hostname().trim().toLowerCase();
        const names = ['localhost', '127.0.0.1', '[::1]', ...(hostname ? [hostname, `${hostname}.local`] : [])];
        const keys = new Set<HostKey>();
        for (const name of names) for (const port of ports) keys.add(hostKey(name, port));
        for (const entry of extra) {
            const parsed = parseHostEntry(entry);
            if (!parsed) throw new Error(`LOCAL_ALLOWED_HOSTS: "${entry}" is not a host or host:port`);
            if (parsed.explicitPort) keys.add(hostKey(parsed.hostname, parsed.port));
            else for (const port of ports) keys.add(hostKey(parsed.hostname, port));
        }
        return new AllowedHosts(keys, ports, system, now);
    }

    /** Kommagetrennte Liste aus der Env, leere Eintraege fallen weg. */
    static parseList(raw: string | undefined): string[] {
        return (raw || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    admitsHostHeader(raw: string | undefined): boolean {
        if (!raw) return false;
        const parsed = parseHostEntry(raw);
        return parsed !== null && this.admits(parsed.hostname, parsed.port);
    }

    admitsOrigin(raw: string): boolean {
        const parsed = parseOrigin(raw);
        return parsed !== null && this.admits(parsed.hostname, parsed.port);
    }

    private admits(hostname: string, port: number): boolean {
        const key = hostKey(hostname, port);
        if (this.fixedKeys.has(key) || this.interfaceKeys.has(key)) return true;
        // Ein unbekanntes IP-Literal kann eine frisch per DHCP vergebene eigene Adresse sein — gedrosselt neu lesen.
        const literal = /^\[|^\d+\.\d+\.\d+\.\d+$/.test(hostname);
        if (literal && this.now() - this.interfacesReadAt >= INTERFACE_REFRESH_MS) {
            this.readInterfaces();
            return this.interfaceKeys.has(key);
        }
        return false;
    }

    private readInterfaces(): void {
        const keys = new Set<HostKey>();
        for (const address of this.system.interfaceAddresses()) {
            for (const port of this.ports) keys.add(hostKey(bracketed(address), port));
        }
        this.interfaceKeys = keys;
        this.interfacesReadAt = this.now();
    }
}

export class NetworkBoundary {
    constructor(
        private readonly hosts: AllowedHosts,
        /** Nur der lokale Modus: Clients ausserhalb privater/Loopback-Bereiche sind draussen, Cross-Site-Regeln greifen. */
        private readonly lanClientsOnly: boolean,
        /** Dev: CORS_ALLOWED_ORIGINS — was CORS freigibt, darf auch schreiben. */
        private readonly extraOrigins: readonly string[] = [],
        /** Lokal: globale IPv6 im On-Link-Praefix der eigenen Schnittstellen gilt als LAN. */
        private readonly onLinkIpv6: OnLinkIpv6 | null = null,
        /** Tickets der Lobby-Upgrades von Kennel-Seiten mit opakem Origin; null = `Origin: null` nie zulassen. */
        private readonly channelTickets: ChannelTickets | null = null,
    ) {}

    /** Name der Middleware im Express-Stack — der StartupTest prueft, dass sie die erste eigene ist. */
    static readonly MIDDLEWARE_NAME = 'networkBoundary';

    /**
     * Die Grenze fuer diese Umgebung, oder null, wo es keine gibt (integration/production ohne lokalen Modus).
     * Wirft bei einem unlesbaren LOCAL_ALLOWED_HOSTS-Eintrag — der Start bricht dann ab, statt still zu oeffnen.
     */
    static forEnvironment(
        env: NodeJS.ProcessEnv,
        mode: { nodeEnv: string; localMode: boolean; devUiOrigin?: string; channelTickets?: ChannelTickets },
        system: SystemIdentity = OS_IDENTITY,
        now: () => number = Date.now,
    ): NetworkBoundary | null {
        const deployed = mode.nodeEnv === 'production' || mode.nodeEnv === 'integration';
        if (deployed && !mode.localMode) return null;

        const serverPort = Number(env.PORT) || 3000;
        const ports = new Set<number>([serverPort]);
        if (!mode.localMode && mode.devUiOrigin) {
            // Dev: die UI unter ng serve (DEV_UI_ORIGIN, Default :4300) ruft die API direkt und ueber den Proxy.
            const devUi = parseOrigin(mode.devUiOrigin);
            if (devUi) ports.add(devUi.port);
        }
        const extraHosts = AllowedHosts.parseList(env.LOCAL_ALLOWED_HOSTS);
        // Lokal: der Host einer gesetzten PUBLIC_API_BASE_URL ist in die UI eingebacken — er muss auch durch.
        // (Der Boot-Guard hat ihn schon als nicht oeffentlich geprueft.)
        const bakedBase = mode.localMode ? parseOrigin((env.PUBLIC_API_BASE_URL || '').trim()) : null;
        if (bakedBase) extraHosts.push(`${bakedBase.hostname}:${bakedBase.port}`);
        const hosts = AllowedHosts.of([...ports], extraHosts, system, now);
        const extraOrigins = mode.localMode ? [] : AllowedHosts.parseList(env.CORS_ALLOWED_ORIGINS);
        return new NetworkBoundary(
            hosts,
            mode.localMode,
            extraOrigins,
            mode.localMode ? new OnLinkIpv6(system, now) : null,
            mode.channelTickets ?? null,
        );
    }

    /** Null = durchlassen; sonst der Grund der Abweisung. Rein bis auf das gedrosselte Neulesen der Schnittstellen. */
    verdict(req: BoundaryRequest, isUpgrade = false): BoundaryRejection | null {
        const writes = isUpgrade || !SAFE_METHODS.has((req.method || 'GET').toUpperCase());
        const origin = headerValue(req.headers, 'origin');
        const ticketed = isUpgrade && this.isTicketedOpaqueUpgrade(req, origin);
        if (this.lanClientsOnly) {
            const local = this.localRejection(req, isUpgrade, writes, ticketed);
            if (local) return local;
        }
        if (!this.hosts.admitsHostHeader(headerValue(req.headers, 'host'))) {
            return {
                error: 'host_not_allowed',
                error_description: "Host header is not one of this server's names (LOCAL_ALLOWED_HOSTS extends the list).",
            };
        }
        if (writes && origin !== undefined && !ticketed && !this.admitsOrigin(origin)) {
            return { error: 'origin_not_allowed', error_description: "Origin is not one of this server's names." };
        }
        return null;
    }

    /** Die Origin, die CORS freigeben darf, oder undefined. */
    corsOriginFor(origin: string | undefined): string | undefined {
        return origin !== undefined && this.admitsOrigin(origin) ? origin : undefined;
    }

    /**
     * Vor allen anderen Middlewares montieren: 403 mit knapper JSON-Fehlermeldung. Jede Antwort traegt den
     * Rahmenschutz (frame-ancestors 'self' — die eigene UI darf sich weiter selbst einbetten).
     */
    middleware(): RequestHandler {
        const networkBoundary = (req: Request, res: Response, next: NextFunction) => {
            for (const [name, value] of FRAME_HEADERS) res.setHeader(name, value);
            const rejection = this.verdict({
                method: req.method,
                url: req.originalUrl ?? req.url,
                headers: req.headers,
                socket: req.socket,
            });
            if (!rejection) {
                next();
                return;
            }
            res.status(403).json(rejection);
        };
        return networkBoundary;
    }

    /** Fuer den WebSocket-Upgrade (ChannelHub): dieselbe Pruefung, Origin immer. */
    admitsUpgrade(req: IncomingMessage): boolean {
        return this.verdict(req, true) === null;
    }

    /**
     * Nur lokal: Socket-Adresse, Proxy-Header, Sec-Fetch. Ohne Sec-Fetch (curl, AI-Clients, alte Browser) gelten
     * allein Host- und Origin-Pruefung — siehe README „SlopDogs auf dem Pi", Restluecke.
     */
    private localRejection(req: BoundaryRequest, isUpgrade: boolean, writes: boolean, ticketed: boolean): BoundaryRejection | null {
        const address = req.socket?.remoteAddress;
        if (!isLanAddress(address) && !this.onLinkIpv6?.contains(address)) {
            return { error: 'client_not_in_lan', error_description: 'This server only answers clients in the local network.' };
        }
        if (carriesProxyHeader(req.headers)) {
            return { error: 'proxied_request', error_description: 'Local mode never runs behind a proxy or tunnel.' };
        }
        const site = headerValue(req.headers, 'sec-fetch-site');
        if (site === undefined || site === 'same-origin' || site === 'none') return null;
        // Die Sandbox-Seite meldet sich mit opakem Origin als cross-site; das Ticket belegt die eigene Lobby.
        if (ticketed) return null;
        const crossSite: BoundaryRejection = {
            error: 'cross_site',
            error_description: 'Cross-site requests are not accepted in local mode.',
        };
        // Schreiben, Upgrades und alles, was einen Lauf ausloest oder Daten liefert: nur same-origin — auch nicht
        // same-site (ein anderer Dienst auf dem Pi) und auch keine Cross-Site-Navigation.
        if (writes || isUpgrade || isProtectedPath(req.url)) return crossSite;
        if (site === 'same-site') return null;
        // UI-Seiten: nur die sichtbare Top-Level-Navigation (Link, Lesezeichen) — kein iframe/object/embed/img/fetch.
        const visibleNavigation =
            headerValue(req.headers, 'sec-fetch-mode') === 'navigate' && headerValue(req.headers, 'sec-fetch-dest') === 'document';
        return visibleNavigation ? null : crossSite;
    }

    /**
     * Lobby-Upgrade einer Kennel-Seite unter der Sandbox: genau `Origin: null`, am Hub-Pfad, mit gueltigem und
     * nicht abgelaufenem Ticket fuer die angefragte channelId. Jede andere Origin entscheidet die normale Pruefung.
     */
    private isTicketedOpaqueUpgrade(req: BoundaryRequest, origin: string | undefined): boolean {
        return origin === 'null' && this.channelTickets !== null && this.channelTickets.admitsUpgradeUrl(req.url);
    }

    private admitsOrigin(origin: string): boolean {
        return this.extraOrigins.includes(origin) || this.hosts.admitsOrigin(origin);
    }
}
