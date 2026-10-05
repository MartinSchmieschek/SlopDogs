/**
 * ~~~ RUN ADMISSION — Zulassung fuer Kennel-Laeufe: Schleuse je Topf + faire Warteschlange je Quelle ~~~
 *
 * Zwei Fragen, zwei Klassen:
 *
 *   RunAdmission    — "Ist im Topf ein Platz frei?" Ein Topf laesst `maxConcurrent` gleichzeitig durch, der
 *                     Rest WARTET und kommt seriell dran. Die Wartenden stehen je Quelle in einer FIFO-Schlange;
 *                     freie Plaetze gehen REIHUM ueber die Quellen (Round-Robin) — eine Quelle mit vielen
 *                     Wartenden hungert keine andere aus. Abgewiesen wird nur, wenn die Schlange des Topfs voll
 *                     ist (`queueMax`, sofort 503) oder das lange Wartebudget (`queueTimeoutMs`) reisst (503).
 *                     Wer in der Schlange auflegt, verlaesst sie sofort und erbt nie einen Platz.
 *
 *   SourceRunGate   — "Wie viel darf DIESE Quelle?" (Polling-Blocker). Je Quelle (angemeldet: `user:<id>`,
 *                     anonym: `anon:<Client-IP>`) hoechstens `maxActive` Laeufe AKTIV — weitere werden
 *                     eingereiht, nicht abgewiesen. 429 erst, wenn die Quelle schon `maxQueued` Wartende hat,
 *                     oder wenn ihr Token-Bucket (`perMinute`, `burst`) leer ist. So erzeugt ein Aufrufer nie
 *                     allein die ganze Last: er belegt hoechstens `maxActive` Plaetze und kommt in der Schlange
 *                     nur jede n-te Runde dran. Angemeldete und anonyme Quellen haben eigene Grenzen.
 *                     Der Zustand je Quelle ist begrenzt und wird geraeumt — sonst waere der Blocker selbst
 *                     das naechste Speicherleck.
 *
 * RunGates buendelt beide Toepfe (heavy, public) und die gemeinsame Sperre je Quelle: ein Aufrufer, der
 * ueber /k/, /api/kennels/:id/run und MCP zugleich laeuft, zaehlt EINMAL. Wird in einem Topf ein Platz der
 * Quelle frei, erfahren es alle Toepfe (ein Wartender im anderen Topf darf dann starten).
 */

import type { AuthCtx } from '../mcp/auth/middleware';
import { ClientAddress, type AnonymousRequestShape, type ClientRequestLike } from './clientAddress';

/** Liest einen positiven Integer aus der Umgebung; alles andere faellt auf den Default. */
export function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// --- Ablehnungen ---

export type AdmissionDenialReason =
    | 'queue_full'
    | 'queue_timeout'
    | 'source_queue_full'
    | 'source_rate'
    | 'cancelled';

/** Eine Ablehnung — Status, Wartezeit und ein englischer Text fuer den Client. */
export class AdmissionDenial {
    /** Vorschlag fuer Retry-After, wenn die Schlange voll ist: kurz, die Schlange bewegt sich. */
    static readonly QUEUE_FULL_RETRY_AFTER_S = 10;
    /** Vorschlag fuer Retry-After, wenn die Quelle schon genug Laeufe eingereiht hat. */
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

    static sourceQueueFull(maxQueued: number): AdmissionDenial {
        return new AdmissionDenial(429, 'source_queue_full', AdmissionDenial.SOURCE_BUSY_RETRY_AFTER_S,
            `Too many queued runs from your client (max ${maxQueued} waiting). Wait for your running requests to finish.`);
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

/** Grenzen einer Quellen-Art (anonym oder angemeldet). */
export interface SourceLimits {
    /** Gleichzeitig AKTIVE Laeufe je Quelle; weitere warten. */
    maxActive: number;
    /** Wartende Laeufe je Quelle; darueber 429. */
    maxQueued: number;
    /** Nachfuellrate des Token-Buckets. */
    perMinute: number;
    /** Fassungsvermoegen des Buckets (Stoss). */
    burst: number;
}

export interface SourceRunGateOptions {
    /** Anonyme Quellen (`anon:<ip>`). */
    anonymous: SourceLimits;
    /** Angemeldete Quellen (`user:<id>`, `super`). */
    authenticated: SourceLimits;
    /** Obergrenze fuer gleichzeitig verfolgte Quellen. */
    maxTrackedSources?: number;
    /** Uhr — austauschbar fuer Tests. */
    now?: () => number;
}

/** Zustand einer Quelle: aktive und wartende Laeufe und ein Token-Bucket mit lazy Nachfuellung. */
class SourceState {
    active = 0;
    queued = 0;
    private tokens: number;
    private refilledAt: number;
    private readonly perMs: number;

    constructor(readonly limits: SourceLimits, now: number) {
        this.tokens = limits.burst;
        this.refilledAt = now;
        this.perMs = limits.perMinute / 60_000;
    }

    get canStart(): boolean {
        return this.active < this.limits.maxActive;
    }

    get queueFull(): boolean {
        return this.queued >= this.limits.maxQueued;
    }

    private refill(now: number): void {
        if (now <= this.refilledAt) return;
        this.tokens = Math.min(this.limits.burst, this.tokens + (now - this.refilledAt) * this.perMs);
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

    get isBusy(): boolean {
        return this.active > 0 || this.queued > 0;
    }

    /** Nichts laeuft, nichts wartet und der Bucket ist voll: der Eintrag traegt keine Information mehr. */
    isIdle(now: number): boolean {
        this.refill(now);
        return !this.isBusy && this.tokens >= this.limits.burst;
    }
}

/**
 * Der Platz eines Laufs in seiner Quelle: erst wartend, dann aktiv, dann weg. `leave()` genau einmal
 * wirksam; gibt ein AKTIVER Lauf seinen Platz frei, erfahren es alle Toepfe (`onActiveFreed`).
 */
export class SourcePass {
    private phase: 'queued' | 'active' | 'left';

    constructor(
        private readonly state: SourceState | null,
        startsActive: boolean,
        private readonly onActiveFreed: () => void = () => undefined,
    ) {
        this.phase = startsActive ? 'active' : 'queued';
    }

    /** Fuer Laeufe ohne Sperre je Quelle (UI-Listen): immer startbereit, zaehlt nirgends. */
    static unlimited(): SourcePass {
        return new SourcePass(null, false);
    }

    /** Darf dieser (wartende) Lauf jetzt starten, ohne die Grenze seiner Quelle zu reissen? */
    get canStart(): boolean {
        return this.state === null || this.state.canStart;
    }

    /** Wartend -> aktiv. */
    start(): void {
        if (this.phase !== 'queued') return;
        this.phase = 'active';
        if (!this.state) return;
        this.state.queued = Math.max(0, this.state.queued - 1);
        this.state.active++;
    }

    leave(): void {
        if (this.phase === 'left') return;
        const wasActive = this.phase === 'active';
        this.phase = 'left';
        if (!this.state) return;
        if (wasActive) {
            this.state.active = Math.max(0, this.state.active - 1);
            this.onActiveFreed();
        } else {
            this.state.queued = Math.max(0, this.state.queued - 1);
        }
    }
}

export type SourceEntry =
    | { ok: true; pass: SourcePass; startsNow: boolean }
    | { ok: false; denial: AdmissionDenial };

export interface SourceRunGateStats {
    trackedSources: number;
    anonymous: SourceLimits;
    authenticated: SourceLimits;
    /** Groesste Zahl Wartender einer einzelnen Quelle gerade jetzt. */
    queuedBySourceMax: number;
    rejectedSourceQueueFullSinceBoot: number;
    rejectedRateSinceBoot: number;
}

export class SourceRunGate {
    /** Wie oft hoechstens gefegt wird — leere Eintraege verfallen spaetestens dann. */
    private static readonly SWEEP_INTERVAL_MS = 30_000;
    /** Default fuer die Zahl verfolgter Quellen. Je Eintrag ~100 Byte; 10.000 = ~1 MB. */
    static readonly DEFAULT_MAX_TRACKED_SOURCES = 10_000;

    /** Einfuegereihenfolge = LRU-Reihenfolge (jeder Zugriff setzt den Eintrag ans Ende). */
    private readonly sources = new Map<string, SourceState>();
    /** Toepfe, die erfahren wollen, wenn eine Quelle einen aktiven Platz freigibt. */
    private readonly freedListeners = new Set<() => void>();
    private readonly anonymous: SourceLimits;
    private readonly authenticated: SourceLimits;
    private readonly maxTracked: number;
    private readonly now: () => number;
    private lastSweepAt = 0;
    private rejectedQueueFull = 0;
    private rejectedRate = 0;

    constructor(options: SourceRunGateOptions) {
        this.anonymous = SourceRunGate.normalized(options.anonymous);
        this.authenticated = SourceRunGate.normalized(options.authenticated);
        this.maxTracked = options.maxTrackedSources ?? SourceRunGate.DEFAULT_MAX_TRACKED_SOURCES;
        this.now = options.now ?? Date.now;
    }

    static fromEnv(): SourceRunGate {
        const maxQueued = positiveIntFromEnv('RUNS_PER_SOURCE_MAX_QUEUED', 8);
        return new SourceRunGate({
            anonymous: {
                maxActive: positiveIntFromEnv('RUNS_PER_SOURCE_MAX_ACTIVE', 2),
                maxQueued,
                perMinute: positiveIntFromEnv('RUNS_PER_SOURCE_PER_MINUTE', 20),
                burst: positiveIntFromEnv('RUNS_PER_SOURCE_BURST', 12),
            },
            authenticated: {
                maxActive: positiveIntFromEnv('RUNS_PER_USER_MAX_ACTIVE', 3),
                maxQueued,
                perMinute: positiveIntFromEnv('RUNS_PER_USER_PER_MINUTE', 60),
                burst: positiveIntFromEnv('RUNS_PER_USER_BURST', 20),
            },
        });
    }

    /** Ein Topf meldet sich an: er wird gerufen, wenn irgendeine Quelle einen aktiven Platz freigibt. */
    onActiveFreed(listener: () => void): void {
        this.freedListeners.add(listener);
    }

    /**
     * Eine Quelle will einen Lauf. `potHasRoom`: hat der Topf gerade einen freien Platz? Startet der Lauf
     * nicht sofort (Topf voll oder Quelle am Limit), wird er eingereiht — 429 nur bei voller Quellen-Schlange
     * (kostet kein Token) oder leerem Bucket. Der Pass zaehlt, bis der Lauf endet.
     */
    enter(sourceKey: string, potHasRoom: boolean): SourceEntry {
        const now = this.now();
        this.sweepIfDue(now);
        const state = this.stateOf(sourceKey, now);
        const startsNow = potHasRoom && state.canStart;
        if (!startsNow && state.queueFull) {
            this.rejectedQueueFull++;
            return { ok: false, denial: AdmissionDenial.sourceQueueFull(state.limits.maxQueued) };
        }
        const token = state.take(now);
        if (!token.ok) {
            this.rejectedRate++;
            return { ok: false, denial: AdmissionDenial.sourceRate(state.limits.perMinute, token.retryAfterSec) };
        }
        if (startsNow) state.active++;
        else state.queued++;
        return { ok: true, startsNow, pass: new SourcePass(state, startsNow, () => this.notifyFreed()) };
    }

    stats(): SourceRunGateStats {
        let queuedBySourceMax = 0;
        for (const state of this.sources.values()) queuedBySourceMax = Math.max(queuedBySourceMax, state.queued);
        return {
            trackedSources: this.sources.size,
            anonymous: { ...this.anonymous },
            authenticated: { ...this.authenticated },
            queuedBySourceMax,
            rejectedSourceQueueFullSinceBoot: this.rejectedQueueFull,
            rejectedRateSinceBoot: this.rejectedRate,
        };
    }

    /** Nur fuer Tests: sofort fegen, unabhaengig vom Intervall. */
    sweepNow(): void {
        this.sweep(this.now());
    }

    private static normalized(limits: SourceLimits): SourceLimits {
        return {
            maxActive: Math.max(1, limits.maxActive),
            maxQueued: Math.max(0, limits.maxQueued),
            perMinute: Math.max(1, limits.perMinute),
            burst: Math.max(1, limits.burst),
        };
    }

    private limitsFor(sourceKey: string): SourceLimits {
        return RunSource.isAuthenticated(sourceKey) ? this.authenticated : this.anonymous;
    }

    private notifyFreed(): void {
        for (const listener of this.freedListeners) listener();
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
        const state = new SourceState(this.limitsFor(sourceKey), now);
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
     * Voll trotz Fegen: die am laengsten unbenutzten Quellen ohne laufenden oder wartenden Lauf gehen (ihr
     * Bucket-Gedaechtnis geht verloren — der Preis fuer eine feste Obergrenze). Beschaeftigte Quellen bleiben;
     * davon gibt es hoechstens so viele, wie die Toepfe Plaetze plus Schlange haben.
     */
    private evictOldestIdle(): void {
        for (const [key, state] of this.sources) {
            if (this.sources.size < this.maxTracked) return;
            if (!state.isBusy) this.sources.delete(key);
        }
    }
}

// --- Topf mit fairer Schlange ---

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
    /** Obergrenze der Schlange (alle Quellen zusammen); darueber sofort 503. */
    queueMax: number;
}

export interface RunAdmissionStats {
    name: string;
    active: number;
    waiting: number;
    /** Quellen mit mindestens einem Wartenden in diesem Topf. */
    waitingSources: number;
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
    queueKey: string;
    timer: ReturnType<typeof setTimeout>;
}

export class RunAdmission {
    /** Schlangen-Schluessel fuer Laeufe ohne Sperre je Quelle (UI-Listen): eine gemeinsame Runde. */
    private static readonly UNSOURCED = '\u0000unsourced';

    private active = 0;
    /** Wartende je Quelle (FIFO). Einfuegereihenfolge der Map = Reihenfolge der Runde (Round-Robin). */
    private readonly queues = new Map<string, Waiter[]>();
    private waitingCount = 0;
    private readonly gates = new Set<SourceRunGate>();
    private dispatching = false;
    private dispatchAgain = false;
    private rejectedQueueFull = 0;
    private rejectedQueueTimeout = 0;
    private withdrawn = 0;

    constructor(private readonly options: RunAdmissionOptions) {}

    get name(): string {
        return this.options.name;
    }

    /**
     * Bittet um einen Platz. Mit `sourceKey` und `sourceGate` gilt die Sperre je Quelle (429 nur bei voller
     * Quellen-Schlange oder leerem Bucket). Freier Platz und Quelle unter ihrem Limit -> sofort; sonst in
     * die Schlange der Quelle bis zum Wartebudget; volle Topf-Schlange -> 503 sofort.
     */
    request(sourceKey?: string | null, sourceGate?: SourceRunGate | null): PendingAdmission {
        const pending = new PendingAdmission((p) => this.withdraw(p));
        const potHasRoom = this.active < this.options.maxConcurrent;
        let pass = SourcePass.unlimited();
        let startsNow = potHasRoom;
        if (sourceKey && sourceGate) {
            this.listenTo(sourceGate);
            const entered = sourceGate.enter(sourceKey, potHasRoom);
            if (!entered.ok) {
                pending.decide({ granted: false, denial: entered.denial });
                return pending;
            }
            pass = entered.pass;
            startsNow = entered.startsNow;
        }

        if (startsNow) {
            this.active++;
            pending.decide({ granted: true, ticket: this.ticketFor(pass) });
            return pending;
        }

        if (this.waitingCount >= this.options.queueMax) {
            this.rejectedQueueFull++;
            pass.leave();
            pending.decide({ granted: false, denial: AdmissionDenial.queueFull() });
            return pending;
        }

        const waiter: Waiter = {
            pending,
            pass,
            queueKey: sourceKey && sourceGate ? sourceKey : RunAdmission.UNSOURCED,
            timer: setTimeout(() => this.expire(waiter), this.options.queueTimeoutMs),
        };
        // Ein Wartender darf den Prozess nicht am Leben halten (bei HTTP haelt ihn die Socket).
        waiter.timer.unref?.();
        this.enqueue(waiter);
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
            waiting: this.waitingCount,
            waitingSources: this.queues.size,
            maxConcurrent: this.options.maxConcurrent,
            queueMax: this.options.queueMax,
            queueTimeoutMs: this.options.queueTimeoutMs,
            rejectedQueueFullSinceBoot: this.rejectedQueueFull,
            rejectedQueueTimeoutSinceBoot: this.rejectedQueueTimeout,
            withdrawnWhileWaitingSinceBoot: this.withdrawn,
        };
    }

    private listenTo(gate: SourceRunGate): void {
        if (this.gates.has(gate)) return;
        this.gates.add(gate);
        gate.onActiveFreed(() => this.dispatch());
    }

    private ticketFor(pass: SourcePass): RunTicket {
        return new RunTicket(() => {
            if (this.active <= 0) {
                console.error(`[RunAdmission:${this.options.name}] release without an active run — counter out of step`);
            } else {
                this.active--;
            }
            // Gibt die Quelle einen aktiven Platz frei, ruft das Gate dispatch() aller Toepfe; fuer Laeufe ohne
            // Quelle (und sicherheitshalber) hier noch einmal — dispatch() ist idempotent.
            pass.leave();
            this.dispatch();
        });
    }

    private enqueue(waiter: Waiter): void {
        const queue = this.queues.get(waiter.queueKey);
        if (queue) queue.push(waiter);
        else this.queues.set(waiter.queueKey, [waiter]);
        this.waitingCount++;
    }

    /**
     * Vergibt freie Plaetze reihum: die erste Quelle der Runde, deren aeltester Wartender starten darf, bekommt
     * EINEN Platz und rueckt ans Ende der Runde. Quellen am Limit bleiben vorn stehen (sie sind dran, sobald
     * sie wieder duerfen). Wiedereintritt (eine Freigabe waehrend der Vergabe) laeuft als weitere Runde.
     */
    private dispatch(): void {
        if (this.dispatching) {
            this.dispatchAgain = true;
            return;
        }
        this.dispatching = true;
        try {
            do {
                this.dispatchAgain = false;
                while (this.active < this.options.maxConcurrent) {
                    const next = this.takeNextEligible();
                    if (!next) break;
                    this.grant(next);
                }
            } while (this.dispatchAgain);
        } finally {
            this.dispatching = false;
        }
    }

    private takeNextEligible(): Waiter | null {
        for (const [key, queue] of this.queues) {
            const head = queue[0];
            if (!head.pass.canStart) continue;
            queue.shift();
            this.queues.delete(key);
            if (queue.length > 0) this.queues.set(key, queue);
            this.waitingCount--;
            return head;
        }
        return null;
    }

    private grant(waiter: Waiter): void {
        clearTimeout(waiter.timer);
        // Geschlossene Anfragen stehen nie in der Schlange (withdraw), aber sicher ist sicher:
        // ein Platz geht nur an jemanden, der noch zuhoert.
        if (waiter.pending.isClosed) {
            waiter.pass.leave();
            return;
        }
        this.active++;
        waiter.pass.start();
        // Liefert false nur, wenn die Anfrage inzwischen geschlossen ist — dann gibt decide() das Ticket zurueck.
        waiter.pending.decide({ granted: true, ticket: this.ticketFor(waiter.pass) });
    }

    /** Nimmt einen Wartenden aus seiner Schlange; false, wenn er dort nicht (mehr) steht. */
    private remove(waiter: Waiter): boolean {
        const queue = this.queues.get(waiter.queueKey);
        const index = queue ? queue.indexOf(waiter) : -1;
        if (!queue || index < 0) return false;
        queue.splice(index, 1);
        if (queue.length === 0) this.queues.delete(waiter.queueKey);
        this.waitingCount--;
        clearTimeout(waiter.timer);
        waiter.pass.leave();
        return true;
    }

    private withdraw(pending: PendingAdmission): void {
        for (const queue of this.queues.values()) {
            const waiter = queue.find((w) => w.pending === pending);
            if (waiter) {
                if (this.remove(waiter)) this.withdrawn++;
                return;
            }
        }
    }

    private expire(waiter: Waiter): void {
        if (!this.remove(waiter)) return;
        this.rejectedQueueTimeout++;
        waiter.pending.decide({ granted: false, denial: AdmissionDenial.queueTimeout(this.options.queueTimeoutMs) });
    }
}

// --- Quelle eines Aufrufs ---

/**
 * Wer ruft? Angemeldet (Session oder PAT/Bearer): `user:<id>` — ueber alle Geraete und Wege dieselbe Quelle.
 * Anonym: `anon:<Client-IP>` (ClientAddress: CF-Connecting-IP auf Render, sonst `req.ip`), IPv6 auf /64
 * zusammengefasst — sonst teilt sich jeder Anschluss beliebig viele Quellen. Ohne Adresse: `super` (lokaler
 * Super-User) bzw. `anon`.
 */
export class RunSource {
    static of(ctx: AuthCtx | null | undefined, ip: string | null | undefined): string {
        if (ctx?.user?.id) return `user:${ctx.user.id}`;
        if (ip) return `anon:${ClientAddress.keyOf(ip)}`;
        if (ctx?.isSuperUser) return 'super';
        return 'anon';
    }

    static ofRequest(req: ClientRequestLike & { ctx?: AuthCtx }, clientAddress: ClientAddress): string {
        return RunSource.of(req.ctx, clientAddress.ipOf(req));
    }

    /** Angemeldete Quellen (eigene, hoehere Grenzen): `user:<id>` und der lokale Super-User. */
    static isAuthenticated(sourceKey: string): boolean {
        return sourceKey.startsWith('user:') || sourceKey === 'super';
    }
}

// --- Die Toepfe des Prozesses ---

export interface RunGatesStats {
    pots: RunAdmissionStats[];
    sources: SourceRunGateStats;
    /** Form der letzten anonymen Lauf-Anfrage (nur Zahlen/Schalter) — belegt, welche Header ankommen. */
    lastAnonymousShape: AnonymousRequestShape | null;
    rejected429SinceBoot: number;
    rejected503SinceBoot: number;
}

/**
 * Alle Zulassungen eines Prozesses: `heavy` (UI-Listen, Werkstatt-Laeufe, MCP-Laeufe), `publicRuns`
 * (/k/:id, /k/:id/openapi.json), die gemeinsame Sperre je Quelle und die Ableitung der Client-Adresse.
 */
export class RunGates {
    constructor(
        readonly heavy: RunAdmission,
        readonly publicRuns: RunAdmission,
        readonly sources: SourceRunGate,
        readonly clientAddress: ClientAddress = ClientAddress.fromEnv(),
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
            ClientAddress.fromEnv(),
        );
    }

    /**
     * Ein Kennel-Lauf aus MCP/Actions — in-process, im Heavy-Topf, mit Sperre je Quelle. Anonyme Aufrufer
     * zaehlen unter ihrer Client-IP (`ctx.clientIp`, gesetzt von ClientAddress.contextMiddleware). Der
     * Aufrufer gibt das Ticket nach Laufende zurueck (finally).
     */
    requestRun(ctx: AuthCtx | null | undefined): PendingAdmission {
        return this.heavy.request(RunSource.of(ctx, ctx?.clientIp ?? null), this.sources);
    }

    stats(): RunGatesStats {
        const pots = [this.heavy.stats(), this.publicRuns.stats()];
        const sources = this.sources.stats();
        return {
            pots,
            sources,
            lastAnonymousShape: this.clientAddress.lastAnonymousShape,
            rejected429SinceBoot: sources.rejectedSourceQueueFullSinceBoot + sources.rejectedRateSinceBoot,
            rejected503SinceBoot: pots.reduce((sum, p) => sum + p.rejectedQueueFullSinceBoot + p.rejectedQueueTimeoutSinceBoot, 0),
        };
    }
}
