// Der Ergebnis-Cache ganzer Kennel-Laeufe (PLAN-KENNEL-CACHE 4, D1-D4): Nachschlagen VOR dem Lauf, Ablegen NACH dem
// Lauf durch das Tor. Wer ihn fragt, hat den Zugriff schon geprueft (Treffer nie vor der Zugriffspruefung).
//
//   lookup()  -> off     : TTL 0, Klasse laesst die TTL nicht zu, oder kein sicherer Scope — Lauf wie bisher.
//             -> hit     : gueltiger Eintrag; Auslieferung ohne KennelRun, ohne Worker.
//             -> miss    : Lauf noetig; das Ticket legt danach ab (oder nicht) und weckt Wartende.
//             -> bypass  : der Besitzer erzwingt einen Lauf; das Ticket ersetzt den Eintrag.
// Gleichzeitige Fehlschlaege auf denselben Schluessel warten auf den ersten Lauf. Wird dessen Ergebnis nicht abgelegt
// (Tor), bekommen sie es nicht — sie laufen selbst, durch Admission und Limit wie heute.
import { createHash } from 'crypto';
import type { IKennelConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { isRuntimeLogVerbose } from '@martinschmieschek/slopdogs-core/runtime';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { canRead, effectiveVisibility, type AclEntity } from '../../mcp/auth/visibility';
import { positiveIntFromEnv } from '../../server-app/runAdmission';
import { KeyRunState } from '../keysCapability';
import { LeadOutcome } from '../LeadOutcome';
import { isHtmlResultString, isMarkdownResultString } from '../leadResultStringFormat';
import type { Waves } from '../WavesConverter';
import type { KennelFingerprint, KennelFingerprints } from './KennelFingerprint';
import { KennelRunTrace } from './KennelRunTrace';
import type { CachedContentKind, IKennelResultStore, KennelResultEntry } from './KennelResultStore';
import type { ResultCacheTtl } from './ResultCacheTtl';

/** Der Scope eines Eintrags (D2): `anon` geteilt, `user:<id>` je Nutzer, `super` der Dev-Super-User, `landing` die Startseiten. */
export type ResultCacheScope = string;

export type CacheLookup =
    | { state: 'off'; reason: string }
    | { state: 'hit'; entry: KennelResultEntry; ageSec: number }
    | { state: 'miss' | 'bypass'; ticket: CacheTicket };

export interface CacheLookupInput {
    config: IKennelConfig;
    ctx: AuthCtx | undefined;
    /** Die schon gemischte Query (mergeQueryParams). */
    query: Record<string, string>;
    body: unknown;
    /** Der Besitzer will frisch (Cache-Control: no-cache bzw. MCP bypassCache) — nur fuer ihn wirksam. */
    bypass: boolean;
    /**
     * Landing und Kennel-Liste (Scope `landing`, D2/D10): laufen immer anonym, cachen wie ihr altes Memo jede Klasse —
     * mit der TTL des Kennels, wenn sie gesetzt und erlaubt ist, sonst mit `fallbackTtl` (LANDING_HTML_MEMO_MS).
     * Das Tor ist gelockert: kein Dog-Fehler und keine persoenliche Nutzung verhindern das Ablegen (ein anonymer Lauf
     * kennt keine persoenlichen Daten, und das alte Memo hielt jede HTML-Ausgabe).
     */
    landing?: { fallbackTtl: ResultCacheTtl };
}

/** Wie ein Fehlschlag abgelegt wird: mit welcher TTL und ob das Tor gelockert ist (Landing). */
export interface CachePolicy {
    ttl: ResultCacheTtl;
    relaxed: boolean;
}

/** Ein offener Fehlschlag: genau einmal `settle(waves)` nach dem Lauf oder `abandon()` ohne Lauf. */
export class CacheTicket {
    private done = false;

    constructor(
        readonly key: string,
        readonly lineageId: string,
        readonly scope: ResultCacheScope,
        readonly fingerprint: KennelFingerprint,
        readonly policy: CachePolicy,
        private readonly finish: (ticket: CacheTicket, entry: KennelResultEntry | null) => void,
        private readonly decide: (ticket: CacheTicket, waves: Waves, leadRef: string | undefined) => Promise<KennelResultEntry | null>,
    ) {}

    async settle(waves: Waves, leadRef: string | undefined): Promise<KennelResultEntry | null> {
        if (this.done) return null;
        this.done = true;
        let entry: KennelResultEntry | null = null;
        try {
            entry = await this.decide(this, waves, leadRef);
        } catch (err) {
            console.warn('[KennelResultCache] Ablegen gescheitert:', (err as Error)?.message ?? err);
        }
        this.finish(this, entry);
        return entry;
    }

    abandon(): void {
        if (this.done) return;
        this.done = true;
        this.finish(this, null);
    }
}

/** Ein Grund, warum ein Lauf nicht abgelegt wurde — fuer get_kennel (Herabstufung, Plan 2.3). */
export interface CacheDowngrade {
    fingerprint: string;
    reason: string;
    at: number;
}

export interface KennelResultCacheOptions {
    maxEntryBytes?: number;
    maxPerKennel?: number;
    now?: () => number;
}

export class KennelResultCache {
    static readonly MAX_ENTRY_BYTES_DEFAULT = 2 * 1024 * 1024;
    static readonly MAX_PER_KENNEL = 500;
    /** "unendlich" liegt physisch so lange ohne Treffer (E2). */
    static readonly INFINITE_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
    /** Ein Treffer schreibt hoechstens so oft zurueck (lastHitAt, gleitender Ablauf). */
    static readonly TOUCH_INTERVAL_MS = 60 * 60 * 1000;
    static readonly PRUNE_INTERVAL_MS = 10 * 60 * 1000;
    private static readonly MAX_DOWNGRADES = 1_000;

    private readonly inflight = new Map<string, Promise<KennelResultEntry | null>>();
    private readonly resolvers = new Map<string, (entry: KennelResultEntry | null) => void>();
    private readonly downgrades = new Map<string, CacheDowngrade>();
    private readonly maxEntryBytes: number;
    private readonly maxPerKennel: number;
    private readonly now: () => number;
    private lastPruneAt = 0;

    constructor(
        private readonly store: IKennelResultStore,
        readonly fingerprints: KennelFingerprints,
        options: KennelResultCacheOptions = {},
    ) {
        this.maxEntryBytes =
            options.maxEntryBytes ?? positiveIntFromEnv('KENNEL_RESULT_CACHE_MAX_ENTRY_BYTES', KennelResultCache.MAX_ENTRY_BYTES_DEFAULT);
        this.maxPerKennel = options.maxPerKennel ?? KennelResultCache.MAX_PER_KENNEL;
        this.now = options.now ?? Date.now;
    }

    // --- Nachschlagen ---

    async lookup(input: CacheLookupInput): Promise<CacheLookup> {
        const fingerprint = await this.fingerprints.of(input.config);
        const landing = input.landing ?? null;
        if (!landing) {
            const off = KennelResultCache.offReason(fingerprint);
            if (off) return { state: 'off', reason: off };
        }
        const scope = landing ? KennelResultCache.LANDING_SCOPE : KennelResultCache.scopeFor(input.config, fingerprint, input.ctx);
        if (!scope) return { state: 'off', reason: 'no shared or personal scope for this caller' };
        const key = KennelResultCache.keyOf(input.config, fingerprint, scope, input.query, input.body);
        const lineageId = KennelResultCache.lineageOf(input.config);
        const policy: CachePolicy = landing
            ? { ttl: KennelResultCache.landingTtlOf(fingerprint, landing.fallbackTtl), relaxed: true }
            : { ttl: fingerprint.ttl, relaxed: false };

        if (input.bypass) return { state: 'bypass', ticket: this.lead(key, lineageId, scope, fingerprint, policy) };

        const stored = await this.readValid(key);
        if (stored) return this.hit(stored);
        const running = this.inflight.get(key);
        if (running) {
            const shared = await running;
            if (shared) return this.hit(shared);
        }
        return { state: 'miss', ticket: this.lead(key, lineageId, scope, fingerprint, policy) };
    }

    /** Ein Kennel ist geloescht: seine Eintraege gehen mit. */
    async forgetKennel(lineageId: string): Promise<void> {
        try {
            await this.store.deleteLineage(lineageId);
        } catch (err) {
            console.warn(`[KennelResultCache] Eintraege von ${lineageId} nicht geloescht:`, (err as Error)?.message ?? err);
        }
        this.downgrades.delete(lineageId);
    }

    /** Warum der letzte Lauf dieses Kennels (in dieser Fassung) nicht abgelegt wurde — oder null. */
    downgradeOf(lineageId: string, fingerprint: string): CacheDowngrade | null {
        const known = this.downgrades.get(lineageId);
        return known && known.fingerprint === fingerprint ? known : null;
    }

    // --- Scope und Schluessel (D2, Plan 4) ---

    static readonly LANDING_SCOPE = 'landing';

    /** Landing: die TTL des Kennels, wenn gesetzt und erlaubt; sonst das Fenster des alten Memos. */
    static landingTtlOf(fingerprint: KennelFingerprint, fallback: ResultCacheTtl): ResultCacheTtl {
        return fingerprint.ttl.enabled && !KennelResultCache.offReason(fingerprint) ? fingerprint.ttl : fallback;
    }

    /** Warum dieser Kennel gar nicht cacht — oder null. */
    static offReason(fingerprint: KennelFingerprint): string | null {
        if (!fingerprint.ttl.enabled) return 'resultCacheTtl is 0';
        return fingerprint.ttl.refusalFor(fingerprint.classification);
    }

    /**
     * Der Scope nach D2, im Zweifel je Nutzer: persoenliche und private Kennels nie geteilt; ein Eingeloggter teilt mit
     * Anonymen nur, wenn kein laufender Dog ihm fremd ist (sonst liefe er in einem eigenen Namensraum). Anonyme Aufrufer
     * persoenlicher Kennels: kein Cache.
     */
    static scopeFor(config: IKennelConfig, fingerprint: KennelFingerprint, ctx: AuthCtx | undefined): ResultCacheScope | null {
        const personal = fingerprint.classification.klasse === 'persoenlich' || effectiveVisibility(config as AclEntity) === 'private';
        const own = ctx?.isSuperUser ? 'super' : ctx?.user?.id ? `user:${ctx.user.id}` : null;
        if (personal) return own;
        if (!ctx?.user?.id || ctx.isSuperUser) return 'anon';
        const foreign = fingerprint.runnable.some((dog) => !dog.acl || !canRead(dog.acl, ctx));
        return foreign ? own : 'anon';
    }

    static keyOf(
        config: IKennelConfig,
        fingerprint: KennelFingerprint,
        scope: ResultCacheScope,
        query: Record<string, string>,
        body: unknown,
    ): string {
        const lineageId = KennelResultCache.lineageOf(config);
        const q = fingerprint.readsQuery ? KennelResultCache.sha(KennelResultCache.stableJson(query ?? {})) : '-';
        const b = fingerprint.readsBody ? KennelResultCache.sha(KennelResultCache.stableJson(body ?? null)) : '-';
        return `kres:v1:${lineageId}:${fingerprint.hash}:${scope}:${q}:${b}`;
    }

    // --- Ablegen (D4) ---

    private lead(
        key: string,
        lineageId: string,
        scope: ResultCacheScope,
        fingerprint: KennelFingerprint,
        policy: CachePolicy,
    ): CacheTicket {
        if (!this.inflight.has(key)) {
            this.inflight.set(
                key,
                new Promise((resolve) => {
                    this.resolvers.set(key, resolve);
                }),
            );
        }
        return new CacheTicket(
            key,
            lineageId,
            scope,
            fingerprint,
            policy,
            (ticket, entry) => this.finish(ticket, entry),
            (ticket, waves, leadRef) => this.decide(ticket, waves, leadRef),
        );
    }

    private finish(ticket: CacheTicket, entry: KennelResultEntry | null): void {
        const resolve = this.resolvers.get(ticket.key);
        if (!resolve) return;
        this.resolvers.delete(ticket.key);
        this.inflight.delete(ticket.key);
        resolve(entry);
    }

    private async decide(ticket: CacheTicket, waves: Waves, leadRef: string | undefined): Promise<KennelResultEntry | null> {
        const lineageId = ticket.lineageId;
        const refusal = this.gateRefusal(ticket, waves, leadRef);
        if (refusal) {
            if (refusal.downgrade) this.noteDowngrade(lineageId, ticket.fingerprint.hash, refusal.reason);
            if (isRuntimeLogVerbose()) console.log(`[KennelResultCache] ${lineageId}: nicht abgelegt — ${refusal.reason}`);
            return null;
        }
        const outcome = LeadOutcome.of(waves, leadRef);
        const value = outcome.status === 'ok' ? KeyRunState.forResult(waves).scrubValue(outcome.result) : null;
        const text = JSON.stringify(value);
        if (typeof text !== 'string') return null;
        const sizeBytes = Buffer.byteLength(text, 'utf8');
        if (sizeBytes > this.maxEntryBytes) return null;
        const now = this.now();
        const ttl = ticket.policy.ttl;
        const entry: KennelResultEntry = {
            key: ticket.key,
            lineageId,
            scope: ticket.scope,
            value: text,
            leadStatus: outcome.status === 'ok' ? 'ok' : 'empty',
            contentKind: KennelResultCache.contentKindOf(value, outcome.status === 'ok'),
            sizeBytes,
            createdAt: now,
            expiresAt: ttl.infinite ? now + KennelResultCache.INFINITE_IDLE_MS : now + ttl.seconds * 1000,
            infinite: ttl.infinite,
            lastHitAt: now,
        };
        await this.store.put(entry, this.maxPerKennel);
        this.pruneIfDue(now);
        return entry;
    }

    /** Das Tor (D4, Plan 2.3): null = ablegen, sonst der Grund (und ob er eine Herabstufung ist). */
    private gateRefusal(ticket: CacheTicket, waves: Waves, leadRef: string | undefined): { reason: string; downgrade: boolean } | null {
        const trace = KennelRunTrace.of(waves);
        if (!trace) return { reason: 'run without trace', downgrade: false };
        const outcome = LeadOutcome.of(waves, leadRef);
        if (outcome.memoryPressure) return { reason: 'memory pressure', downgrade: false };
        if (outcome.status !== 'ok' && outcome.status !== 'empty') return { reason: `lead ${outcome.status}`, downgrade: false };
        if (!trace.allDogsOk && !ticket.policy.relaxed) return { reason: 'a dog did not end ok', downgrade: false };
        if (trace.mimicsChanged) return { reason: 'the run saved or healed mimics', downgrade: false };
        const runnable = ticket.fingerprint.runnable;
        const sameVersions =
            trace.ranVersions.size === runnable.length && runnable.every((dog) => trace.ranVersions.get(dog.lineageId) === dog.versionId);
        if (!sameVersions) return { reason: 'dog versions changed during the run', downgrade: false };
        const personal = KeyRunState.forResult(waves).personalUses;
        if (personal.length > 0 && !ticket.policy.relaxed && !KennelResultCache.isPersonalScope(ticket.scope)) {
            return { reason: `the run used ${personal.join(', ')} — personal results are never shared`, downgrade: true };
        }
        return null;
    }

    private static isPersonalScope(scope: ResultCacheScope): boolean {
        return scope.startsWith('user:') || scope === 'super';
    }

    private noteDowngrade(lineageId: string, fingerprint: string, reason: string): void {
        if (this.downgrades.size >= KennelResultCache.MAX_DOWNGRADES && !this.downgrades.has(lineageId)) {
            const oldest = this.downgrades.keys().next().value;
            if (oldest !== undefined) this.downgrades.delete(oldest);
        }
        this.downgrades.set(lineageId, { fingerprint, reason, at: this.now() });
    }

    // --- Treffer ---

    private async readValid(key: string): Promise<KennelResultEntry | null> {
        let entry: KennelResultEntry | null;
        try {
            entry = await this.store.get(key);
        } catch (err) {
            console.warn('[KennelResultCache] Nachschlagen gescheitert, Lauf wie ohne Cache:', (err as Error)?.message ?? err);
            return null;
        }
        if (!entry || entry.expiresAt <= this.now()) return null;
        return entry;
    }

    private hit(entry: KennelResultEntry): CacheLookup {
        const now = this.now();
        if (now - entry.lastHitAt >= KennelResultCache.TOUCH_INTERVAL_MS) {
            const expiresAt = entry.infinite ? now + KennelResultCache.INFINITE_IDLE_MS : null;
            entry.lastHitAt = now;
            if (expiresAt !== null) entry.expiresAt = expiresAt;
            void this.store.touch(entry.key, now, expiresAt).catch(() => undefined);
        }
        return { state: 'hit', entry, ageSec: Math.max(0, Math.floor((now - entry.createdAt) / 1000)) };
    }

    private pruneIfDue(now: number): void {
        if (now - this.lastPruneAt < KennelResultCache.PRUNE_INTERVAL_MS) return;
        this.lastPruneAt = now;
        void this.store.prune(now).catch((err) => console.warn('[KennelResultCache] prune:', (err as Error)?.message ?? err));
    }

    // --- Hilfen ---

    /** Der Wert eines Treffers: `ok` mit dem abgelegten (bereinigten) Ergebnis, `empty` als null. */
    static valueOf(entry: KennelResultEntry): { status: 'ok' | 'empty'; result: unknown } {
        return { status: entry.leadStatus, result: entry.leadStatus === 'ok' ? JSON.parse(entry.value) : null };
    }

    /** Die Art der Auslieferung — dieselbe Erkennung wie KennelRunHandler.sendResult. */
    static contentKindOf(value: unknown, ok: boolean): CachedContentKind {
        if (!ok || value === null || value === undefined) return 'null';
        if (value && typeof value === 'object' && typeof (value as { live?: unknown }).live === 'string') return 'lobby';
        if (typeof value === 'string' && isHtmlResultString(value)) return 'html';
        if (typeof value === 'string' && isMarkdownResultString(value)) return 'markdown';
        return 'json';
    }

    /** Dieselbe Regel wie runKennel und createMimicAdopter: lineageId, sonst die id. */
    static lineageOf(config: IKennelConfig): string {
        return (config as IKennelConfig & { lineageId?: string }).lineageId || config.id;
    }

    private static sha(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    /** JSON mit sortierten Objekt-Schluesseln — gleiche Eingabe, gleicher Schluessel. */
    static stableJson(value: unknown): string {
        if (value === undefined) return 'null';
        if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
        if (Array.isArray(value)) return `[${value.map((v) => KennelResultCache.stableJson(v)).join(',')}]`;
        const entries = Object.keys(value as Record<string, unknown>)
            .sort()
            .map((k) => `${JSON.stringify(k)}:${KennelResultCache.stableJson((value as Record<string, unknown>)[k])}`);
        return `{${entries.join(',')}}`;
    }
}
