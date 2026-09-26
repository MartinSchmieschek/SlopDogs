// DogStatsService — haengt `stats` an Dog-Antworten (P4b 4b.5-4b.7): Laeufe aus DogCallDaily plus die
// ungeflushten Deltas dieser Instanz, Wiederverwendung aus DogReference, "Bewaehrt" als eine Zahl.
// Gelesen wird aus EINEM Memo (ein GROUP BY + ein findMany je Memo-Leben), nie je Dog. Das Memo
// enthaelt auch private Kennels — sie verlassen den Prozess nur als Zahl (kennelsTransitive …) oder
// ueber usageOf(), und usageOf() listet nur Kennels, die der Aufrufer ausfuehren darf.
import { BASE_DOG_PREFIX, publicKennelPath } from '@slopdogs/core';
import type { DogCallAggregate, DogReferenceRow, IDogStatsStore } from '../store/IKennelStatsStore';
import { KennelCallCounter, utcDay, type PendingDogAggregate } from './KennelCallCounter';
import { KennelStatsService } from './KennelStatsService';
import type { AuthCtx } from '../mcp/auth/middleware';
import { canRun } from '../mcp/auth/visibility';

export interface DogStats {
    /** failures = error + timeout + oom ueber alle Tage, failures30d dieselben im 30-Tage-Fenster (Fehler-Tracking P4b). */
    calls: {
        total: number; last30d: number; ranked30d: number; failures: number; failures30d: number; cached30d: number;
        avgDurationMs: number | null; maxDurationMs: number; kennelsRun30d: number;
    };
    reuse: { kennelsDirect: number; kennelsTransitive: number; kennelsForeign: number; owners: number; dependents: number };
    proven: { score: number; badge: boolean; reliability: number };
}

export interface DogUsageKennel {
    lineageId: string; name: string | null; visibility: string; ownerId: string | null;
    via: 'crew' | 'transitive'; count30d: number; failures30d: number; url: string;
}

export interface DogUsage {
    ok: true;
    dogKey: string;
    kennels: DogUsageKennel[];
    hiddenKennels: number;
    dependents: Array<{ lineageId: string; displayName: string | null; kind: 'required' | 'optional' }>;
    dependencies: { required: string[]; optional: string[] };
    byOwner: Array<{ ownerId: string | null; kennels: number }>;
}

/** Ein Dog, wie ihn Listen und Einzelantworten tragen: Schluessel = lineageId, sonst id (`base:X`). */
export type StatsDog = { id: string; lineageId?: string; ownerId?: string | null };

/** Woher usageOf Namen und Rechte der Kennels und Dogs bekommt (listLatest der Controller). */
export interface DogStatsDirectory {
    listKennels(): Promise<any[]>;
    listDogs(): Promise<any[]>;
}

/** Die Groessen der Formel (4b.6). */
export interface ProvenInput { r: number; n: number; f: number; k: number; kf: number; s: number | null }

type CallCounts = Omit<DogCallAggregate, 'dogKey'>;

interface Reuse {
    direct: Set<string>;
    transitive: Set<string>;
    foreignOwners: Array<string | null>;
    dependents: Map<string, 'required' | 'optional'>;
}

interface DogStatsMemo {
    at: number;
    sinceDay: string;
    calls: Map<string, CallCounts>;
    /** toKey -> Kennels, deren Crew ihn nennt (mit Owner). */
    crewOf: Map<string, Map<string, string | null>>;
    /** toKey -> Dogs, deren parents ihn nennen. */
    dependentsOf: Map<string, Map<string, 'required' | 'optional'>>;
    /** Dog -> eigene parents (normalisiert). */
    parentsOf: Map<string, { required: string[]; optional: string[] }>;
    kennelOwner: Map<string, string | null>;
    reuse: Map<string, Reuse>;
    references: number;
}

const DAY_MS = 86_400_000;
const NO_CALLS: CallCounts = {
    total: 0, last30d: 0, ranked30d: 0, failures: 0, failures30d: 0, cached30d: 0,
    durationMsSum30d: 0, count30d: 0, durationMsMax30d: 0, kennelsRun30d: 0,
};

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;
const ownerKey = (ownerId: string | null | undefined) => ownerId ?? 'community';

/** Der Stats-Schluessel eines Dogs in einer Antwort. */
export function dogKeyOfNode(node: StatsDog): string {
    return node.lineageId || node.id;
}

export class DogStatsService {
    static readonly WINDOW_DAYS = 30;

    private memo: DogStatsMemo | null = null;
    private loading: Promise<DogStatsMemo> | null = null;
    private generation = 0;
    private memoLoadCount = 0;
    private readonly invalidationListeners: Array<() => void> = [];

    constructor(
        private readonly store: IDogStatsStore,
        private readonly counter: KennelCallCounter,
        private readonly kennelStats: KennelStatsService,
        private readonly directory?: DogStatsDirectory,
        private readonly referenceRows: () => number = () => 0,
        private readonly memoMs = positiveIntFromEnv('KENNEL_STATS_MEMO_MS', 30_000),
        private readonly now: () => number = () => Date.now(),
    ) {
        // Sterne fliessen in "Bewaehrt": neue Bewertung -> neues Memo.
        kennelStats.onInvalidate(() => this.invalidate());
    }

    get memoLoads(): number {
        return this.memoLoadCount;
    }

    /** health_check: ungeflushte Dog-Schluessel und Referenzzeilen — ohne Query. */
    health(): { pendingDogs: number; referenceRows: number } {
        return { pendingDogs: this.counter.status().pendingDogs, referenceRows: this.referenceRows() };
    }

    /**
     * Die Formel (4b.6): usage x reliability x reuse x stars. Unter 5 Laeufen ist die Zuverlaessigkeit
     * unbewiesen (0,7 statt Fantasie-100 %); fremde Kennels zaehlen voll, eigene ab dem zweiten zu einem Viertel.
     */
    static proven({ r, n, f, k, kf, s }: ProvenInput): DogStats['proven'] {
        const usage = Math.log10(1 + r);
        const reliability = n >= 5 ? 1 - f / n : 0.7;
        const reuse = 1 + kf + 0.25 * Math.max(0, k - kf - 1);
        const stars = s === null ? 1 : 1 + s / 5;
        return {
            score: round(usage * reliability * reuse * stars, 2),
            badge: n >= 5 && r >= 1 && k >= 1 && reliability >= 0.8,
            reliability: round(reliability, 3),
        };
    }

    /** Haengt `stats` in place an. Schluessel: lineageId, sonst id (`base:X`). */
    async attach<T extends StatsDog>(nodes: T[]): Promise<Array<T & { stats: DogStats }>> {
        const memo = await this.current();
        const pending = this.counter.pendingDogAggregates(memo.sinceDay);
        for (const node of nodes) {
            (node as T & { stats: DogStats }).stats = await this.statsOf(memo, node, pending);
        }
        return nodes as Array<T & { stats: DogStats }>;
    }

    async attachOne<T extends StatsDog>(node: T): Promise<T & { stats: DogStats }> {
        return (await this.attach([node]))[0];
    }

    /**
     * Wo der Dog laeuft (GET /api/nodes/:id/usage, get_node.usage): Kennels mit Crew-Referenz (via crew)
     * oder ueber einen Dog, der ihn braucht (via transitive) — nur, was der Aufrufer ausfuehren darf;
     * der Rest zaehlt als hiddenKennels. Die Rechte am Dog selbst prueft der Aufrufer.
     */
    async usageOf(node: StatsDog & { parentsRequired?: string[]; parentsOptional?: string[] }, ctx: AuthCtx | undefined): Promise<DogUsage> {
        const memo = await this.current();
        const dogKey = dogKeyOfNode(node);
        const reuse = this.reuseOf(memo, dogKey);
        const [kennels, dogs, calls] = await Promise.all([
            this.directory ? this.directory.listKennels() : Promise.resolve([]),
            this.directory ? this.directory.listDogs() : Promise.resolve([]),
            this.store.readDogKennelUsage(memo.sinceDay, dogKey),
        ]);
        const counts = new Map(calls.map((c) => [c.kennelLineageId, { count30d: c.count30d, failures30d: c.failures30d }]));
        for (const [kennel, extra] of this.counter.pendingDogKennelUsage(dogKey, memo.sinceDay)) {
            const c = counts.get(kennel) ?? { count30d: 0, failures30d: 0 };
            counts.set(kennel, { count30d: c.count30d + extra.count30d, failures30d: c.failures30d + extra.failures30d });
        }
        const kennelByLineage = new Map(kennels.map((k: any) => [k.lineageId || k.id, k]));
        const visible: DogUsageKennel[] = [];
        let hidden = 0;
        for (const lineageId of reuse.transitive) {
            const k = kennelByLineage.get(lineageId);
            if (!k || !canRun(k, ctx)) { hidden += 1; continue; }
            const c = counts.get(lineageId) ?? { count30d: 0, failures30d: 0 };
            visible.push({
                lineageId, name: k.name ?? null, visibility: k.visibility ?? 'public', ownerId: k.ownerId ?? null,
                via: reuse.direct.has(lineageId) ? 'crew' : 'transitive',
                count30d: c.count30d, failures30d: c.failures30d, url: publicKennelPath(lineageId),
            });
        }
        visible.sort((a, b) => b.count30d - a.count30d || a.lineageId.localeCompare(b.lineageId));

        const dogByLineage = new Map(dogs.map((d: any) => [d.lineageId || d.id, d]));
        const dependents: DogUsage['dependents'] = [];
        for (const [lineageId, kind] of reuse.dependents) {
            const d = dogByLineage.get(lineageId);
            if (!d || !canRun(d, ctx)) continue;
            dependents.push({ lineageId, displayName: d.displayName ?? null, kind });
        }

        const byOwnerCount = new Map<string | null, number>();
        for (const lineageId of reuse.transitive) {
            const owner = memo.kennelOwner.get(lineageId) ?? null;
            byOwnerCount.set(owner, (byOwnerCount.get(owner) ?? 0) + 1);
        }
        const byOwner = [...byOwnerCount].map(([ownerId, n]) => ({ ownerId, kennels: n })).sort((a, b) => b.kennels - a.kennels);

        const own = memo.parentsOf.get(dogKey);
        const baseName = (x: string) => (x.startsWith(BASE_DOG_PREFIX) ? x : BASE_DOG_PREFIX + x);
        const dependencies = own
            ?? (dogKey.startsWith(BASE_DOG_PREFIX)
                ? { required: (node.parentsRequired ?? []).map(baseName), optional: (node.parentsOptional ?? []).map(baseName) }
                : { required: [], optional: [] });
        return { ok: true, dogKey, kennels: visible, hiddenKennels: hidden, dependents, dependencies, byOwner };
    }

    /** Nach Flush, Referenz-Aenderung, Bewertung, Dog-Delete: das naechste attach laedt neu. */
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

    private async statsOf(memo: DogStatsMemo, node: StatsDog, pending: Map<string, PendingDogAggregate>): Promise<DogStats> {
        const key = dogKeyOfNode(node);
        const stored = memo.calls.get(key) ?? NO_CALLS;
        const extra = pending.get(key);
        const count30d = stored.count30d + (extra?.count30d ?? 0);
        const durationSum = stored.durationMsSum30d + (extra?.durationMsSum30d ?? 0);
        const calls: DogStats['calls'] = {
            total: stored.total + (extra?.total ?? 0),
            last30d: stored.last30d + (extra?.last30d ?? 0),
            ranked30d: stored.ranked30d + (extra?.ranked30d ?? 0),
            failures: stored.failures + (extra?.failures ?? 0),
            failures30d: stored.failures30d + (extra?.failures30d ?? 0),
            cached30d: stored.cached30d + (extra?.cached30d ?? 0),
            avgDurationMs: count30d > 0 ? Math.round(durationSum / count30d) : null,
            maxDurationMs: Math.max(stored.durationMsMax30d, extra?.durationMsMax30d ?? 0),
            // Die DB zaehlt distinct; die ungeflushten Kennels koennen darin schon stecken — die Untergrenze
            // bis zum naechsten Flush ist das Maximum beider.
            kennelsRun30d: Math.max(stored.kennelsRun30d, extra?.kennels.size ?? 0),
        };
        const reuse = this.reuseOf(memo, key);
        const dogOwner = ownerKey(node.ownerId);
        const kennelsForeign = reuse.foreignOwners.filter((o) => ownerKey(o) !== dogOwner).length;
        const owners = new Set(reuse.foreignOwners.map((o) => ownerKey(o))).size;
        const scores = await this.kennelStats.ratedScores(reuse.direct);
        const s = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        return {
            calls,
            reuse: {
                kennelsDirect: reuse.direct.size,
                kennelsTransitive: reuse.transitive.size,
                kennelsForeign,
                owners,
                dependents: reuse.dependents.size,
            },
            proven: DogStatsService.proven({ r: calls.ranked30d, n: count30d, f: calls.failures30d, k: reuse.transitive.size, kf: kennelsForeign, s }),
        };
    }

    /**
     * Direkt = Kennels mit Crew-Referenz; transitiv = direkt ∪ Kennels mit einem Dog, der ueber parents
     * (rekursiv, BFS) diesen Dog braucht. Je Memo einmal je Dog berechnet.
     */
    private reuseOf(memo: DogStatsMemo, dogKey: string): Reuse {
        const cached = memo.reuse.get(dogKey);
        if (cached) return cached;
        const direct = new Set(memo.crewOf.get(dogKey)?.keys() ?? []);
        const dependents = new Map(memo.dependentsOf.get(dogKey) ?? []);
        const transitive = new Set(direct);
        const seen = new Set<string>([dogKey]);
        const queue = [...dependents.keys()];
        while (queue.length > 0) {
            const dog = queue.shift()!;
            if (seen.has(dog)) continue;
            seen.add(dog);
            for (const kennel of memo.crewOf.get(dog)?.keys() ?? []) transitive.add(kennel);
            for (const next of memo.dependentsOf.get(dog)?.keys() ?? []) if (!seen.has(next)) queue.push(next);
        }
        const foreignOwners = [...transitive].map((k) => memo.kennelOwner.get(k) ?? null);
        const reuse: Reuse = { direct, transitive, foreignOwners, dependents };
        memo.reuse.set(dogKey, reuse);
        return reuse;
    }

    /** Das gueltige Memo — ein abgelaufenes wird EINMAL neu geladen, parallele Leser teilen die Ladung. */
    private async current(): Promise<DogStatsMemo> {
        if (this.memo && this.now() - this.memo.at < this.memoMs) return this.memo;
        if (!this.loading) {
            const loading: Promise<DogStatsMemo> = this.load().finally(() => {
                if (this.loading === loading) this.loading = null;
            });
            this.loading = loading;
        }
        return this.loading;
    }

    private async load(): Promise<DogStatsMemo> {
        const at = this.now();
        const generation = this.generation;
        const sinceDay = utcDay(new Date(at - (DogStatsService.WINDOW_DAYS - 1) * DAY_MS));
        this.memoLoadCount += 1;
        const [callRows, refRows] = await Promise.all([
            this.store.readDogCallAggregates(sinceDay),
            this.store.readAllReferences(),
        ]);
        const calls = new Map<string, CallCounts>();
        for (const { dogKey, ...counts } of callRows) calls.set(dogKey, counts);
        const memo: DogStatsMemo = {
            at, sinceDay, calls, references: refRows.length,
            ...DogStatsService.indexReferences(refRows),
            reuse: new Map(),
        };
        if (generation === this.generation) this.memo = memo;
        return memo;
    }

    private static indexReferences(rows: DogReferenceRow[]) {
        const crewOf = new Map<string, Map<string, string | null>>();
        const dependentsOf = new Map<string, Map<string, 'required' | 'optional'>>();
        const parentsOf = new Map<string, { required: string[]; optional: string[] }>();
        const kennelOwner = new Map<string, string | null>();
        const ordered = [...rows].sort((a, b) => a.position - b.position);
        for (const r of ordered) {
            if (r.fromKind === 'kennel') {
                kennelOwner.set(r.fromKey, r.fromOwnerId ?? null);
                if (!crewOf.has(r.toKey)) crewOf.set(r.toKey, new Map());
                crewOf.get(r.toKey)!.set(r.fromKey, r.fromOwnerId ?? null);
                continue;
            }
            const kind = r.kind === 'optional' ? 'optional' : 'required';
            if (!dependentsOf.has(r.toKey)) dependentsOf.set(r.toKey, new Map());
            const deps = dependentsOf.get(r.toKey)!;
            if (deps.get(r.fromKey) !== 'required') deps.set(r.fromKey, kind);   // required schlaegt optional
            if (!parentsOf.has(r.fromKey)) parentsOf.set(r.fromKey, { required: [], optional: [] });
            parentsOf.get(r.fromKey)![kind].push(r.toKey);
        }
        return { crewOf, dependentsOf, parentsOf, kennelOwner };
    }
}
