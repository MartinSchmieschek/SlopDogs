// KennelCallCounter — zaehlt jeden Kennel-Lauf im Speicher und schreibt die Deltas alle 30 s in
// EINER Transaktion in die DB (P4 4.3). Der Lauf selbst merkt davon nichts: record() ist
// synchron, O(1), ohne DB und wirft nie. Verlust bei SIGKILL/OOM <= ein Flush-Intervall
// (akzeptiert, Amar-Empfehlung 5); SIGTERM flusht ueber stop().
//
// P4b: derselbe Zaehler zaehlt auch jeden einzelnen Dog-Lauf (recordDog) — zweite Map, derselbe
// Deckel (gemeinsam gegen KENNEL_CALL_MAX_PENDING), derselbe Flush (eine Transaktion fuer beide).
import type {
    DogCallAggregate,
    DogCallDelta,
    IKennelStatsStore,
    KennelCallAggregate,
    KennelCallDelta,
    KennelCallSource,
} from '../store/IKennelStatsStore';
import { RANKED_CALL_SOURCES } from '../store/IKennelStatsStore';
import { isCacheInfraError } from './resilientCacheHandler';

export interface KennelCallCounterOptions {
    flushIntervalMs?: number;   // Default env KENNEL_CALL_FLUSH_MS, sonst 30_000; 0 = kein Timer (Tests)
    maxPending?: number;        // Default env KENNEL_CALL_MAX_PENDING, sonst 10_000 Schluessel
    now?: () => Date;           // Testhaken fuer die Tagesgrenze
    onFlushed?: () => void;     // StatsService.invalidate()
}

const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
const DEFAULT_MAX_PENDING = 10_000;

/** Der UTC-Tag eines Zeitpunkts, 'YYYY-MM-DD' — so steht er in der DB. */
export function utcDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function intFromEnv(name: string, fallback: number, allowZero: boolean): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    if (!Number.isInteger(parsed)) return fallback;
    return parsed > 0 || (allowZero && parsed === 0) ? parsed : fallback;
}

const RANKED = new Set<KennelCallSource>(RANKED_CALL_SOURCES);

/** Ein einzelner Dog-Lauf, wie ihn der Observer in runKennel meldet (P4b 4b.5). */
export interface DogRunRecord {
    dogKey: string;
    kennelLineageId: string;
    source: KennelCallSource;
    outcome: 'ok' | 'error' | 'timeout' | 'oom';
    /** ok ohne Fetch, mindestens ein Cache-Treffer — zaehlt als `cached` statt `ok`. */
    cached: boolean;
    cacheHits: number;
    cacheMisses: number;
    durationMs: number;
}

/** Ungeflushte Dog-Laeufe je Dog — wie DogCallAggregate, dazu die Kennels der Deltas (fuer kennelsRun30d). */
export type PendingDogAggregate = Omit<DogCallAggregate, 'dogKey' | 'kennelsRun30d'> & { kennels: Set<string> };

function dogDeltaKey(d: { dogKey: string; kennelLineageId: string; day: string; source: string }): string {
    return `${d.dogKey}\u0000${d.kennelLineageId}\u0000${d.day}\u0000${d.source}`;
}

function addDogDelta(into: DogCallDelta, d: DogCallDelta): void {
    into.count += d.count;
    into.ok += d.ok;
    into.cached += d.cached;
    into.errors += d.errors;
    into.timeouts += d.timeouts;
    into.oom += d.oom;
    into.cacheHits += d.cacheHits;
    into.cacheMisses += d.cacheMisses;
    into.durationMsSum += d.durationMsSum;
    into.durationMsMax = Math.max(into.durationMsMax, d.durationMsMax);
}

export class KennelCallCounter {
    private readonly pending = new Map<string, KennelCallDelta>();
    private readonly pendingDogs = new Map<string, DogCallDelta>();
    private readonly flushIntervalMs: number;
    private readonly maxPending: number;
    private readonly now: () => Date;
    private onFlushed?: () => void;
    private flushing: Promise<void> | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private dropped = 0;
    private lastFlushError: string | null = null;

    constructor(private readonly store: IKennelStatsStore, options: KennelCallCounterOptions = {}) {
        this.flushIntervalMs = options.flushIntervalMs ?? intFromEnv('KENNEL_CALL_FLUSH_MS', DEFAULT_FLUSH_INTERVAL_MS, true);
        this.maxPending = options.maxPending ?? intFromEnv('KENNEL_CALL_MAX_PENDING', DEFAULT_MAX_PENDING, false);
        this.now = options.now ?? (() => new Date());
        this.onFlushed = options.onFlushed;
    }

    /** Der Stats-Dienst entsteht nach dem Zaehler — er meldet sich hier fuer die Invalidierung an. */
    setOnFlushed(onFlushed: () => void): void {
        this.onFlushed = onFlushed;
    }

    /** Synchron, O(1), wirft nie. day = utcDay(now()). */
    record(lineageId: string, source: KennelCallSource, leadFailed: boolean): void {
        try {
            const day = utcDay(this.now());
            const key = `${lineageId}\u0000${day}\u0000${source}`;
            const delta = this.pending.get(key);
            if (delta) {
                delta.count += 1;
                if (leadFailed) delta.leadFailed += 1;
                return;
            }
            // Deckel: ein NEUER Schluessel ueber dem Deckel wird verworfen — nie ein alter.
            if (this.isFull()) {
                this.dropped += 1;
                return;
            }
            this.pending.set(key, { lineageId, day, source, count: 1, leadFailed: leadFailed ? 1 : 0 });
        } catch {
            // Zaehlen darf keinen Lauf stoeren.
        }
    }

    /**
     * Ein Dog-Lauf (P4b). Synchron, O(1), ohne DB, wirft nie — der Observer ruft es im finally von
     * letOut(), mitten in der Welle. Genau eine Ergebnisklasse je Lauf.
     */
    recordDog(input: DogRunRecord): void {
        try {
            const day = utcDay(this.now());
            const durationMs = Math.max(0, Math.round(Number(input.durationMs) || 0));
            const delta: DogCallDelta = {
                dogKey: input.dogKey,
                kennelLineageId: input.kennelLineageId,
                day,
                source: input.source,
                count: 1,
                ok: input.outcome === 'ok' && !input.cached ? 1 : 0,
                cached: input.outcome === 'ok' && input.cached ? 1 : 0,
                errors: input.outcome === 'error' ? 1 : 0,
                timeouts: input.outcome === 'timeout' ? 1 : 0,
                oom: input.outcome === 'oom' ? 1 : 0,
                cacheHits: input.cacheHits,
                cacheMisses: input.cacheMisses,
                durationMsSum: durationMs,
                durationMsMax: durationMs,
            };
            const key = dogDeltaKey(delta);
            const existing = this.pendingDogs.get(key);
            if (existing) {
                addDogDelta(existing, delta);
                return;
            }
            if (this.isFull()) {
                this.dropped += 1;
                return;
            }
            this.pendingDogs.set(key, delta);
        } catch {
            // Zaehlen darf keinen Lauf stoeren.
        }
    }

    /** Kennel- und Dog-Schluessel teilen sich einen Deckel. */
    private isFull(): boolean {
        return this.pending.size + this.pendingDogs.size >= this.maxPending;
    }

    /** Ungeflushte Dog-Laeufe als Aggregat je Dog — dieselben Fenster-Regeln wie readDogCallAggregates. */
    pendingDogAggregates(sinceDay: string): Map<string, PendingDogAggregate> {
        const out = new Map<string, PendingDogAggregate>();
        for (const d of this.pendingDogs.values()) {
            const agg = out.get(d.dogKey) ?? {
                total: 0, last30d: 0, ranked30d: 0, failures: 0, failures30d: 0, cached30d: 0,
                durationMsSum30d: 0, count30d: 0, durationMsMax30d: 0, kennels: new Set<string>(),
            };
            agg.total += d.count;
            agg.failures += d.errors + d.timeouts + d.oom;
            if (d.day >= sinceDay) {
                agg.last30d += d.count;
                agg.count30d += d.count;
                if (RANKED.has(d.source)) agg.ranked30d += d.count;
                agg.failures30d += d.errors + d.timeouts + d.oom;
                agg.cached30d += d.cached;
                agg.durationMsSum30d += d.durationMsSum;
                agg.durationMsMax30d = Math.max(agg.durationMsMax30d, d.durationMsMax);
                if (d.count > 0) agg.kennels.add(d.kennelLineageId);
            }
            out.set(d.dogKey, agg);
        }
        return out;
    }

    /** Ungeflushte Laeufe EINES Dogs je Kennel (fuer die Nutzungsliste) — count und Fehler im Fenster. */
    pendingDogKennelUsage(dogKey: string, sinceDay: string): Map<string, { count30d: number; failures30d: number }> {
        const out = new Map<string, { count30d: number; failures30d: number }>();
        for (const d of this.pendingDogs.values()) {
            if (d.dogKey !== dogKey || d.day < sinceDay) continue;
            const u = out.get(d.kennelLineageId) ?? { count30d: 0, failures30d: 0 };
            u.count30d += d.count;
            u.failures30d += d.errors + d.timeouts + d.oom;
            out.set(d.kennelLineageId, u);
        }
        return out;
    }

    /** Dog geloescht (letzte Version): seine ungeflushten Deltas fallen weg. */
    forgetDog(dogKey: string): void {
        for (const [key, d] of this.pendingDogs) {
            if (d.dogKey === dogKey) this.pendingDogs.delete(key);
        }
    }

    /** Ungeflushte Deltas als Aggregat je Lineage — Reads in dieser Instanz sind damit exakt. */
    pendingAggregates(sinceDay: string): Map<string, Omit<KennelCallAggregate, 'lineageId'>> {
        const out = new Map<string, Omit<KennelCallAggregate, 'lineageId'>>();
        for (const d of this.pending.values()) {
            const agg = out.get(d.lineageId) ?? { total: 0, last30d: 0, leadFailed: 0, leadFailed30d: 0, rankedTotal: 0, ranked30d: 0 };
            const inWindow = d.day >= sinceDay;
            const ranked = RANKED.has(d.source);
            agg.total += d.count;
            agg.leadFailed += d.leadFailed;
            if (inWindow) agg.last30d += d.count;
            if (inWindow) agg.leadFailed30d += d.leadFailed;
            if (ranked) agg.rankedTotal += d.count;
            if (ranked && inWindow) agg.ranked30d += d.count;
            out.set(d.lineageId, agg);
        }
        return out;
    }

    /** Kennel geloescht: seine ungeflushten Deltas fallen weg — die Kennel-Zaehlung und die Dog-Laeufe in ihm. */
    forgetKennel(lineageId: string): void {
        for (const [key, d] of this.pending) {
            if (d.lineageId === lineageId) this.pending.delete(key);
        }
        for (const [key, d] of this.pendingDogs) {
            if (d.kennelLineageId === lineageId) this.pendingDogs.delete(key);
        }
    }

    /** Idempotent, serialisiert, wirft nie; Fehler landet in lastFlushError, Deltas bleiben. */
    flush(): Promise<void> {
        if (!this.flushing) {
            this.flushing = this.flushOnce().finally(() => { this.flushing = null; });
        }
        return this.flushing;
    }

    private async flushOnce(): Promise<void> {
        if (this.pending.size === 0 && this.pendingDogs.size === 0) return;
        const batch = Array.from(this.pending.values());
        const dogBatch = Array.from(this.pendingDogs.values());
        this.pending.clear();
        this.pendingDogs.clear();
        try {
            // Eine Transaktion fuer Kennel- und Dog-Deltas (P4b): beide oder keins.
            await this.store.incrementKennelCalls(batch, dogBatch);
            this.lastFlushError = null;
        } catch (err) {
            this.retain(batch);
            this.retainDogs(dogBatch);
            this.lastFlushError = (err as Error)?.message ?? String(err);
            const line = `[KennelCallCounter] flush failed, ${batch.length + dogBatch.length} deltas retained: ${this.lastFlushError.slice(0, 160)}`;
            // Eine belegte/traege DB ist Betrieb, kein Defekt — wie beim Cache nur eine Warnung.
            if (isCacheInfraError(err)) console.warn(line); else console.error(line);
            return;
        }
        try { this.onFlushed?.(); } catch { /* die Invalidierung darf den Flush nicht werfen lassen */ }
    }

    /** Einen gescheiterten Batch zurueckmergen — unter demselben Deckel wie record(). */
    private retain(batch: KennelCallDelta[]): void {
        for (const d of batch) {
            const key = `${d.lineageId}\u0000${d.day}\u0000${d.source}`;
            const existing = this.pending.get(key);
            if (existing) {
                existing.count += d.count;
                existing.leadFailed += d.leadFailed;
            } else if (this.isFull()) {
                this.dropped += d.count;
            } else {
                this.pending.set(key, { ...d });
            }
        }
    }

    /** Dasselbe fuer die Dog-Deltas eines gescheiterten Batches. */
    private retainDogs(batch: DogCallDelta[]): void {
        for (const d of batch) {
            const key = dogDeltaKey(d);
            const existing = this.pendingDogs.get(key);
            if (existing) addDogDelta(existing, d);
            else if (this.isFull()) this.dropped += d.count;
            else this.pendingDogs.set(key, { ...d });
        }
    }

    /** setInterval + unref: der Timer haelt den Prozess nicht am Leben. 0 = kein Timer. */
    start(): void {
        if (this.timer || this.flushIntervalMs <= 0) return;
        this.timer = setInterval(() => { void this.flush(); }, this.flushIntervalMs);
        this.timer.unref?.();
    }

    /** Timer aus + letzter Flush (wartet auf einen laufenden und flusht den Rest). */
    async stop(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        await this.flush();
        if (this.pending.size > 0 || this.pendingDogs.size > 0) await this.flush();
    }

    status(): { pending: number; pendingDogs: number; dropped: number; lastFlushError: string | null } {
        return { pending: this.pending.size, pendingDogs: this.pendingDogs.size, dropped: this.dropped, lastFlushError: this.lastFlushError };
    }
}
