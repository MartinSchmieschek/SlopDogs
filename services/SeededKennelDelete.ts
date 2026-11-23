// SeededKennelDelete — Loeschen eines Seed-Kennels (Landing, Kennel-Liste) samt seiner unbenutzten Dogs (Spur K).
//
// Die Seed-Kennels entstehen beim Boot aus dem Repo, wenn sie fehlen; Zuruecksetzen heisst: ein Maintainer loescht
// den Kennel, der naechste Start seedet ihn neu (seed-data/kennels/maintainedSeed.ts, feste Dog-Lineages). Damit dabei
// keine Waisen liegen bleiben und fremde Kennels nicht brechen, prueft das Loeschen jeden Dog des Kennels (dogIds und
// Parents, transitiv; nur besitzerlose, nie Base-Dogs) am Referenzindex: nutzt ihn ein anderer Kennel oder ein Dog
// ausserhalb dieses Kennels, bleibt er stehen — und mit ihm seine Parents. Alle anderen fallen mit (alle Versionen).
// Der Trockenlauf (plan) liefert dieselbe Rueckmeldung, ohne etwas zu loeschen.
import type { DogReferenceRow } from '../store/IKennelStatsStore';

/** Die Kopfversion eines Dogs, soweit die Pruefung sie braucht. */
export interface SeededKennelDogHead {
    lineageId?: string;
    id?: string;
    displayName?: string;
    ownerId?: string | null;
    parentsRequired?: unknown;
    parentsOptional?: unknown;
}

export interface SeededKennelDeleteDeps {
    /** dogIds der Kopfversion des Kennels; null, wenn es ihn nicht gibt. */
    kennelDogIds(kennelId: string): Promise<string[] | null>;
    /** Referenz (lineageId, Versions-GUID, base:X, Klassenname) -> lineageId; null fuer Base-Dogs. */
    lineageOf(ref: string): Promise<string | null>;
    /** Kopfversionen dieser Lineages (SerializedDog und MimicDog). */
    dogHeads(lineageIds: string[]): Promise<SeededKennelDogHead[]>;
    /** Wer diese Lineages referenziert (DogReferenceIndex.referencesTo); null = Index gerade nicht verlaesslich. */
    referencesTo(lineageIds: ReadonlySet<string>): Promise<DogReferenceRow[] | null>;
    /** Alle Versionen des Kennels loeschen. */
    deleteKennel(kennelId: string): Promise<boolean>;
    /** Alle Versionen eines Dogs loeschen. */
    deleteDog(lineageId: string): Promise<boolean>;
    /** Vor dem Loeschen: die behaltenen Dogs merken (SeedKeptDogs) — Sperre und Lineage fuer den Reseed. */
    rememberKept?(kennelId: string, dogs: SeededKennelKeptDog[]): Promise<void>;
    /** Nach dem Loeschen: Memos der Seiten verwerfen, Sperre neu rechnen. */
    afterDelete?(kennelId: string): void;
}

export interface SeededKennelDogRef {
    lineageId: string;
    displayName: string;
}

export interface SeededKennelKeptDog extends SeededKennelDogRef {
    /** Kennel-IDs bzw. Dog-Lineages, die ihn nutzen. */
    usedBy: string[];
}

/** Die Rueckmeldung — als Vorschau (Trockenlauf) und nach dem Loeschen gleich gebaut. */
export interface SeededKennelDeleteReport {
    kennelId: string;
    dogsDeleted: SeededKennelDogRef[];
    dogsKept: SeededKennelKeptDog[];
    reseed: 'at next restart';
}

function refList(raw: unknown): string[] {
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

export class SeededKennelDelete {
    static readonly RESEED = 'at next restart' as const;
    /** usedBy, wenn der Referenzindex gerade neu gebaut wird: dann bleibt jeder Dog stehen. */
    static readonly INDEX_BUSY = '(reference index rebuilding)';
    /** usedBy, wenn das Loeschen eines Dogs scheiterte. */
    static readonly DELETE_FAILED = '(delete failed)';
    static readonly DEFAULT_MAX_DOGS = 500;

    constructor(
        private readonly deps: SeededKennelDeleteDeps,
        /** Welche Kennels so geloescht werden (Default LandingKennels.seededIds(); Tests geben eigene). */
        private readonly isSeeded: (kennelId: string) => boolean,
        private readonly maxDogs: number = SeededKennelDelete.DEFAULT_MAX_DOGS,
    ) {}

    /** Gilt dieser Weg fuer den Kennel? Nur fuer die Lineage selbst, nicht fuer eine einzelne Versions-GUID. */
    applies(kennelLineageId: unknown, requestedId: unknown): boolean {
        if (typeof kennelLineageId !== 'string' || !this.isSeeded(kennelLineageId)) return false;
        return typeof requestedId === 'string' && requestedId.toLowerCase() === kennelLineageId.toLowerCase();
    }

    /** Trockenlauf: was faellt mit, was bleibt und warum. null, wenn es den Kennel nicht gibt. */
    async plan(kennelId: string): Promise<SeededKennelDeleteReport | null> {
        const dogIds = await this.deps.kennelDogIds(kennelId);
        if (!dogIds) return null;
        const members = await this.members(dogIds);
        const usedBy = await this.outsideUsers(kennelId, members);
        this.keepParentsOfKept(members, usedBy);
        const dogsDeleted: SeededKennelDogRef[] = [];
        const dogsKept: SeededKennelKeptDog[] = [];
        for (const [lineageId, member] of members) {
            const users = usedBy.get(lineageId);
            if (users && users.size > 0) dogsKept.push({ lineageId, displayName: member.displayName, usedBy: [...users] });
            else dogsDeleted.push({ lineageId, displayName: member.displayName });
        }
        return { kennelId, dogsDeleted, dogsKept, reseed: SeededKennelDelete.RESEED };
    }

    /** Loescht den Kennel und die Dogs, die sonst niemand nutzt. null, wenn es den Kennel nicht gibt. */
    async delete(kennelId: string): Promise<SeededKennelDeleteReport | null> {
        const plan = await this.plan(kennelId);
        if (!plan) return null;
        await this.deps.rememberKept?.(kennelId, plan.dogsKept);
        if (!(await this.deps.deleteKennel(kennelId))) throw new Error(`kennel ${kennelId} not deleted`);
        const dogsDeleted: SeededKennelDogRef[] = [];
        const dogsKept = [...plan.dogsKept];
        for (const dog of plan.dogsDeleted) {
            if (await this.deps.deleteDog(dog.lineageId).catch(() => false)) dogsDeleted.push(dog);
            else dogsKept.push({ ...dog, usedBy: [SeededKennelDelete.DELETE_FAILED] });
        }
        if (dogsKept.length > plan.dogsKept.length) await this.deps.rememberKept?.(kennelId, dogsKept.slice(plan.dogsKept.length));
        this.deps.afterDelete?.(kennelId);
        return { ...plan, dogsDeleted, dogsKept };
    }

    /** Die besitzerlosen Dogs des Kennels: dogIds und Parents, transitiv; Base-Dogs und Dogs mit Besitzer nicht. */
    private async members(dogIds: string[]): Promise<Map<string, { displayName: string; parents: string[] }>> {
        const members = new Map<string, { displayName: string; parents: string[] }>();
        const seen = new Set<string>();
        let frontier = [...dogIds];
        while (frontier.length > 0 && seen.size < this.maxDogs) {
            const next: string[] = [];
            for (const ref of frontier) {
                const lineageId = await this.deps.lineageOf(ref);
                if (!lineageId || seen.has(lineageId)) continue;
                seen.add(lineageId);
                next.push(lineageId);
            }
            if (next.length === 0) break;
            frontier = [];
            for (const head of await this.deps.dogHeads(next)) {
                const lineageId = head.lineageId || head.id;
                if (!lineageId || head.ownerId) continue;
                const parentRefs = [...refList(head.parentsRequired), ...refList(head.parentsOptional)];
                const parents: string[] = [];
                for (const ref of parentRefs) {
                    const parent = await this.deps.lineageOf(ref);
                    if (parent) parents.push(parent);
                }
                members.set(lineageId, { displayName: head.displayName || lineageId, parents });
                frontier.push(...parents);
            }
        }
        return members;
    }

    /** Je Dog: wer ihn ausserhalb dieses Kennels nutzt — ein anderer Kennel oder ein Dog, der nicht dazugehoert. */
    private async outsideUsers(kennelId: string, members: Map<string, unknown>): Promise<Map<string, Set<string>>> {
        const usedBy = new Map<string, Set<string>>();
        const add = (lineageId: string, user: string) => {
            const set = usedBy.get(lineageId) ?? new Set<string>();
            set.add(user);
            usedBy.set(lineageId, set);
        };
        const rows = await this.deps.referencesTo(new Set(members.keys()));
        if (rows === null) {
            for (const lineageId of members.keys()) add(lineageId, SeededKennelDelete.INDEX_BUSY);
            return usedBy;
        }
        const own = kennelId.toLowerCase();
        for (const row of rows) {
            if (!members.has(row.toKey)) continue;
            if (row.fromKind === 'kennel' && row.fromKey.toLowerCase() !== own) add(row.toKey, row.fromKey);
            if (row.fromKind === 'dog' && !members.has(row.fromKey)) add(row.toKey, row.fromKey);
        }
        return usedBy;
    }

    /** Ein Dog, der bleibt, braucht seine Parents: sie bleiben mit ihm (usedBy = der bleibende Dog). */
    private keepParentsOfKept(members: Map<string, { parents: string[] }>, usedBy: Map<string, Set<string>>): void {
        const queue = [...usedBy.keys()];
        while (queue.length > 0) {
            const kept = queue.shift()!;
            for (const parent of members.get(kept)?.parents ?? []) {
                if (!members.has(parent) || usedBy.has(parent)) continue;
                usedBy.set(parent, new Set([kept]));
                queue.push(parent);
            }
        }
    }
}
