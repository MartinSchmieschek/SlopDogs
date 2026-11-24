// Welche Dogs fuellen einen Kennel — schmal aufgeloest, ohne tsCode (PLAN-KENNEL-CACHE D1). Dieselbe Rangfolge wie
// der Lauf (KennelRunHandler.createSerializedDogFactory): je ID Version-GUID vor Lineage vor displayName, je Lineage
// die neueste Zeile ueber SerializedDog und MimicDog, die Rechte vom Lineage-Kopf. Base-Dogs mit den Pflicht-Eltern,
// die autoMimic ergaenzt. Klassifizierer (P1) und Fingerabdruck (P3) lesen dieselbe Aufloesung.
import { BASE_DOG_PREFIX, MimicDog, SerializedDog } from '@martinschmieschek/slopdogs-core/runtime';
import type { DogVersionRefRow, IStore } from '../../store/IStore';
import { aclOf, type AclEntity } from '../../mcp/auth/visibility';
import type { BaseDogCacheClasses } from './BaseDogCacheClasses';

/** Ein eigener Dog im Kennel: die Version, die laeuft, und die Rechte seines Lineage-Kopfes. */
export interface ResolvedOwnDog {
    versionId: string;
    lineageId: string;
    type: string;
    displayName: string | null;
    /** Fehlt, wenn der Kopf nicht gefunden wurde — dann gilt der Dog als fremd (fail-closed). */
    acl: AclEntity | undefined;
}

export class ResolvedKennelDogs {
    constructor(
        readonly own: readonly ResolvedOwnDog[],
        /** Base-Dog-Namen, ergaenzt um die Pflicht-Eltern, ohne Doppel. */
        readonly base: readonly string[],
        /** Angefragte IDs, zu denen keine Zeile passt (geloeschte Dogs, Tippfehler). */
        readonly unresolved: readonly string[],
    ) {}
}

export class KennelDogResolver {
    constructor(
        private readonly nodesStore: IStore,
        private readonly baseDogs: BaseDogCacheClasses,
    ) {}

    async resolve(dogIds: unknown): Promise<ResolvedKennelDogs> {
        const ids = Array.isArray(dogIds) ? dogIds.filter((d): d is string => typeof d === 'string' && d.length > 0) : [];
        const baseNames = ids.filter((id) => id.startsWith(BASE_DOG_PREFIX)).map((id) => id.slice(BASE_DOG_PREFIX.length));
        const ownIds = [...new Set(ids.filter((id) => !id.startsWith(BASE_DOG_PREFIX)))];
        const own = ownIds.length ? await this.resolveOwn(ownIds) : { dogs: [], unresolved: [] };
        return new ResolvedKennelDogs(own.dogs, this.baseDogs.expand(baseNames), own.unresolved);
    }

    private async resolveOwn(ids: string[]): Promise<{ dogs: ResolvedOwnDog[]; unresolved: string[] }> {
        const [serialized, mimics] = await Promise.all([
            this.nodesStore.findVersionRefsByType(SerializedDog.name, ids),
            this.nodesStore.findVersionRefsByType(MimicDog.name, ids),
        ]);
        const byLineage = new Map<string, DogVersionRefRow>();
        for (const row of [...serialized, ...mimics]) {
            const lineageId = row.cfgLineageId || row.lineageId || row.id;
            const existing = byLineage.get(lineageId);
            if (!existing || KennelDogResolver.time(row) > KennelDogResolver.time(existing)) byLineage.set(lineageId, row);
        }
        const heads = await this.headAcls([...byLineage.keys()]);
        const dogs = [...byLineage.entries()].map(([lineageId, row]) => ({
            versionId: row.id,
            lineageId,
            type: row.type,
            displayName: row.displayName,
            acl: heads.get(lineageId),
        }));
        const matched = new Set<string>();
        for (const row of [...serialized, ...mimics]) {
            for (const key of [row.id, row.lineageId, row.cfgLineageId, row.displayName]) if (key) matched.add(key);
        }
        return { dogs, unresolved: ids.filter((id) => !matched.has(id)) };
    }

    /** Die Rechte des Kopfes je Lineage, wie DogAclIndex: SerializedDog, dann MimicDog (ein Typwechsel gewinnt). */
    private async headAcls(lineageIds: string[]): Promise<Map<string, AclEntity>> {
        const out = new Map<string, AclEntity>();
        if (lineageIds.length === 0) return out;
        const [serialized, mimics] = await Promise.all([
            this.nodesStore.findVersionRefsByType(SerializedDog.name, lineageIds),
            this.nodesStore.findVersionRefsByType(MimicDog.name, lineageIds),
        ]);
        for (const row of [...serialized, ...mimics]) {
            if (row.lineageId && lineageIds.includes(row.lineageId)) out.set(row.lineageId, aclOf(row));
        }
        return out;
    }

    private static time(row: DogVersionRefRow): number {
        return row.createdAt ? new Date(row.createdAt).getTime() : 0;
    }
}
