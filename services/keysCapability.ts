// keys.fetch — die Host-Capability des Key-Stores (P4c 4c.4, nur Option B).
//
// Der Dog schreibt `{{key:<alias>}}` in URL, Header-Werte oder Body; ersetzt wird hier, auf dem
// Host, hinter der Worker-Membran. Der Worker sieht nur Argumente und Ergebnis — den Wert nie:
// die Antwort wird vor der Rueckgabe bereinigt, jeder benutzte Wert landet im Set des Laufs
// (KeyRunState) und wird vor Waves, Snapshot, Fehlertexten und Log-Zeilen ersetzt.
//
// Aufloesung nach RUNNER-Identitaet (wer den Lauf ausloest), nie nach dem Kennel-Owner; fail-closed
// ohne echte user.id (Super-User ohne user, Anonyme, fremde Dogs unterhalb READ -> keys_unavailable).
import dns from 'dns';
import http from 'http';
import https from 'https';
import zlib from 'zlib';
import { isIP } from 'net';
import {
    envFirst,
    isPrivateNetworkAddress,
    registerVmGlobalCapability,
    type VmGlobalCapabilityContext,
} from '@slopdogs/core';
import { KeyStoreService, hostAllowedBy, type UserKeyRow } from './KeyStoreService';

/** Was an die Stelle eines Werts tritt — in Antworten, Waves, Snapshot, Fehlern und Log. */
export const REDACTED_KEY = '[redacted:key]';
/** Unter dieser Laenge wird nicht gescrubbt (Falsch-Treffer); POST /api/keys nimmt solche Werte nicht an. */
const SCRUB_MIN = 8;
const PLACEHOLDER_RX = /\{\{key:([a-z0-9][a-z0-9_-]{0,31})\}\}/g;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BODY = 5 * 1024 * 1024;
/** Antwort-Header, die der Dog nie sieht. */
const DROPPED_RESPONSE_HEADERS = new Set(['set-cookie', 'set-cookie2', 'authorization', 'proxy-authorization']);

/** Die Kurzdoku, mit der sich die Capability im Werkzeugkasten ankuendigt. */
export const KEYS_CAPABILITY_DOC =
    'keys.fetch(url, {method, headers, body}) — ersetzt `{{key:<alias>}}` in URL, Header-Werten und Body serverseitig '
    + 'durch deinen hinterlegten Schluessel (set_key) und ruft nur Domains, die der Key erlaubt (https, keine privaten Netze, '
    + 'keine Umleitungen); liefert {status, headers, body} ohne den Wert. keys.list() — nur Aliase, last4 und Domains. '
    + 'Kein keys.get: den Klartext sieht der Dog-Code nie. Laeuft mit den Keys dessen, der den Kennel ausfuehrt.';

/**
 * Der Zustand eines Laufs: welche Werte benutzt wurden (fuer den Scrub) und welche Schluessel schon
 * aufgeloest sind (Memo). Er reist im Capability-Kontext durch den Core und serialisiert zu nichts.
 */
export class KeyRunState {
    private static readonly byResult = new WeakMap<object, KeyRunState>();
    private readonly variants = new Set<string>();
    private readonly memo = new Map<string, Promise<ResolvedKey | null>>();
    private ordered: string[] | null = null;

    /** Der Laufzustand eines Capability-Kontexts, falls der Server einen angelegt hat. */
    static of(ctx: VmGlobalCapabilityContext | undefined | null): KeyRunState | null {
        const state = ctx?.runState;
        return state instanceof KeyRunState ? state : null;
    }

    /** Ein Ergebnis (Waves) mit seinem Lauf verknuepfen — fuer den Scrub nachgelagerter Ausgaben. */
    static attach(result: object, state: KeyRunState): void {
        KeyRunState.byResult.set(result, state);
    }

    /** Der Lauf zu einem Ergebnis, oder ein leerer (scrubbt nichts). */
    static forResult(result: unknown): KeyRunState {
        const state = result && typeof result === 'object' ? KeyRunState.byResult.get(result) : undefined;
        return state ?? EMPTY_RUN;
    }

    /** Einen benutzten Wert merken — roh, URL-kodiert und JSON-escaped, wie er in Ausgaben auftaucht. */
    remember(secret: string): void {
        if (typeof secret !== 'string' || secret.length < SCRUB_MIN) return;
        for (const v of [secret, encodeURIComponent(secret), JSON.stringify(secret).slice(1, -1)]) this.variants.add(v);
        this.ordered = null;
    }

    get hasSecrets(): boolean {
        return this.variants.size > 0;
    }

    /** Jeden bekannten Wert in einem Text ersetzen. */
    scrubText(text: string): string {
        if (!this.hasSecrets || typeof text !== 'string') return text;
        let out = text;
        for (const v of this.byLength()) {
            if (out.includes(v)) out = out.split(v).join(REDACTED_KEY);
        }
        return out;
    }

    /**
     * Einen Wert bereinigen — auf dem serialisierten String (JSON), damit auch Schluessel in Keys,
     * Zahlenfeldern oder HTML-Strings fallen. Ohne Treffer bleibt das Objekt dasselbe.
     */
    scrubValue<T>(value: T): T {
        if (!this.hasSecrets || value === undefined || value === null) return value;
        if (typeof value === 'string') return this.scrubText(value) as unknown as T;
        let json: string | undefined;
        try {
            json = JSON.stringify(value);
        } catch {
            return value;
        }
        if (json === undefined || !this.byLength().some((v) => json!.includes(v))) return value;
        return JSON.parse(this.scrubText(json)) as T;
    }

    /** Ein Fehler, dessen Text und Stack keinen Wert mehr tragen. */
    scrubError<E>(err: E): E {
        if (!this.hasSecrets || !err || typeof err !== 'object') return err;
        const e = err as unknown as { message?: unknown; stack?: unknown };
        if (typeof e.message === 'string') e.message = this.scrubText(e.message);
        if (typeof e.stack === 'string') e.stack = this.scrubText(e.stack);
        return err;
    }

    /** Einmal je (Runner, Alias) im Lauf aufloesen. */
    resolveOnce(key: string, loader: () => Promise<ResolvedKey | null>): Promise<ResolvedKey | null> {
        let pending = this.memo.get(key);
        if (!pending) {
            pending = loader();
            this.memo.set(key, pending);
        }
        return pending;
    }

    /** Der Zustand gehoert in keine Ausgabe. */
    toJSON(): string {
        return '[keys-run]';
    }

    private byLength(): string[] {
        if (!this.ordered) this.ordered = [...this.variants].sort((a, b) => b.length - a.length);
        return this.ordered;
    }
}

const EMPTY_RUN = new KeyRunState();

/** Ein aufgeloester Schluessel — Zeile plus Klartext, nur im Speicher des Laufs. */
interface ResolvedKey {
    row: UserKeyRow;
    secret: string;
}

/** Eine ausgehende Anfrage, fertig ersetzt; `address` ist die geprufte, gepinnte Zieladresse. */
export interface KeysOutboundRequest {
    url: URL;
    address: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs: number;
}

/** Was keys.fetch zurueckgibt (Header gefiltert, Body als Text). */
export interface KeysFetchResult {
    status: number;
    headers: Record<string, string>;
    body: string;
}

/** Das Netz der Capability — austauschbar, damit der Selbstangriff ohne echtes Netz laeuft. */
export interface KeysNetwork {
    /** Alle Adressen eines Hostnamens (A und AAAA). */
    resolve(hostname: string): Promise<string[]>;
    /** Die Anfrage an genau `address` — keine zweite Aufloesung (DNS-Rebinding), keine Umleitung. */
    send(request: KeysOutboundRequest): Promise<KeysFetchResult>;
}

/** Das echte Netz: node:http(s) mit gepinnter Adresse; TLS prueft weiter gegen den Hostnamen. */
export const nodeKeysNetwork: KeysNetwork = {
    async resolve(hostname: string): Promise<string[]> {
        const records = await dns.promises.lookup(hostname, { all: true, verbatim: true });
        return records.map((r) => r.address);
    },

    send(request: KeysOutboundRequest): Promise<KeysFetchResult> {
        const { url, address } = request;
        const family = isIP(address);
        const lib = url.protocol === 'https:' ? https : http;
        return new Promise<KeysFetchResult>((resolve, reject) => {
            const req = lib.request({
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || undefined,
                path: `${url.pathname}${url.search}`,
                method: request.method,
                headers: request.body !== undefined
                    ? { ...request.headers, 'content-length': String(Buffer.byteLength(request.body)) }
                    : request.headers,
                lookup: (_host: string, options: any, cb: any) => {
                    if (options && options.all) cb(null, [{ address, family }]);
                    else cb(null, address, family);
                },
            }, (res) => {
                const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
                const stream = encoding === 'gzip' ? res.pipe(zlib.createGunzip())
                    : encoding === 'deflate' ? res.pipe(zlib.createInflate())
                        : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
                            : res;
                const chunks: Buffer[] = [];
                let size = 0;
                stream.on('data', (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > MAX_RESPONSE_BYTES) {
                        req.destroy(new Error(`response larger than ${MAX_RESPONSE_BYTES} bytes`));
                        return;
                    }
                    chunks.push(chunk);
                });
                stream.on('error', reject);
                stream.on('end', () => {
                    const headers: Record<string, string> = {};
                    for (const [name, value] of Object.entries(res.headers)) {
                        if (value === undefined) continue;
                        headers[name] = Array.isArray(value) ? value.join(', ') : String(value);
                    }
                    resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString('utf8') });
                });
            });
            req.setTimeout(request.timeoutMs, () => req.destroy(new Error(`timeout after ${request.timeoutMs} ms`)));
            req.on('error', reject);
            if (request.body !== undefined) req.write(request.body);
            req.end();
        });
    },
};

/** Ein Fehler von keys.fetch — der Text wird zur Dog-Fehlermeldung und traegt nie einen Wert. */
class KeysFetchError extends Error {}

/**
 * Die Capability `keys`: je Dog-Lauf ein Bundle {fetch, list}, gebunden an den Kontext des Dogs.
 * Registriert von main.ts; der Selbsttest registriert sie mit einem Fake-Netz und stellt sie zurueck.
 */
export class KeysCapability {
    constructor(
        private readonly store: KeyStoreService,
        private readonly network: KeysNetwork = nodeKeysNetwork,
    ) {}

    /** Als VM-Global `keys` registrieren (ersetzt eine fruehere Registrierung). */
    register(): void {
        registerVmGlobalCapability('keys', (ctx) => this.bundleFor(ctx), KEYS_CAPABILITY_DOC);
    }

    bundleFor(ctx: VmGlobalCapabilityContext): { fetch: (url: unknown, opts?: unknown) => Promise<KeysFetchResult>; list: () => Promise<unknown[]> } {
        const run = KeyRunState.of(ctx) ?? new KeyRunState();
        return {
            fetch: (url: unknown, opts?: unknown) => this.fetch(ctx, run, url, opts),
            list: () => this.list(ctx),
        };
    }

    /**
     * Wessen Schluessel? Der Runner — nie ein fremder Dog (unterhalb READ), nie eine gescopte
     * `<user>:dog:<lineage>`-Identitaet, der Super-User nur mit lokalem KEYSTORE_SUPERUSER_OWNER.
     */
    runnerOf(ctx: VmGlobalCapabilityContext | undefined): string | null {
        if (!ctx || ctx.foreignDog) return null;
        const userId = ctx.userId;
        if (typeof userId === 'string' && userId.length > 0) return userId.includes(':dog:') ? null : userId;
        if (ctx.isSuperUser) return this.store.identityOf({ user: null, isSuperUser: true });
        return null;
    }

    /** keys.list(): Aliase, last4, Domains des Runners — nie ein Wert. */
    async list(ctx: VmGlobalCapabilityContext): Promise<Array<{ alias: string; last4: string; allowedDomains: string[] }>> {
        const owner = this.runnerOf(ctx);
        if (!owner || !this.store.enabled) throw new KeysFetchError('keys_unavailable');
        return (await this.store.list(owner)).map((k) => ({ alias: k.alias, last4: k.last4, allowedDomains: k.allowedDomains }));
    }

    /** keys.fetch(url, opts) — Ablauf 4c.4, Schritte 1-7. */
    async fetch(ctx: VmGlobalCapabilityContext, run: KeyRunState, rawUrl: unknown, rawOpts?: unknown): Promise<KeysFetchResult> {
        const request = KeysCapability.parseRequest(rawUrl, rawOpts);
        const aliases = KeysCapability.aliasesIn(request);
        if (aliases.length === 0) throw new KeysFetchError('keys.fetch needs at least one {{key:<alias>}} placeholder — use fetch for calls without a key');
        KeysCapability.assertNoPlaceholderInHost(request.url);
        if (!this.store.enabled) throw new KeysFetchError('keys_unavailable');

        // 1.+2. Runner-Identitaet, Aliase aufloesen (Memo je Lauf).
        const resolvedKeys = new Map<string, ResolvedKey>();
        for (const alias of aliases) resolvedKeys.set(alias, await this.resolve(ctx, run, alias));

        // Ersetzen: URL-kodiert in der URL, roh in Header-Werten und Body.
        const substitute = (text: string, encode: boolean) => text.replace(PLACEHOLDER_RX, (_m, alias: string) => {
            const secret = resolvedKeys.get(alias)!.secret;
            return encode ? encodeURIComponent(secret) : secret;
        });
        let url: URL;
        try {
            url = new URL(substitute(request.url, true));
        } catch {
            throw new KeysFetchError('keys.fetch: invalid url');
        }
        if (url.protocol !== 'https:') throw new KeysFetchError('keys.fetch: https only');

        // 3. Zieldomain gegen die Allowlist JEDES Keys; dann die Aufloesung gegen private Netze.
        const hostname = url.hostname.toLowerCase();
        for (const { row } of resolvedKeys.values()) {
            if (!hostAllowedBy(hostname, KeyStoreService.allowedDomainsOf(row))) throw new KeysFetchError('domain_not_allowed');
        }
        let addresses: string[];
        try {
            addresses = isIP(hostname) ? [hostname] : await this.network.resolve(hostname);
        } catch {
            throw new KeysFetchError('keys.fetch: host not found');
        }
        if (addresses.length === 0 || addresses.some((a) => isPrivateNetworkAddress(a))) throw new KeysFetchError('domain_not_allowed');

        // 4. Quota je Key, atomar in der Datenbank.
        for (const { row } of resolvedKeys.values()) {
            if (!(await this.store.consumeQuota(row))) throw new KeysFetchError('quota_exceeded');
        }

        // 6. (vorgezogen) Die Werte gehoeren ab jetzt zum Scrub des Laufs.
        for (const { secret } of resolvedKeys.values()) run.remember(secret);

        // 5. Der Aufruf — Host, Timeout wie die VM, keine Umleitungen.
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(request.headers)) headers[name] = substitute(value, false);
        let response: KeysFetchResult;
        try {
            response = await this.network.send({
                url,
                address: addresses[0],
                method: request.method,
                headers,
                body: request.body === undefined ? undefined : substitute(request.body, false),
                timeoutMs: KeysCapability.timeoutMs(),
            });
        } catch (err) {
            // 7. Fehlertext ohne Wert.
            throw new KeysFetchError(`keys.fetch failed: ${run.scrubText(String((err as Error)?.message ?? err))}`);
        }
        const now = new Date();
        await Promise.all([...resolvedKeys.values()].map(({ row }) => this.store.touch(row.id, now)));

        const outHeaders: Record<string, string> = {};
        for (const [name, value] of Object.entries(response.headers ?? {})) {
            if (DROPPED_RESPONSE_HEADERS.has(name.toLowerCase())) continue;
            outHeaders[name.toLowerCase()] = run.scrubText(String(value));
        }
        return { status: response.status, headers: outHeaders, body: run.scrubText(String(response.body ?? '')) };
    }

    /**
     * Wessen Freigabe gilt (8.8)? Die des Kennel-Owners — fuer jeden Runner ausser dem Super-User
     * ohne Identitaet, und fuer einen fremden Dog nur, wenn der Owner seinen Code lesen darf.
     */
    grantOwnerOf(ctx: VmGlobalCapabilityContext | undefined): string | null {
        if (!ctx || !ctx.kennelOwnerId || !ctx.kennelLineageId) return null;
        if (ctx.isSuperUser && !ctx.userId) return null;
        if (ctx.foreignDog && !ctx.foreignDog.ownerMayRead) return null;
        return ctx.kennelOwnerId;
    }

    /**
     * Einen Alias aufloesen: zuerst der Runner (seine eigenen Keys), dann ein Key, den der Kennel-Owner
     * diesem Kennel freigegeben hat — sonst der passende Fehler.
     */
    private async resolve(ctx: VmGlobalCapabilityContext, run: KeyRunState, alias: string): Promise<ResolvedKey> {
        const runner = this.runnerOf(ctx);
        const grantOwner = this.grantOwnerOf(ctx);
        const decrypted = (row: UserKeyRow | null): ResolvedKey | null => (row ? { row, secret: this.store.decrypt(row) } : null);
        if (runner) {
            const own = await run.resolveOnce(`${runner}\u0000${alias}`, async () => decrypted(await this.store.findRow(runner, alias)));
            if (own) return own;
        }
        if (grantOwner) {
            const kennel = ctx.kennelLineageId as string;
            const granted = await run.resolveOnce(`grant\u0000${grantOwner}\u0000${kennel}\u0000${alias}`,
                async () => decrypted(await this.store.findGrantedRow(grantOwner, alias, kennel)));
            if (granted) return granted;
        }
        throw new KeysFetchError(runner ? `key_not_found:${alias}` : 'keys_unavailable');
    }

    /** Die Argumente des Dogs in eine feste Form: URL-Text, Methode, String-Header, String-Body. */
    private static parseRequest(rawUrl: unknown, rawOpts: unknown): { url: string; method: string; headers: Record<string, string>; body?: string } {
        if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 8192) throw new KeysFetchError('keys.fetch: url must be a string');
        const opts = (rawOpts && typeof rawOpts === 'object' ? rawOpts : {}) as Record<string, unknown>;
        const method = typeof opts.method === 'string' && /^[A-Za-z]{1,16}$/.test(opts.method) ? opts.method.toUpperCase() : 'GET';
        const headers: Record<string, string> = {};
        if (opts.headers && typeof opts.headers === 'object' && !Array.isArray(opts.headers)) {
            for (const [name, value] of Object.entries(opts.headers as Record<string, unknown>)) {
                if (value === undefined || value === null) continue;
                headers[name.toLowerCase()] = String(value);
            }
        }
        let body: string | undefined;
        if (typeof opts.body === 'string') body = opts.body;
        else if (opts.body !== undefined && opts.body !== null) {
            body = JSON.stringify(opts.body);
            if (!headers['content-type']) headers['content-type'] = 'application/json';
        }
        if (body !== undefined && body.length > MAX_REQUEST_BODY) throw new KeysFetchError('keys.fetch: body too large');
        return { url: rawUrl, method, headers, ...(body !== undefined ? { body } : {}) };
    }

    private static aliasesIn(request: { url: string; headers: Record<string, string>; body?: string }): string[] {
        const found = new Set<string>();
        for (const text of [request.url, ...Object.values(request.headers), request.body ?? '']) {
            for (const m of text.matchAll(PLACEHOLDER_RX)) found.add(m[1]);
        }
        return [...found];
    }

    /** Ein Platzhalter im Host-Teil wuerde den Wert in DNS-Anfragen tragen — verboten. */
    private static assertNoPlaceholderInHost(rawUrl: string): void {
        let probe: URL;
        try {
            probe = new URL(rawUrl.replace(PLACEHOLDER_RX, 'keyplaceholder'));
        } catch {
            throw new KeysFetchError('keys.fetch: invalid url');
        }
        if (/keyplaceholder/.test(`${probe.username}${probe.password}${probe.host}`)) {
            throw new KeysFetchError('keys.fetch: {{key:…}} is not allowed in the host part of the url');
        }
    }

    private static timeoutMs(): number {
        return Number(envFirst('SLOPDOGS_VM_TIMEOUT_MS', 'DATADOGS_VM_TIMEOUT_MS')) || 10_000;
    }
}

/**
 * Die Senke fuer `console` im Dog-Code (P4c, L7): jede Zeile wird mit dem Laufzustand ihres Dogs
 * bereinigt, bevor sie ausgegeben wird.
 */
export function scrubbingConsoleSink(level: 'log' | 'info' | 'warn' | 'error' | 'debug', line: string, ctx: VmGlobalCapabilityContext): void {
    const text = (KeyRunState.of(ctx) ?? EMPTY_RUN).scrubText(line);
    const out = console[level] ?? console.log;
    out.call(console, text);
}
