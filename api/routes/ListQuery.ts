// ListQuery — the sieve laid over a list route: ownership, search, order, page.
//
// The reduction runs in JS over the result of listLatest(), NOT in SQL. With 261 kennels
// that is cheap, and an SQL variant would have to touch both the lineage reduction and the
// ACL filtering, which each live in JS. This is a deliberate intermediate step, not an end
// state: the next step is to push the reduction down into the query itself.
//
// Order of operations is fixed and must not be reordered:
//   ACL visibility (the caller applies it BEFORE handing the list in)
//     -> mine -> q -> minStars -> minCalls -> proven -> minReliability -> usage -> sort -> offset/limit
// `total` counts after the filters, before the page is cut. Slicing earlier yields
// wrong pages; counting before the ACL filter would leak how many private entries of
// other users exist.

import type { AuthCtx } from '../../mcp/auth/middleware';

/**
 * calls/calls30d = ranked usage (`stats.calls.ranked` / `.ranked30d`), rating = Bayes score
 * (`stats.rating.score`), failures30d = failed runs in the last 30 days (kennels `stats.calls.leadFailed30d`,
 * dogs `stats.calls.failures30d`). The numeric keys need `stats` on the items (KennelStatsService.attach);
 * an item without stats counts as 0. Dogs (P4b, DogStatsService.attach): calls30d reads the same
 * `stats.calls.ranked30d`, proven = `stats.proven.score`, reuse = `stats.reuse.kennelsTransitive`.
 */
export type SortField = 'name' | 'createdAt' | 'updatedAt' | 'calls' | 'calls30d' | 'rating' | 'proven' | 'reuse' | 'failures30d';
export type SortDirection = 'asc' | 'desc';

/**
 * Aufruf-Filter (Feature-Runde nach dem lokalen Test, 10-0: "durchsuchbar mit filtern … top alle mit
 * stichworten oder nie benutzt oder nie funktioniert"). Gilt fuer Kennels (`stats.calls` aus P4) und
 * Dogs (`stats.calls` aus P4b) gleich; die Definitionen stehen woertlich in USAGE_FILTER_HELP.
 */
export type UsageFilter = 'top' | 'never_used' | 'never_worked' | 'failing' | 'dormant';

export const USAGE_FILTERS: readonly UsageFilter[] = ['top', 'never_used', 'never_worked', 'failing', 'dormant'];

/**
 * Die eine Beschreibung der Filter — MCP-Schemas (list_kennels, list_nodes) lesen sie von hier.
 * "calls" = jeder gezaehlte Lauf aus jeder Quelle (stats.calls.total); ein Kennel-Lauf ist gescheitert,
 * wenn sein Lead-Dog scheiterte (leadFailed), ein Dog-Lauf, wenn er mit error/timeout/oom endete (failures).
 */
export const USAGE_FILTER_HELP =
    'Usage filter, applied after the rights filter (only what you may run) and combinable with search, sort and the other filters: '
    + '"top" = at least one call, ordered by calls (stats.calls.total desc, then last30d desc) unless you pass sort; '
    + '"never_used" = 0 calls in total; '
    + '"never_worked" = calls > 0 and every one failed (kennel: leadFailed == total; dog: failures == total, failures = error + timeout + oom); '
    + '"failing" = at least one failed run in the last 30 days (kennel: leadFailed30d > 0; dog: failures30d > 0); '
    + '"dormant" = calls > 0 in total, but 0 in the last 30 days. '
    + 'Calls count every source (public page, execute, run, snapshot, build); the window is 30 UTC days including today.';

export interface IListPage<T> {
    data: T[];
    total: number;
}

export class ListQuery {
    /** Hard ceiling — a caller may ask for more, but never receives more. */
    static readonly MAX_LIMIT = 200;

    private static readonly SORT_FIELDS: readonly string[] = ['name', 'createdAt', 'updatedAt', 'calls', 'calls30d', 'rating', 'proven', 'reuse', 'failures30d'];
    /** lineageId too: the kennel id is what people and agents know a kennel by. */
    private static readonly SEARCHABLE_FIELDS: readonly string[] = ['name', 'displayName', 'description', 'lineageId'];

    private constructor(
        readonly limit: number | null,
        readonly offset: number,
        readonly search: string,
        readonly sort: SortField,
        readonly dir: SortDirection,
        readonly mineOnly: boolean,
        /** Keep items whose raw average rating is >= this (1..5), or no filter. */
        readonly minStars: number | null = null,
        /** Keep items with at least this many ranked calls, or no filter. */
        readonly minCalls: number | null = null,
        /** Keep only dogs carrying the proven badge (`proven=1`, P4b). */
        readonly provenOnly: boolean = false,
        /** Aufruf-Filter (`usage=`), or no filter. */
        readonly usage: UsageFilter | null = null,
        /** Whether the caller named a valid `sort` — only then does `usage=top` give up its own order. */
        readonly sortGiven: boolean = false,
        /** Dogs: keep those whose `stats.proven.reliability` (0..1) is >= this, or no filter. */
        readonly minReliability: number | null = null,
    ) { }

    /**
     * Read the query string. Every parameter is optional, and a broken value never raises —
     * it falls back to its default or is pulled to the ceiling. A mangled URL must not 500.
     */
    static from(query: Record<string, unknown> | undefined): ListQuery {
        const q = query ?? {};
        return new ListQuery(
            ListQuery.parseLimit(q.limit),
            ListQuery.parseOffset(q.offset),
            ListQuery.parseText(q.q),
            ListQuery.parseSort(q.sort),
            ListQuery.parseDirection(q.dir),
            ListQuery.parseFlag(q.mine),
            ListQuery.parseMinStars(q.minStars),
            ListQuery.parseMinCalls(q.minCalls),
            ListQuery.parseFlag(q.proven),
            ListQuery.parseUsage(q.usage),
            ListQuery.SORT_FIELDS.includes(ListQuery.first(q.sort) as string),
            ListQuery.parseMinReliability(q.minReliability),
        );
    }

    /**
     * The direction an MCP tool uses when the caller names a sort but no `dir`: numbers (calls, stars,
     * proven, reuse, failures) run high to low — "sort: proven" means the proven dogs first — names and
     * dates keep ascending. REST keeps `asc` as its default (the UI always sends `dir`).
     */
    static defaultDirFor(sort: unknown): SortDirection {
        return ['calls', 'calls30d', 'rating', 'proven', 'reuse', 'failures30d'].includes(ListQuery.first(sort) as string) ? 'desc' : 'asc';
    }

    /** True only when `limit` was given — only then does the response envelope grow. */
    get isPaged(): boolean {
        return this.limit !== null;
    }

    /** Apply mine -> q -> minStars -> minCalls -> proven -> minReliability -> usage -> sort -> page. The caller has already applied the ACL filter. */
    apply<T>(items: T[], ctx: AuthCtx | undefined): IListPage<T> {
        const owned = this.mineOnly ? items.filter(item => ListQuery.isOwnedBy(item, ctx)) : items;
        const found = this.search ? owned.filter(item => this.matches(item)) : owned;
        const starred = this.minStars === null ? found : found.filter(item => (ListQuery.statsOf(item)?.rating?.avg ?? -1) >= this.minStars!);
        const called = this.minCalls === null ? starred : starred.filter(item => (ListQuery.statsOf(item)?.calls?.ranked ?? 0) >= this.minCalls!);
        const proven = this.provenOnly ? called.filter(item => ListQuery.statsOf(item)?.proven?.badge === true) : called;
        const reliable = this.minReliability === null ? proven : proven.filter(item => (ListQuery.statsOf(item)?.proven?.reliability ?? -1) >= this.minReliability!);
        const used = this.usage === null ? reliable : reliable.filter(item => ListQuery.matchesUsage(item, this.usage!));
        const ordered = this.usage === 'top' && !this.sortGiven ? ListQuery.byCalls(used) : this.ordered(used);

        if (this.limit === null) {
            return { data: ordered, total: ordered.length };
        }
        return { data: ordered.slice(this.offset, this.offset + this.limit), total: ordered.length };
    }

    /**
     * The response body. Without `limit` it is byte-for-byte what this route always returned —
     * that is the standing promise to MCP and every existing caller.
     */
    envelope<T>(page: IListPage<T>): Record<string, unknown> {
        if (!this.isPaged) {
            return { ok: true, data: page.data };
        }
        return { ok: true, data: page.data, total: page.total, limit: this.limit, offset: this.offset };
    }

    /** Ownership uses the one notion the code already has: the `ownerId` column. */
    private static isOwnedBy(item: unknown, ctx: AuthCtx | undefined): boolean {
        // Nobody is logged in — an anonymous caller owns nothing, so `mine=1` yields nothing.
        const userId = ctx?.user?.id;
        if (!userId) return false;
        return (item as { ownerId?: string | null })?.ownerId === userId;
    }

    private matches(item: unknown): boolean {
        const record = item as Record<string, unknown>;
        return ListQuery.SEARCHABLE_FIELDS.some(field => {
            const value = record?.[field];
            return typeof value === 'string' && value.toLowerCase().includes(this.search);
        });
    }

    /**
     * Stable order: on a tie we fall back to `id`, otherwise entries drift between pages
     * and a reader sees the same row twice while another is never shown.
     */
    private ordered<T>(items: T[]): T[] {
        const sign = this.dir === 'desc' ? -1 : 1;
        return [...items].sort((a, b) => {
            const primary = ListQuery.compare(ListQuery.sortValue(a, this.sort), ListQuery.sortValue(b, this.sort));
            const tie = ListQuery.compare(ListQuery.idOf(a), ListQuery.idOf(b));
            return sign * (primary !== 0 ? primary : tie);
        });
    }

    /**
     * Die Zahlen, auf denen die Aufruf-Filter stehen — Kennels und Dogs tragen sie unter verschiedenen
     * Namen: Fehlschlaege heissen am Kennel leadFailed(30d), am Dog failures(30d). Fehlend -> 0.
     */
    private static callsOf(item: unknown): { total: number; last30d: number; failures: number; failures30d: number } {
        const c = ListQuery.statsOf(item)?.calls ?? {};
        return {
            total: c.total ?? 0,
            last30d: c.last30d ?? 0,
            failures: c.failures ?? c.leadFailed ?? 0,
            failures30d: c.failures30d ?? c.leadFailed30d ?? 0,
        };
    }

    /** Die Definitionen aus USAGE_FILTER_HELP — hier und nur hier in Code. */
    private static matchesUsage(item: unknown, usage: UsageFilter): boolean {
        const c = ListQuery.callsOf(item);
        switch (usage) {
            case 'top': return c.total > 0;
            case 'never_used': return c.total === 0;
            case 'never_worked': return c.total > 0 && c.failures >= c.total;
            case 'failing': return c.failures30d > 0;
            case 'dormant': return c.total > 0 && c.last30d === 0;
        }
    }

    /** `usage=top` ohne sort: meiste Aufrufe zuerst (gesamt, dann 30 Tage), Gleichstand nach id. */
    private static byCalls<T>(items: T[]): T[] {
        return [...items].sort((a, b) => {
            const ca = ListQuery.callsOf(a);
            const cb = ListQuery.callsOf(b);
            return (cb.total - ca.total) || (cb.last30d - ca.last30d) || ListQuery.compare(ListQuery.idOf(a), ListQuery.idOf(b));
        });
    }

    private static compare(a: string | number, b: string | number): number {
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
    }

    private static idOf(item: unknown): string {
        return String((item as { id?: unknown })?.id ?? '');
    }

    /** The `stats` a list item carries (P4 kennels, P4b dogs) — undefined for callers that did not attach. */
    private static statsOf(item: unknown): {
        calls?: {
            total?: number; last30d?: number; ranked?: number; ranked30d?: number;
            leadFailed?: number; leadFailed30d?: number; failures?: number; failures30d?: number;
        };
        rating?: { avg?: number | null; score?: number };
        proven?: { score?: number; badge?: boolean; reliability?: number };
        reuse?: { kennelsTransitive?: number };
    } | undefined {
        return (item as { stats?: any })?.stats;
    }

    private static sortValue(item: unknown, field: SortField): string | number {
        const record = item as Record<string, unknown>;
        if (field === 'calls') return ListQuery.statsOf(item)?.calls?.ranked ?? 0;
        if (field === 'calls30d') return ListQuery.statsOf(item)?.calls?.ranked30d ?? 0;
        if (field === 'rating') return ListQuery.statsOf(item)?.rating?.score ?? 0;
        if (field === 'proven') return ListQuery.statsOf(item)?.proven?.score ?? 0;
        if (field === 'reuse') return ListQuery.statsOf(item)?.reuse?.kennelsTransitive ?? 0;
        if (field === 'failures30d') return ListQuery.callsOf(item).failures30d;
        if (field === 'name') {
            // Kennels carry `name`, dogs carry `displayName` — one route serves both.
            const label = record?.name ?? record?.displayName ?? '';
            return String(label).toLowerCase();
        }
        // AbstractController.listLatest parks the row timestamp on `_createdAt`; KennelController
        // hands out real `createdAt` / `updatedAt`. Fall back rather than sort everything to 0.
        const raw = field === 'updatedAt'
            ? record?.updatedAt ?? record?.createdAt ?? record?._createdAt
            : record?.createdAt ?? record?._createdAt;
        const time = raw ? new Date(raw as string).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    private static parseLimit(raw: unknown): number | null {
        if (raw === undefined || raw === null || raw === '') return null;
        const value = Number(ListQuery.first(raw));
        // Not a number or not positive -> behave as if no limit had been given at all.
        if (!Number.isFinite(value) || value < 1) return null;
        return Math.min(Math.floor(value), ListQuery.MAX_LIMIT);
    }

    private static parseOffset(raw: unknown): number {
        const value = Number(ListQuery.first(raw));
        if (!Number.isFinite(value) || value < 0) return 0;
        return Math.floor(value);
    }

    private static parseText(raw: unknown): string {
        const value = ListQuery.first(raw);
        return typeof value === 'string' ? value.trim().toLowerCase() : '';
    }

    private static parseSort(raw: unknown): SortField {
        const value = ListQuery.first(raw);
        return ListQuery.SORT_FIELDS.includes(value as string) ? (value as SortField) : 'name';
    }

    /** 1..5 (fractions allowed: "4.5" keeps 4.5 and up); anything else means no filter. */
    private static parseMinStars(raw: unknown): number | null {
        const value = ListQuery.parseNumber(raw);
        return value !== null && value >= 1 && value <= 5 ? value : null;
    }

    /** 0..1 (1 - failures30d / runs30d; 0.7 below 5 runs, P4b 4b.6); anything else means no filter. */
    private static parseMinReliability(raw: unknown): number | null {
        const value = ListQuery.parseNumber(raw);
        return value !== null && value >= 0 && value <= 1 ? value : null;
    }

    private static parseMinCalls(raw: unknown): number | null {
        const value = ListQuery.parseNumber(raw);
        return value !== null && value >= 0 ? value : null;
    }

    private static parseNumber(raw: unknown): number | null {
        const value = ListQuery.first(raw);
        if (value === undefined || value === null || value === '') return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    /** Unknown or empty -> no filter (a mangled URL must not 500). */
    private static parseUsage(raw: unknown): UsageFilter | null {
        const value = ListQuery.first(raw);
        return USAGE_FILTERS.includes(value as UsageFilter) ? (value as UsageFilter) : null;
    }

    private static parseDirection(raw: unknown): SortDirection {
        return ListQuery.first(raw) === 'desc' ? 'desc' : 'asc';
    }

    private static parseFlag(raw: unknown): boolean {
        const value = ListQuery.first(raw);
        return value === '1' || value === 'true';
    }

    /** Express hands repeated query parameters over as arrays — take the first, ignore the rest. */
    private static first(raw: unknown): unknown {
        return Array.isArray(raw) ? raw[0] : raw;
    }
}
