/**
 * ~~~ RUN ADMISSION — Zulassung fuer Kennel-Laeufe: Schleuse je Topf + Sperre je Quelle ~~~
 *
 * Zwei Fragen, zwei Klassen:
 *
 *   RunAdmission    — "Ist im Topf ein Platz frei?" Ein Topf laesst `maxConcurrent` gleichzeitig durch,
 *                     der Rest wartet in einer FIFO-Schlange und kommt SERIELL dran. Abgewiesen wird nur,
 *                     wenn die Schlange voll ist (`queueMax`, sofort 503) oder das lange Wartebudget
 *                     (`queueTimeoutMs`) reisst (503). Wer in der Schlange auflegt, verlaesst sie sofort und
 *                     erbt nie einen Platz — frueher erbte der Tote den Platz, antwortete ins Leere und gab
 *                     ihn nie zurueck (bei 1 Platz war /k/ bis zum Neustart tot).
 *
 *   SourceRunGate   — "Darf DIESE Quelle jetzt noch einen Lauf starten?" (Polling-Blocker). Je Quelle
 *                     (angemeldet: `user:<id>`, anonym: Client-IP) hoechstens `maxInflight` Laeufe
 *                     gleichzeitig (aktiv + wartend) und ein Token-Bucket (`perMinute`, `burst`). Darueber
 *                     sofort 429 + Retry-After. Ein Aufrufer kann so nie die ganze Schlange fuellen.
 *                     Der Zustand je Quelle ist begrenzt und wird geraeumt — sonst waere der Blocker selbst
 *                     das naechste Speicherleck.
 *
 * RunGates buendelt beide Toepfe (heavy, public) und die gemeinsame Sperre je Quelle: ein Aufrufer, der
 * ueber /k/, /api/kennels/:id/run und MCP zugleich laeuft, zaehlt EINMAL.
 */

import { ipKeyGenerator } from 'express-rate-limit';
import type { AuthCtx } from '../mcp/auth/middleware';

/** Liest einen positiven Integer aus der Umgebung; alles andere faellt auf den Default. */
export function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// --- Ablehnungen ---

export type AdmissionDenialReason =
    | 'queue_full'
    | 'queue_timeout'
    | 'source_concurrency'
    | 'source_rate'
    | 'cancelled';

/** Eine Ablehnung — Status, Wartezeit und ein englischer Text fuer den Client. */
export class AdmissionDenial {
    /** Vorschlag fuer Retry-After, wenn die Schlange voll ist: kurz, die Schlange bewegt sich. */
    static readonly QUEUE_FULL_RETRY_AFTER_S = 10;
    /** Vorschlag fuer Retry-After, wenn die Quelle schon genug laufen hat. */
    static readonly SOURCE_BUSY_RETRY_AFTER_S = 5;

    private constructor(
        public readonly status: 429 | 503 | 499,
        public readonly reason: AdmissionDenialReason,
        public readonly retryAfterSec: number,
        public readonly message: string,
    ) {}

    static queueFull(): AdmissionDenial {
        return new AdmissionDenial(503, 'queue_full', AdmissionDenial.QUEUE_FULL_RETRY_AFTER_S,
            'Server busy: the run queue is full. Retry shortly.');
    }

    static queueTimeout(queueTimeoutMs: number): AdmissionDenial {
        const seconds = Math.ceil(queueTimeoutMs / 1000);
        return new AdmissionDenial(503, 'queue_timeout', AdmissionDenial.QUEUE_FULL_RETRY_AFTER_S,
            `Server busy: no free run slot within ${seconds} s. Retry shortly.`);
    }

    static sourceConcurrency(maxInflight: number): AdmissionDenial {
        return new AdmissionDenial(429, 'source_concurrency', AdmissionDenial.SOURCE_BUSY_RETRY_AFTER_S,
            `Too many concurrent runs from your client (max ${maxInflight}). Wait for your running request to finish.`);
    }

    static sourceRate(perMinute: number, retryAfterSec: number): AdmissionDenial {
        return new AdmissionDenial(429, 'source_rate', Math.max(1, retryAfterSec),
            `Too many runs from your client: limit ${perMinute} per minute.`);
    }

    /** Der Aufrufer hat selbst aufgelegt — niemand bekommt eine Antwort. */
    static cancelled(): AdmissionDenial {
        return new AdmissionDenial(499, 'cancelled', 0, 'Request closed by the client while waiting.');
    }

    /** JSON-Rumpf der HTTP-Antwort. */
    toBody(): { error: string; reason: AdmissionDenialReason; message: string } {
        return {
            error: this.status === 429 ? 'too_many_requests' : 'server_busy',
            reason: this.reason,
            message: this.message,
        };
    }
}

// --- Sperre je Quelle ---

export interface SourceRunGateOptions {
    /** Aktive + wartende Laeufe je Quelle. */
    maxInflight: number;
    /** Nachfuellrate des Token-Buckets. */
    perMinute: number;
    /** Fassungsvermoegen des Buckets (Stoss). */
    burst: number;
    /** Obergrenze fuer gleichzeitig verfolgte Quellen. */
    maxTrackedSources?: number;
    /** Uhr — austauschbar fuer Tests. */
    now?: () => number;
}

/** Zustand einer Quelle: laufende Laeufe und ein Token-Bucket mit lazy Nachfuellung. */
class SourceState {
    inflight = 0;
    private tokens: number;
    private refilledAt: number;

    constructor(private readonly burst: number, private readonly perMs: number, now: number) {
        this.tokens = burst;
        this.refilledAt = now;
    }

    private refill(now: number): void {
        if (now <= this.refilledAt) return;
        this.tokens = Math.min(this.burst, this.tokens + (now - this.refilledAt) * this.perMs);
        this.refilledAt = now;
    }

    /** Nimmt ein Token oder nennt die Sekunden bis zum naechsten. */
    take(now: number): { ok: true } | { ok: false; retryAfterSec: number } {
        this.refill(now);
        if (this.tokens >= 1) {
            this.tokens -= 1;
            return { ok: true };
        }
        const missingMs = (1 - this.tokens) / this.perMs;
        return { ok: false, retryAfterSec: Math.ceil(missingMs / 1000) };
    }

    /** Nichts laeuft und der Bucket ist voll: der Eintrag traegt keine Information mehr. */
    isIdle(now: number): boolean {
        this.refill(now);
        return this.inflight === 0 && this.tokens >= this.burst;
    }
}

/** Ein zugelassener Lauf einer Quelle. `leave()` genau einmal. */
export class SourcePass {
    private left = false;

    constructor(private readonly onLeave: () => void) {}

    leave(): void {
        if (this.left) return;
        this.left = true;
        this.onLeave();
    }

    static readonly NONE = new SourcePass(() => undefined);
}

export interface SourceRunGateStats {
    trackedSources: number;
    maxInflight: number;
    perMinute: number;
    burst: number;
    rejectedConcurrencySinceBoot: number;
    rejectedRateSinceBoot: number;
}

export class SourceRunGate {
    /** Wie oft hoechstens gefegt wird — leere Eintraege verfallen spaetestens dann. */
    private static readonly SWEEP_INTERVAL_MS = 30_000;
    /** Default fuer die Zahl verfolgter Quellen. Je Eintrag ~100 Byte; 10.000 = ~1 MB. */
    static readonly DEFAULT_MAX_TRACKED_SOURCES = 10_000;

    /** Einfuegereihenfolge = LRU-Reihenfolge (jeder Zugriff setzt den Eintrag ans Ende). */
    private readonly sources = new Map<string, SourceState>();
    private readonly maxInflight: number;
    private readonly perMinute: number;
    private readonly burst: number;
    private readonly perMs: number;
    private readonly maxTracked: number;
    private readonly now: () => number;
    private lastSweepAt = 0;
    private rejectedConcurrency = 0;
    private rejectedRate = 0;

    constructor(options: SourceRunGateOptions) {
        this.maxInflight = options.maxInflight;
        this.perMinute = options.perMinute;
        this.burst = Math.max(1, options.burst);
        this.perMs = options.perMinute / 60_000;
        this.maxTracked = options.maxTrackedSources ?? SourceRunGate.DEFAULT_MAX_TRACKED_SOURCES;
        this.now = options.now ?? Date.now;
    }

    static fromEnv(): SourceRunGate {
        return new SourceRunGate({
            maxInflight: positiveIntFromEnv('RUNS_PER_SOURCE_MAX_INFLIGHT', 2),
            perMinute: positiveIntFromEnv('RUNS_PER_SOURCE_PER_MINUTE', 20),
            burst: positiveIntFromEnv('RUNS_PER_SOURCE_BURST', 6),
        });
    }

    /**
     * Darf diese Quelle einen Lauf beginnen? Erst die Gleichzeitigkeit (kostet kein Token), dann der
     * Bucket. Der Pass zaehlt, bis der Lauf endet — aktiv ODER wartend.
     */
    enter(sourceKey: string): { ok: true; pass: SourcePass } | { ok: false; denial: AdmissionDenial } {
        const now = this.now();
        this.sweepIfDue(now);
        const state = this.stateOf(sourceKey, now);
        if (state.inflight >= this.maxInflight) {
            this.rejectedConcurrency++;
            return { ok: false, denial: AdmissionDenial.sourceConcurrency(this.maxInflight) };
        }
        const token = state.take(now);
        if (!token.ok) {
            this.rejectedRate++;
            return { ok: false, denial: AdmissionDenial.sourceRate(this.perMinute, token.retryAfterSec) };
        }
        state.inflight++;
        return {
            ok: true,
            pass: new SourcePass(() => {
                state.inflight = Math.max(0, state.inflight - 1);
            }),
        };
    }

    stats(): SourceRunGateStats {
        return {
            trackedSources: this.sources.size,
            maxInflight: this.maxInflight,
            perMinute: this.perMinute,
            burst: this.burst,
            rejectedConcurrencySinceBoot: this.rejectedConcurrency,
            rejectedRateSinceBoot: this.rejectedRate,
        };
    }

    /** Nur fuer Tests: sofort fegen, unabhaengig vom Intervall. */
    sweepNow(): void {
        this.sweep(this.now());
    }

    private stateOf(sourceKey: string, now: number): SourceState {
        const existing = this.sources.get(sourceKey);
        if (existing) {
            // LRU: ans Ende.
            this.sources.delete(sourceKey);
            this.sources.set(sourceKey, existing);
            return existing;
        }
        if (this.sources.size >= this.maxTracked) {
            this.sweep(now);
            this.evictOldestIdle();
        }
        const state = new SourceState(this.burst, this.perMs, now);
        this.sources.set(sourceKey, state);
        return state;
    }

    private sweepIfDue(now: number): void {
        if (now - this.lastSweepAt < SourceRunGate.SWEEP_INTERVAL_MS) return;
        this.sweep(now);
    }

    private sweep(now: number): void {
        this.lastSweepAt = now;
        for (const [key, state] of this.sources) {
            if (state.isIdle(now)) this.sources.delete(key);
        }
    }

    /**
     * Voll trotz Fegen: die am laengsten unbenutzten Quellen ohne laufenden Lauf gehen (ihr Bucket-Gedaechtnis
     * geht verloren — der Preis fuer eine feste Obergrenze). Quellen mit laufendem Lauf bleiben; davon gibt es
     * hoechstens so viele, wie die Toepfe Plaetze plus Schlange haben.
     */
    private evictOldestIdle(): void {
        for (const [key, state] of this.sources) {
            if (this.sources.size < this.maxTracked) return;
            if (state.inflight === 0) this.sources.delete(key);
        }
    }
}

// --- Topf mit Schlange ---

/** Ein zugelassener Lauf. `release()` gibt den Platz genau einmal zurueck (und den Pass der Quelle). */
export class RunTicket {
    private released = false;

    constructor(private readonly onRelease: () => void) {}

    get isReleased(): boolean {
        return this.released;
    }

    release(): void {
        if (this.released) return;
        this.released = true;
        this.onRelease();
    }
}

export type AdmissionOutcome =
    | { granted: true; ticket: RunTicket }
    | { granted: false; denial: AdmissionDenial };

/**
 * Eine Anfrage an den Topf. `outcome` entscheidet sich sofort oder nach dem Warten; `close()` heisst
 * "der Aufrufer ist fertig oder weg": wartend -> raus aus der Schlange (kein Platz geerbt), zugelassen ->
 * Platz zurueck. Mehrfaches close() ist wirkungslos.
 */
export class PendingAdmission {
    private decided: AdmissionOutcome | null = null;
    private closed = false;
    private resolveOutcome!: (outcome: AdmissionOutcome) => void;
    readonly outcome: Promise<AdmissionOutcome>;

    constructor(private readonly onWithdraw: (pending: PendingAdmission) => void) {
        this.outcome = new Promise<AdmissionOutcome>((resolve) => {
            this.resolveOutcome = resolve;
        });
    }

    /** Sofort abgewiesen (Quelle oder volle Schlange)? Dann synchron lesbar. */
    get immediateDenial(): AdmissionDenial | null {
        return this.decided && !this.decided.granted ? this.decided.denial : null;
    }

    get isClosed(): boolean {
        return this.closed;
    }

    /** Nur der Topf entscheidet. Liefert false, wenn die Anfrage schon geschlossen ist. */
    decide(outcome: AdmissionOutcome): boolean {
        if (this.decided) return false;
        if (this.closed) {
            if (outcome.granted) outcome.ticket.release();
            return false;
        }
        this.decided = outcome;
        this.resolveOutcome(outcome);
        return true;
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        if (!this.decided) {
            this.onWithdraw(this);
            this.decided = { granted: false, denial: AdmissionDenial.cancelled() };
            this.resolveOutcome(this.decided);
            return;
        }
        if (this.decided.granted) this.decided.ticket.release();
    }
}

export interface RunAdmissionOptions {
    /** Fuer Log und Statistik: 'heavy' | 'public'. */
    name: string;
    maxConcurrent: number;
    queueTimeoutMs: number;
    /** Obergrenze der Schlange; darueber sofort 503. */
    queueMax: number;
}

export interface RunAdmissionStats {
    name: string;
    active: number;
    waiting: number;
    maxConcurrent: number;
    queueMax: number;
    queueTimeoutMs: number;
    rejectedQueueFullSinceBoot: number;
    rejectedQueueTimeoutSinceBoot: number;
    withdrawnWhileWaitingSinceBoot: number;
}

interface Waiter {
    pending: PendingAdmission;
    pass: SourcePass;
    timer: ReturnType<typeof setTimeout>;
}

export class RunAdmission {
    private active = 0;
    private readonly waiting: Waiter[] = [];
    private rejectedQueueFull = 0;
    private rejectedQueueTimeout = 0;
    private withdrawn = 0;

    constructor(private readonly options: RunAdmissionOptions) {}

    get name(): string {
        return this.options.name;
    }

    /**
     * Bittet um einen Platz. Mit `sourceKey` und `sourceGate` gilt zuerst die Sperre je Quelle (429 sofort).
     * Danach: freier Platz -> sofort; sonst Schlange (FIFO) bis zum Wartebudget; volle Schlange -> 503 sofort.
     */
    request(sourceKey?: string | null, sourceGate?: SourceRunGate | null): PendingAdmission {
        const pending = new PendingAdmission((p) => this.withdraw(p));
        let pass = SourcePass.NONE;
        if (sourceKey && sourceGate) {
            const entered = sourceGate.enter(sourceKey);
            if (!entered.ok) {
                pending.decide({ granted: false, denial: entered.denial });
                return pending;
            }
            pass = entered.pass;
        }

        if (this.active < this.options.maxConcurrent) {
            this.active++;
            pending.decide({ granted: true, ticket: this.ticketFor(pass) });
            return pending;
        }

        if (this.waiting.length >= this.options.queueMax) {
            this.rejectedQueueFull++;
            pass.leave();
            pending.decide({ granted: false, denial: AdmissionDenial.queueFull() });
            return pending;
        }

        const waiter: Waiter = {
            pending,
            pass,
            timer: setTimeout(() => this.expire(waiter), this.options.queueTimeoutMs),
        };
        // Ein Wartender darf den Prozess nicht am Leben halten (bei HTTP haelt ihn die Socket).
        waiter.timer.unref?.();
        this.waiting.push(waiter);
        return pending;
    }

    /** In-process (MCP): wartet auf die Entscheidung. */
    async acquire(sourceKey?: string | null, sourceGate?: SourceRunGate | null): Promise<AdmissionOutcome> {
        return this.request(sourceKey, sourceGate).outcome;
    }

    stats(): RunAdmissionStats {
        return {
            name: this.options.name,
            active: this.active,
            waiting: this.waiting.length,
            maxConcurrent: this.options.maxConcurrent,
            queueMax: this.options.queueMax,
            queueTimeoutMs: this.options.queueTimeoutMs,
            rejectedQueueFullSinceBoot: this.rejectedQueueFull,
            rejectedQueueTimeoutSinceBoot: this.rejectedQueueTimeout,
            withdrawnWhileWaitingSinceBoot: this.withdrawn,
        };
    }

    private ticketFor(pass: SourcePass): RunTicket {
        return new RunTicket(() => {
            pass.leave();
            this.handOver();
        });
    }

    /** Gibt den Platz an den naechsten LEBENDEN Wartenden weiter — oder frei. */
    private handOver(): void {
        for (;;) {
            const next = this.waiting.shift();
            if (!next) {
                if (this.active <= 0) {
                    console.error(`[RunAdmission:${this.options.name}] release without an active run — counter out of step`);
                    return;
                }
                this.active--;
                return;
            }
            clearTimeout(next.timer);
            // Geschlossene Anfragen stehen nie in der Schlange (withdraw), aber sicher ist sicher:
            // ein Platz geht nur an jemanden, der noch zuhoert.
            if (next.pending.isClosed) {
                next.pass.leave();
                continue;
            }
            if (next.pending.decide({ granted: true, ticket: this.ticketFor(next.pass) })) return;
        }
    }

    private withdraw(pending: PendingAdmission): void {
        const index = this.waiting.findIndex((w) => w.pending === pending);
        if (index < 0) return;
        const [waiter] = this.waiting.splice(index, 1);
        clearTimeout(waiter.timer);
        waiter.pass.leave();
        this.withdrawn++;
    }

    private expire(waiter: Waiter): void {
        const index = this.waiting.indexOf(waiter);
        if (index < 0) return;
        this.waiting.splice(index, 1);
        waiter.pass.leave();
        this.rejectedQueueTimeout++;
        waiter.pending.decide({ granted: false, denial: AdmissionDenial.queueTimeout(this.options.queueTimeoutMs) });
    }
}

// --- Quelle eines Aufrufs ---

/**
 * Wer ruft? Angemeldet (Session oder PAT/Bearer): `user:<id>` — ueber alle Geraete und Wege dieselbe Quelle.
 * Anonym: die Client-IP (`req.ip`), IPv6 auf /56 zusammengefasst (ipKeyGenerator), sonst teilt sich jeder
 * Anschluss beliebig viele Quellen. `req.ip` ist nur so ehrlich wie `trust proxy` (TRUST_PROXY_HOPS).
 */
export class RunSource {
    static of(ctx: AuthCtx | null | undefined, ip: string | null | undefined): string {
        if (ctx?.user?.id) return `user:${ctx.user.id}`;
        if (ip) return `ip:${ipKeyGenerator(ip)}`;
        if (ctx?.isSuperUser) return 'super';
        return 'anon';
    }

    static ofRequest(req: { ctx?: AuthCtx; ip?: string }): string {
        return RunSource.of(req.ctx, req.ip);
    }
}

// --- Die Toepfe des Prozesses ---

export interface RunGatesStats {
    pots: RunAdmissionStats[];
    sources: SourceRunGateStats;
    rejected429SinceBoot: number;
    rejected503SinceBoot: number;
}

/**
 * Alle Zulassungen eines Prozesses: `heavy` (UI-Listen, Werkstatt-Laeufe, MCP-Laeufe), `publicRuns`
 * (/k/:id, /k/:id/openapi.json) und die gemeinsame Sperre je Quelle.
 */
export class RunGates {
    constructor(
        readonly heavy: RunAdmission,
        readonly publicRuns: RunAdmission,
        readonly sources: SourceRunGate,
    ) {}

    static fromEnv(): RunGates {
        return new RunGates(
            new RunAdmission({
                name: 'heavy',
                maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_HEAVY_REQUESTS', 8),
                queueTimeoutMs: positiveIntFromEnv('HEAVY_REQUEST_QUEUE_TIMEOUT_MS', 120_000),
                queueMax: positiveIntFromEnv('HEAVY_REQUEST_QUEUE_MAX', 50),
            }),
            new RunAdmission({
                name: 'public',
                maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_PUBLIC_RUNS', 4),
                queueTimeoutMs: positiveIntFromEnv('PUBLIC_RUN_QUEUE_TIMEOUT_MS', 120_000),
                queueMax: positiveIntFromEnv('PUBLIC_RUN_QUEUE_MAX', 50),
            }),
            SourceRunGate.fromEnv(),
        );
    }

    /**
     * Ein Kennel-Lauf aus MCP/Actions — in-process, im Heavy-Topf, mit Sperre je Quelle. Der Aufrufer
     * gibt das Ticket nach Laufende zurueck (finally).
     */
    requestRun(ctx: AuthCtx | null | undefined): PendingAdmission {
        return this.heavy.request(RunSource.of(ctx, null), this.sources);
    }

    stats(): RunGatesStats {
        const pots = [this.heavy.stats(), this.publicRuns.stats()];
        const sources = this.sources.stats();
        return {
            pots,
            sources,
            rejected429SinceBoot: sources.rejectedConcurrencySinceBoot + sources.rejectedRateSinceBoot,
            rejected503SinceBoot: pots.reduce((sum, p) => sum + p.rejectedQueueFullSinceBoot + p.rejectedQueueTimeoutSinceBoot, 0),
        };
    }
}
