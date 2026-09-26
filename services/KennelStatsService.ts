// KennelStatsService — haengt `stats` an Kennel-Antworten (P4 4.4): Aufrufe aus der DB plus die
// ungeflushten Deltas dieser Instanz, Sterne als Rohschnitt und als Bayes-Score. Gelesen wird aus
// EINEM Memo fuer alle Lineages (zwei GROUP BY je Memo-Leben), nie je Kennel. Die Memo-Maps
// enthalten auch private Lineages — sie verlassen den Prozess nur ueber attach(), und attach()
// sieht nur, was der Aufrufer schon durch seinen Rechtefilter gelassen hat.
import type {
    IKennelStatsStore,
    KennelCallAggregate,
    KennelRatingHistogram,
} from '../store/IKennelStatsStore';
import { KennelCallCounter, utcDay } from './KennelCallCounter';
import type { AuthCtx } from '../mcp/auth/middleware';
import { canRun, parseList, type AclEntity } from '../mcp/auth/visibility';

export interface KennelStats {
    /** leadFailed ueber alle Tage, leadFailed30d in den letzten 30 Tagen (Aufruf-Filter usage=failing/never_worked). */
    calls:  { total: number; last30d: number; leadFailed: number; leadFailed30d: number; ranked: number; ranked30d: number };
    rating: { avg: number | null; count: number; score: number };   // avg null bei count 0; score 0 bei count 0
}

export type KennelRatingView = KennelStats['rating'] & {
    lineageId: string;
    histogram: KennelRatingHistogram;
    mine: number | null;
};

/** Eine abgelehnte Bewertung — Status und Code wie in der REST-Antwort (4.4.1). */
export class RatingError extends Error {
    constructor(readonly status: 400 | 401 | 403 | 404, readonly code: string, description?: string) {
        super(description ?? code);
        this.name = 'RatingError';
    }
}

/** Ein bewertbarer Kennel: Rechte-Felder plus Schluessel. */
export type RatableKennel = AclEntity & { id: string; lineageId?: string };

type CallCounts = Omit<KennelCallAggregate, 'lineageId'>;

interface StatsMemo {
    at: number;
    sinceDay: string;
    calls: Map<string, CallCounts>;
    ratings: Map<string, { count: number; sum: number }>;
    globalMean: number;
}

const DAY_MS = 86_400_000;
const NO_CALLS: CallCounts = { total: 0, last30d: 0, leadFailed: 0, leadFailed30d: 0, rankedTotal: 0, ranked30d: 0 };

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Der Schluessel einer Kennel-Antwort: die Lineage, fuer Altbestand ohne lineageId die id. */
export function statsKeyOf(k: { id: string; lineageId?: string }): string {
    return k.lineageId || k.id;
}

export class KennelStatsService {
    static readonly BAYES_C = 5;
    static readonly WINDOW_DAYS = 30;

    private memo: StatsMemo | null = null;
    private loading: Promise<StatsMemo> | null = null;
    private readonly invalidationListeners: Array<() => void> = [];
    /** Wie oft das Memo aus der DB geladen wurde — Messpunkt fuer Tests und Abnahme (4.13). */
    private memoLoadCount = 0;
    /** Zaehlt Invalidierungen: ein Laden, das eine Invalidierung ueberholt hat, merkt sich nichts. */
    private generation = 0;

    constructor(
        private readonly store: IKennelStatsStore,
        private readonly counter: KennelCallCounter,
        private readonly memoMs = positiveIntFromEnv('KENNEL_STATS_MEMO_MS', 30_000),
        private readonly now: () => number = () => Date.now(),
    ) { }

    get memoLoads(): number {
        return this.memoLoadCount;
    }

    /** Haengt `stats` in place an (additiv wie lineageId/visibility). Schluessel: k.lineageId ?? k.id. */
    async attach<T extends { id: string; lineageId?: string }>(kennels: T[]): Promise<Array<T & { stats: KennelStats }>> {
        const memo = await this.current();
        const pending = this.counter.pendingAggregates(memo.sinceDay);
        for (const k of kennels) {
            const key = statsKeyOf(k);
            (k as T & { stats: KennelStats }).stats = this.statsOf(memo, key, pending.get(key));
        }
        return kennels as Array<T & { stats: KennelStats }>;
    }

    async attachOne<T extends { id: string; lineageId?: string }>(kennel: T): Promise<T & { stats: KennelStats }> {
        return (await this.attach([kennel]))[0];
    }

    /** Die Rating-Sicht einer Lineage — Aggregat, Verteilung und die eigene Bewertung (frisch aus der DB). */
    async ratingView(lineageId: string, userId: string | null): Promise<KennelRatingView> {
        const [memo, aggregates, histogram, mine] = await Promise.all([
            this.current(),
            this.store.readKennelRatingAggregates([lineageId]),
            this.store.readKennelRatingHistogram(lineageId),
            userId ? this.store.readKennelRating(lineageId, userId) : Promise.resolve(null),
        ]);
        const own = aggregates[0] ?? { count: 0, sum: 0 };
        return { lineageId, ...this.ratingOf(memo.globalMean, own.count, own.sum), histogram, mine };
    }

    /**
     * Setzt die Bewertung des Aufrufers (Regeln 4.4.1, Pruefreihenfolge 2-7; Regel 1 — Kennel
     * aufloesbar — ist Sache des Aufrufers). Wirft RatingError.
     */
    async setRating(kennel: RatableKennel, ctx: AuthCtx | undefined, stars: unknown): Promise<KennelRatingView> {
        const userId = KennelStatsService.raterOf(kennel, ctx, true);
        if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
            throw new RatingError(400, 'invalid_stars', 'stars must be an integer 1..5');
        }
        const lineageId = statsKeyOf(kennel);
        await this.store.upsertKennelRating(lineageId, userId, stars);
        this.invalidate();
        return this.ratingView(lineageId, userId);
    }

    /** Nimmt die eigene Bewertung zurueck — idempotent; Owner/Editor-Regel und stars entfallen. */
    async clearRating(kennel: RatableKennel, ctx: AuthCtx | undefined): Promise<KennelRatingView> {
        const userId = KennelStatsService.raterOf(kennel, ctx, false);
        const lineageId = statsKeyOf(kennel);
        if (await this.store.deleteKennelRating(lineageId, userId)) this.invalidate();
        return this.ratingView(lineageId, userId);
    }

    /**
     * Wer bewerten darf (4.4.1): bewertet wird, was man ausfuehren darf (W21, canRun) — sonst 404,
     * nichts verraten; eingeloggt mit echter Identitaet; nie der Owner, nie ein Editor.
     */
    private static raterOf(kennel: RatableKennel, ctx: AuthCtx | undefined, forWrite: boolean): string {
        if (!canRun(kennel, ctx)) throw new RatingError(404, 'not_found', 'Kennel not found');
        if (!ctx?.user && !ctx?.isSuperUser) throw new RatingError(401, 'unauthorized', 'Login required to rate.');
        const userId = ctx?.user?.id;
        if (!userId) throw new RatingError(403, 'no_identity', 'Super-user mode has no user identity to rate with.');
        if (forWrite && kennel.ownerId === userId) throw new RatingError(403, 'owner_cannot_rate', 'Owners do not rate their own kennel.');
        if (forWrite && parseList(kennel.editors).includes(userId)) throw new RatingError(403, 'editor_cannot_rate', 'Editors do not rate a kennel they edit.');
        return userId;
    }

    /**
     * Die Bayes-Scores der BEWERTETEN Kennels unter den genannten Lineages (P4b: Sterne-Faktor der
     * Bewaehrt-Formel). Aus demselben Memo wie attach — keine eigene Abfrage.
     */
    async ratedScores(lineageIds: Iterable<string>): Promise<number[]> {
        const memo = await this.current();
        const scores: number[] = [];
        for (const id of lineageIds) {
            const r = memo.ratings.get(id);
            if (r && r.count > 0) scores.push(KennelStatsService.score(r.count, r.sum, memo.globalMean));
        }
        return scores;
    }

    /** Nach Flush, Rating-Schreibzugriff und Kennel-Delete: das naechste attach laedt neu. */
    invalidate(): void {
        this.memo = null;
        this.loading = null;
        this.generation += 1;
        for (const listener of this.invalidationListeners) {
            try { listener(); } catch { /* ein Zuhoerer darf die Invalidierung nicht brechen */ }
        }
    }

    /** Abhaengige Memos (Landing) haengen sich hier an. */
    onInvalidate(listener: () => void): void {
        this.invalidationListeners.push(listener);
    }

    /** Kennel geloescht: Zaehler und Sterne der Lineage fallen, ungeflushte Deltas auch. */
    async forgetKennel(lineageId: string): Promise<void> {
        this.counter.forgetKennel(lineageId);
        await this.store.deleteKennelStats(lineageId);
        this.invalidate();
    }

    /** Bayes: (C*m + sum) / (C + n); ohne Bewertung 0. m = globaler Mittelwert. */
    static score(count: number, sum: number, globalMean: number): number {
        if (count === 0) return 0;
        return (KennelStatsService.BAYES_C * globalMean + sum) / (KennelStatsService.BAYES_C + count);
    }

    private ratingOf(globalMean: number, count: number, sum: number): KennelStats['rating'] {
        return {
            avg: count === 0 ? null : sum / count,
            count,
            score: KennelStatsService.score(count, sum, globalMean),
        };
    }

    private statsOf(memo: StatsMemo, key: string, pending: CallCounts | undefined): KennelStats {
        const stored = memo.calls.get(key) ?? NO_CALLS;
        const extra = pending ?? NO_CALLS;
        const rating = memo.ratings.get(key) ?? { count: 0, sum: 0 };
        return {
            calls: {
                total: stored.total + extra.total,
                last30d: stored.last30d + extra.last30d,
                leadFailed: stored.leadFailed + extra.leadFailed,
                leadFailed30d: stored.leadFailed30d + extra.leadFailed30d,
                ranked: stored.rankedTotal + extra.rankedTotal,
                ranked30d: stored.ranked30d + extra.ranked30d,
            },
            rating: this.ratingOf(memo.globalMean, rating.count, rating.sum),
        };
    }

    /** Das gueltige Memo — ein abgelaufenes wird EINMAL neu geladen, parallele Leser teilen die Ladung. */
    private async current(): Promise<StatsMemo> {
        if (this.memo && this.now() - this.memo.at < this.memoMs) return this.memo;
        if (!this.loading) {
            const loading: Promise<StatsMemo> = this.load().finally(() => {
                if (this.loading === loading) this.loading = null;
            });
            this.loading = loading;
        }
        return this.loading;
    }

    private async load(): Promise<StatsMemo> {
        const at = this.now();
        const generation = this.generation;
        // 30 Kalendertage inklusive heute.
        const sinceDay = utcDay(new Date(at - (KennelStatsService.WINDOW_DAYS - 1) * DAY_MS));
        this.memoLoadCount += 1;
        const [callRows, ratingRows] = await Promise.all([
            this.store.readKennelCallAggregates(sinceDay),
            this.store.readKennelRatingAggregates(),
        ]);
        const calls = new Map<string, CallCounts>();
        for (const { lineageId, ...counts } of callRows) calls.set(lineageId, counts);
        const ratings = new Map<string, { count: number; sum: number }>();
        let count = 0;
        let sum = 0;
        for (const r of ratingRows) {
            ratings.set(r.lineageId, { count: r.count, sum: r.sum });
            count += r.count;
            sum += r.sum;
        }
        const memo: StatsMemo = { at, sinceDay, calls, ratings, globalMean: count === 0 ? 0 : sum / count };
        if (generation === this.generation) this.memo = memo;
        return memo;
    }
}
