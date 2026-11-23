/**
 * Lokaler Modus (PLAN-DOG-PAKETE Spur L): SlopDogs auf einem Pi im Heimnetz, ohne Login, PAT oder OAuth —
 * jedes Geraet im LAN nutzt UI und MCP als ein gemeinsamer lokaler Nutzer.
 *
 * Eingeschaltet NUR ausdruecklich: `SLOPDOGS_MODE=local` neben `NODE_ENV=production`. Kein drittes NODE_ENV
 * (`.env.local` ist schon eine Schicht von load-env.cjs, und alle Weichen fragen development vs.
 * production/integration). Nie aus „Auth fehlt" abgeleitet.
 *
 * Bewusst getragenes Risiko (10-0, 31.10.): Dog-Code ist nicht sicher eingesperrt; jedes Geraet im LAN kann
 * Code auf dem Pi ausfuehren. Der Boot-Guard hier und die Netzgrenze (NetworkBoundary) verhindern, dass daraus
 * ein offenes Gateway im Internet oder ein Ziel fuer DNS-Rebinding wird.
 */
import fs from 'fs';
import net from 'net';

/** Exit-Code des Boot-Guards im lokalen Modus — getrennt von EX_CONFIG (78) des Auth-Guards. */
export const EX_LOCAL_MODE = 79;

/** Der eine Nutzer, mit dem im lokalen Modus jede Anfrage laeuft. `googleSub` ist kein echtes Google-Konto. */
export const LOCAL_USER = {
    id: 'local',
    email: 'local@slopdogs.local',
    name: 'Local',
    googleSub: 'local:slopdogs',
} as const;

/** Hostnamen, die nie aus dem Internet aufgeloest werden (Loopback, mDNS, Heimnetz-Zone RFC 8375). */
const LOCAL_NAME_SUFFIXES = ['.local', '.home.arpa'] as const;

/** Private, Loopback- und Link-Local-Bereiche — die einzigen Quellen, die der lokale Modus annimmt. */
const LAN_RANGES: ReadonlyArray<readonly [string, number, 'ipv4' | 'ipv6']> = [
    ['10.0.0.0', 8, 'ipv4'],
    ['172.16.0.0', 12, 'ipv4'],
    ['192.168.0.0', 16, 'ipv4'],
    ['127.0.0.0', 8, 'ipv4'],
    // Link-Local (APIPA): entsteht ohne DHCP, z. B. Pi direkt am Laptop-Kabel; wird nie geroutet.
    ['169.254.0.0', 16, 'ipv4'],
    ['::1', 128, 'ipv6'],
    ['fc00::', 7, 'ipv6'],
    ['fe80::', 10, 'ipv6'],
];

const LAN_BLOCKS = (() => {
    const list = new net.BlockList();
    for (const [address, prefix, family] of LAN_RANGES) list.addSubnet(address, prefix, family);
    return list;
})();

/**
 * True, wenn die Adresse aus einem privaten, Loopback- oder Link-Local-Bereich stammt. IPv4-mapped IPv6
 * (`::ffff:192.168.1.5`, so meldet Node IPv4-Clients auf Dual-Stack-Sockets) zaehlt als die IPv4-Adresse;
 * eine Zonen-ID (`fe80::1%eth0`) wird abgeschnitten. Alles Unlesbare ist nicht LAN.
 */
export function isLanAddress(raw: string | undefined | null): boolean {
    if (typeof raw !== 'string' || raw === '') return false;
    let address = raw.trim().toLowerCase();
    const zone = address.indexOf('%');
    if (zone >= 0) address = address.slice(0, zone);
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
    if (mapped) address = mapped[1];
    if (net.isIPv4(address)) return LAN_BLOCKS.check(address, 'ipv4');
    if (net.isIPv6(address)) return LAN_BLOCKS.check(address, 'ipv6');
    return false;
}

/**
 * Host nach RFC 7230 (`name` | `name:port` | `[v6]:port`), ohne Benutzerteil, Pfad oder Leerzeichen — fuer den
 * Host-Header und die Eintraege von LOCAL_ALLOWED_HOSTS. Alles andere, auch `evil@pi.local`, ist kein Host.
 * `explicitPort` sagt, ob ein Port dastand; sonst gilt 80.
 */
export function parseHostEntry(raw: string): { hostname: string; port: number; explicitPort: boolean } | null {
    const match = /^(\[[0-9a-f:.]+\]|[a-z0-9_.-]+)(?::(\d{1,5}))?$/i.exec(raw.trim());
    if (!match) return null;
    const port = match[2] === undefined ? 80 : Number(match[2]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { hostname: match[1], port, explicitPort: match[2] !== undefined };
}

/** True fuer Namen, die nur im eigenen Netz gelten: localhost, *.local, *.home.arpa, einteilige Namen. */
function isLocalHostname(hostname: string): boolean {
    const name = hostname.toLowerCase().replace(/\.$/, '');
    if (name === 'localhost' || name.endsWith('.localhost')) return true;
    if (LOCAL_NAME_SUFFIXES.some((suffix) => name.endsWith(suffix))) return true;
    return !name.includes('.') && !name.includes(':') && /^[a-z0-9-]+$/.test(name);
}

/** Host einer Basis-URL ist nicht oeffentlich: LAN-IP, Loopback oder ein lokaler Name. */
function isNonPublicHost(hostname: string): boolean {
    const bare = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(bare)) return isLanAddress(bare);
    return isLocalHostname(bare);
}

/**
 * Liefert ein Indiz, dass der Prozess in einem Container laeuft, oder null. Im Container ersetzt die
 * Portfreigabe (Docker `-p`, userland-proxy, rootless, Desktop) die Quelladresse durch das Gateway (172.17.0.1):
 * ein Client aus dem Internet saehe fuer die Netzgrenze wie ein LAN-Client aus.
 */
export type ContainerProbe = (env: NodeJS.ProcessEnv) => string | null;

export const detectContainer: ContainerProbe = (env) => {
    if ((env.container || '').trim() !== '') return `container=${env.container}`;
    for (const marker of ['/.dockerenv', '/run/.containerenv']) {
        if (fs.existsSync(marker)) return marker;
    }
    try {
        if (/docker|kubepods|containerd|libpod|lxc/i.test(fs.readFileSync('/proc/1/cgroup', 'utf8'))) return '/proc/1/cgroup';
    } catch {
        /* kein Linux oder nicht lesbar — kein Indiz */
    }
    return null;
};

const LOCAL_HOSTS_HINT = '(allowed: private/loopback IP, localhost, *.local, *.home.arpa, single-label name)';

export class LocalMode {
    /** Der Wert, der den Modus einschaltet. Exakt, nach trim — `Local` oder `lokal` sind Tippfehler, kein Modus. */
    static readonly VALUE = 'local';

    static isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
        return (env.SLOPDOGS_MODE || '').trim() === LocalMode.VALUE;
    }

    /** SLOPDOGS_LOCAL_ALLOW_CONTAINER=1: der Betreiber traegt die Portfreigabe des Containers ausdruecklich selbst. */
    static containerAllowed(env: NodeJS.ProcessEnv): boolean {
        return (env.SLOPDOGS_LOCAL_ALLOW_CONTAINER || '').trim() === '1';
    }

    /** Warnzeile fuer den Start, wenn der lokale Modus mit Freigabe im Container laeuft; sonst null. */
    static containerWarning(env: NodeJS.ProcessEnv, probe: ContainerProbe = detectContainer): string | null {
        if (!LocalMode.isEnabled(env) || !LocalMode.containerAllowed(env)) return null;
        const evidence = probe(env);
        return evidence
            ? `[boot] WARNING local mode in a container (${evidence}), allowed by SLOPDOGS_LOCAL_ALLOW_CONTAINER=1 — ` +
                  'a port mapping can make internet clients look like LAN clients; publish the port only on a LAN address'
            : null;
    }

    /**
     * Boot-Guard (Spur L1), rein: liest nur `env`. Liefert die Fehlerzeile oder null. Ohne SLOPDOGS_MODE
     * immer null — das heutige Verhalten bleibt unberuehrt. Jeder andere Wert und jedes Zeichen eines
     * Deployments (oeffentliche Basis-URL, Proxy-Hops, Login an, Render, Container) bricht ab: ein Dienst ohne
     * Login darf nicht hinter einem Proxy oder mit oeffentlicher Adresse hochkommen. `probe` liest das Dateisystem
     * (Container-Indizien) und ist fuer Tests ersetzbar.
     */
    static bootError(env: NodeJS.ProcessEnv, probe: ContainerProbe = detectContainer): string | null {
        const raw = (env.SLOPDOGS_MODE || '').trim();
        if (raw === '') return null;
        const prefix = '[boot] SLOPDOGS_MODE=local:';
        if (raw !== LocalMode.VALUE) return `[boot] SLOPDOGS_MODE="${raw}" is unknown — only "local" exists`;

        const nodeEnv = (env.NODE_ENV || 'development').trim();
        if (nodeEnv !== 'production') return `${prefix} requires NODE_ENV=production (got "${nodeEnv}")`;
        if (env.MCP_AUTH_REQUIRED === 'true') return `${prefix} contradicts MCP_AUTH_REQUIRED=true — local mode has no login`;
        if ((env.RENDER || '').trim() !== '') return `${prefix} refused — RENDER is set, this looks like a Render deployment`;
        if (!LocalMode.containerAllowed(env)) {
            const evidence = probe(env);
            if (evidence) {
                return (
                    `${prefix} refused — running in a container (${evidence}); a port mapping replaces the client address ` +
                    'with the gateway and lets internet clients pass as LAN clients. Set SLOPDOGS_LOCAL_ALLOW_CONTAINER=1 to accept that'
                );
            }
        }

        const hops = (env.TRUST_PROXY_HOPS || '').trim();
        if (hops !== '' && hops !== '0') {
            return `${prefix} refused — TRUST_PROXY_HOPS=${hops}; local mode never runs behind a proxy (unset it or use 0)`;
        }

        // Jede Adresse, unter der der Dienst sich zeigt oder Anfragen annimmt, muss lokal sein: eine oeffentliche
        // waere ein Dienst ohne Login im Internet (z. B. hinter dem Proxy einer Plattform, deren Netz privat ist).
        for (const name of ['PUBLIC_API_BASE_URL', 'MCP_BASE_URL'] as const) {
            const raw = (env[name] || '').trim();
            if (raw === '') continue;
            let hostname: string;
            try {
                hostname = new URL(raw).hostname;
            } catch {
                return `${prefix} refused — ${name} "${raw}" is not a URL`;
            }
            if (!isNonPublicHost(hostname)) return `${prefix} refused — ${name} host "${hostname}" is public ${LOCAL_HOSTS_HINT}`;
        }
        for (const entry of (env.LOCAL_ALLOWED_HOSTS || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)) {
            const parsed = parseHostEntry(entry);
            if (!parsed)
                return `${prefix} refused — LOCAL_ALLOWED_HOSTS entry "${entry}" is not host or host:port (IPv6 in [], no zone id)`;
            if (!isNonPublicHost(parsed.hostname))
                return `${prefix} refused — LOCAL_ALLOWED_HOSTS entry "${entry}" is public ${LOCAL_HOSTS_HINT}`;
        }
        return null;
    }
}
