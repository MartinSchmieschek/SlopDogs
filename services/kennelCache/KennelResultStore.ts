// Die Ablage des Ergebnis-Caches (PLAN-KENNEL-CACHE E1, D7, 5) ueber den Cache-Speicher der App-Config
// (config/cache/ICacheStore.ts; Default RAM vor DB, Tabelle CacheEntry). Gruppe = Kennel-Lineage.
// Ein Eintrag traegt nur das Lead-Ergebnis (bereinigt), seinen Status und seine Art — nie Waves, nie Rohwerte.
import type { CacheRecord, ICacheStore } from '../../config/cache/ICacheStore';

/** Was ein Treffer ausliefert: `ok` mit Wert, `empty` als JSON null (wie GET /k/ heute). */
export type CachedLeadStatus = 'ok' | 'empty';
/** Wie der Wert ausgeliefert wird — nur zur Auskunft, die Auslieferung erkennt die Art selbst wieder. */
export type CachedContentKind = 'html' | 'markdown' | 'json' | 'lobby' | 'null';

export interface KennelResultEntry {
    key: string;
    lineageId: string;
    scope: string;
    /** Das Lead-Ergebnis als JSON-Text. */
    value: string;
    leadStatus: CachedLeadStatus;
    contentKind: CachedContentKind;
    sizeBytes: number;
    createdAt: number;
    expiresAt: number;
    infinite: boolean;
    lastHitAt: number;
}

export interface IKennelResultStore {
    get(key: string): Promise<KennelResultEntry | null>;
    /** Anlegen oder ersetzen; danach hoechstens `maxPerKennel` Eintraege je Lineage (die am laengsten ungenutzten gehen). */
    put(entry: KennelResultEntry, maxPerKennel: number): Promise<void>;
    /** Ein Treffer: lastHitAt und — fuer unendliche Eintraege — der gleitende Ablauf. */
    touch(key: string, lastHitAt: number, expiresAt: number | null): Promise<void>;
    /** Alle Eintraege einer Lineage (Kennel geloescht). */
    deleteLineage(lineageId: string): Promise<number>;
    /** Abgelaufene Eintraege, aelter als `before`. */
    prune(before: number): Promise<number>;
    /** Fuer Tests und Auskunft: Eintraege einer Lineage. */
    countLineage(lineageId: string): Promise<number>;
}

/**
 * IKennelResultStore auf einem ICacheStore: der Eintrag wird ein CacheRecord mit `group = lineageId`, die
 * Felder des Ergebnis-Caches stehen in `meta`. Kappen je Kennel ist `trimGroup`.
 */
export class CacheStoreKennelResultStore implements IKennelResultStore {
    constructor(private readonly store: ICacheStore) {}

    async get(key: string): Promise<KennelResultEntry | null> {
        const record = await this.store.get(key);
        return record ? CacheStoreKennelResultStore.entryOf(key, record) : null;
    }

    async put(entry: KennelResultEntry, maxPerKennel: number): Promise<void> {
        await this.store.set(entry.key, {
            value: entry.value,
            expiresAt: entry.expiresAt,
            group: entry.lineageId,
            meta: {
                scope: entry.scope,
                leadStatus: entry.leadStatus,
                contentKind: entry.contentKind,
                createdAt: entry.createdAt,
                infinite: entry.infinite,
            },
            sizeBytes: entry.sizeBytes,
            lastHitAt: entry.lastHitAt,
        });
        await this.store.trimGroup(entry.lineageId, maxPerKennel);
    }

    async touch(key: string, lastHitAt: number, expiresAt: number | null): Promise<void> {
        await this.store.touch(key, lastHitAt, expiresAt ?? undefined);
    }

    async deleteLineage(lineageId: string): Promise<number> {
        return this.store.deleteGroup(lineageId);
    }

    async prune(before: number): Promise<number> {
        return this.store.prune(before);
    }

    async countLineage(lineageId: string): Promise<number> {
        return this.store.countGroup(lineageId);
    }

    private static entryOf(key: string, record: CacheRecord): KennelResultEntry {
        const meta = record.meta ?? {};
        return {
            key,
            lineageId: record.group ?? '',
            scope: String(meta.scope ?? ''),
            value: record.value,
            leadStatus: meta.leadStatus === 'empty' ? 'empty' : 'ok',
            contentKind: String(meta.contentKind ?? 'json') as CachedContentKind,
            sizeBytes: record.sizeBytes,
            createdAt: Number(meta.createdAt ?? 0),
            expiresAt: record.expiresAt,
            infinite: meta.infinite === true,
            lastHitAt: record.lastHitAt,
        };
    }
}
