// DogReferenceIndex — wer wen referenziert (P4b 4b.5): Kennel -> Dog (dogIds, kind 'crew') und
// Dog -> Dog (parentsRequired/-Optional). Abgeleitet am Controller beim Speichern der Kopfversion,
// beim Boot einmal idempotent aus den Kopfversionen neu gebaut — zur Laufzeit kein Partitions-Scan.
//
// Warum am Controller und nicht in PrismaStore.save: der Store-Save ist ein generischer Upsert mit
// Aufrufern (Seeds, heal, cascadeVisibility, rename), denen die Bedeutung der Zeile fehlt. Was am
// Controller vorbeigeht (Seeds), heilt der naechste Boot.
import { BASE_DOG_PREFIX } from '@slopdogs/core';
import type { IStore } from '../store/IStore';
import type { DogReferenceFromKind, DogReferenceKind, DogReferenceRow, IDogStatsStore } from '../store/IKennelStatsStore';
import type { KennelCallCounter } from './KennelCallCounter';

/** Ein normalisiertes Ziel: lineageId | 'base:<Klasse>' | Rohwert (dangling, resolved 0). */
export interface NormalizedRef {
    toKey: string;
    resolved: 0 | 1;
}

/** Was der Boot-Rebuild gebaut hat — fuer das Log und die Abnahme (Zeilen = Kopf-dogIds + Kopf-parents). */
export interface RebuildReport {
    rows: number;
    kennels: number;
    dogs: number;
    durationMs: number;
}

const DOG_TYPES = ['SerializedDog', 'MimicDog'] as const;

function parseJson(raw: unknown): any {
    if (typeof raw !== 'string') return raw ?? null;
    try { return JSON.parse(raw); } catch { return null; }
}

function stringList(raw: unknown): string[] {
    const list = Array.isArray(raw) ? raw : parseJson(raw);
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

function sourceKey(kind: DogReferenceFromKind, key: string): string {
    return `${kind}\u0000${key}`;
}

export class DogReferenceIndex {
    private readonly listeners: Array<() => void> = [];
    /** Zeilen je Ursprung — der Zaehler fuer health_check.dogStats.referenceRows, ohne Query. */
    private readonly rowsBySource = new Map<string, number>();

    constructor(
        private readonly store: IDogStatsStore,
        private readonly nodesStore: IStore,
        private readonly baseDogsMap: Map<string, unknown>,
        private readonly counter?: KennelCallCounter,
    ) { }

    /** Abhaengige Memos (DogStatsService) haengen sich hier an: jede Aenderung invalidiert. */
    onChange(listener: () => void): void {
        this.listeners.push(listener);
    }

    /** Referenzzeilen, die dieser Prozess zuletzt geschrieben hat (nach Boot-Rebuild exakt). */
    get referenceRows(): number {
        let n = 0;
        for (const count of this.rowsBySource.values()) n += count;
        return n;
    }

    /** Kennel gespeichert (create, neue Version, heal): seine Crew ersetzt die alte. */
    async replaceKennelRefs(lineageId: string, ownerId: string | null | undefined, dogIds: unknown): Promise<void> {
        const rows: DogReferenceRow[] = [];
        const ids = stringList(dogIds);
        for (const [position, raw] of ids.entries()) {
            const ref = await this.normalize(raw);
            rows.push({ fromKind: 'kennel', fromKey: lineageId, toKey: ref.toKey, kind: 'crew', position, fromOwnerId: ownerId ?? null, resolved: ref.resolved });
        }
        await this.replace('kennel', lineageId, rows);
    }

    /** Dog gespeichert (create, neue Version): seine parents ersetzen die alten. */
    async replaceDogRefs(lineageId: string, ownerId: string | null | undefined, required: unknown, optional: unknown): Promise<void> {
        const rows: DogReferenceRow[] = [];
        for (const [kind, list] of [['required', stringList(required)], ['optional', stringList(optional)]] as Array<[DogReferenceKind, string[]]>) {
            for (const [position, raw] of list.entries()) {
                const ref = await this.normalize(raw);
                rows.push({ fromKind: 'dog', fromKey: lineageId, toKey: ref.toKey, kind, position, fromOwnerId: ownerId ?? null, resolved: ref.resolved });
            }
        }
        await this.replace('dog', lineageId, rows);
    }

    /** Ursprung geloescht: seine Zeilen fallen. Referenzen AUF ihn bleiben (dangling, wie geschrieben). */
    async removeFrom(kind: DogReferenceFromKind, key: string): Promise<void> {
        await this.store.removeReferences(kind, key);
        this.rowsBySource.delete(sourceKey(kind, key));
        this.changed();
    }

    /** Letzte Version eines Dogs geloescht: Referenzen von ihm, seine Laeufe, seine ungeflushten Deltas. */
    async forgetDog(lineageId: string): Promise<void> {
        this.counter?.forgetDog(lineageId);
        await this.store.deleteDogCalls(lineageId);
        await this.removeFrom('dog', lineageId);
    }

    /**
     * Boot: aus den Kopfversionen (findLatestByType — SQL-Fenster, keine ueberholten Versionen) alle
     * Zeilen ableiten und in EINER Transaktion ersetzen. Idempotent; heilt jede Drift (Seeds).
     * Version-GUIDs, die keine Kopfversion sind, werden gebuendelt per PK-Lookup aufgeloest.
     */
    async rebuild(): Promise<RebuildReport> {
        const startedAt = Date.now();
        const [kennelRows, ...dogRowsByType] = await Promise.all([
            this.nodesStore.findLatestByType('KennelConfig'),
            ...DOG_TYPES.map((t) => this.nodesStore.findLatestByType(t)),
        ]);
        const dogRows = DogReferenceIndex.oneHeadPerLineage(dogRowsByType.flat());

        // Was ohne Query aufloesbar ist: jede Kopf-Lineage und jede Kopf-Version.
        const known = new Map<string, string>();
        for (const row of dogRows) {
            const lineageId = DogReferenceIndex.dogLineageOf(row);
            if (!lineageId) continue;
            known.set(lineageId, lineageId);
            if (typeof row.id === 'string') known.set(row.id, lineageId);
        }

        type Source = { fromKind: DogReferenceFromKind; fromKey: string; ownerId: string | null; refs: Array<[DogReferenceKind, string[]]> };
        const sources: Source[] = [];
        for (const row of kennelRows) {
            const key = row.lineageId || row.id;
            if (!key) continue;
            sources.push({ fromKind: 'kennel', fromKey: key, ownerId: row.ownerId ?? null, refs: [['crew', stringList(row.dogIds)]] });
        }
        for (const row of dogRows) {
            const key = DogReferenceIndex.dogLineageOf(row);
            if (!key) continue;
            const cfg = parseJson(row.serializedDogConfig) ?? {};
            sources.push({
                fromKind: 'dog', fromKey: key, ownerId: row.ownerId ?? null,
                refs: [['required', stringList(cfg.parentsRequired)], ['optional', stringList(cfg.parentsOptional)]],
            });
        }

        // Gebuendelt: jede noch unbekannte GUID genau einmal nachschlagen.
        const unknown = new Set<string>();
        for (const s of sources) for (const [, list] of s.refs) for (const raw of list) {
            if (!this.baseKeyOf(raw) && !known.has(raw)) unknown.add(raw);
        }
        const looked = await Promise.all([...unknown].map(async (raw) => [raw, await this.lookup(raw)] as const));
        const resolvedLater = new Map<string, NormalizedRef>(looked);

        const rows: DogReferenceRow[] = [];
        const seen = new Set<string>();
        this.rowsBySource.clear();
        for (const s of sources) {
            let count = 0;
            for (const [kind, list] of s.refs) {
                for (const [position, raw] of list.entries()) {
                    const base = this.baseKeyOf(raw);
                    const ref: NormalizedRef = base
                        ?? (known.has(raw) ? { toKey: known.get(raw)!, resolved: 1 } : resolvedLater.get(raw) ?? { toKey: raw, resolved: 0 });
                    const pk = `${s.fromKind}\u0000${s.fromKey}\u0000${ref.toKey}\u0000${kind}\u0000${position}`;
                    if (seen.has(pk)) continue;                       // doppelte Kopfzeile derselben Lineage (Altbestand)
                    seen.add(pk);
                    rows.push({ fromKind: s.fromKind, fromKey: s.fromKey, toKey: ref.toKey, kind, position, fromOwnerId: s.ownerId, resolved: ref.resolved });
                    count += 1;
                }
            }
            if (count > 0) this.rowsBySource.set(sourceKey(s.fromKind, s.fromKey), count);
        }
        await this.store.rebuildReferences(rows);
        this.changed();
        return { rows: rows.length, kennels: kennelRows.length, dogs: dogRows.length, durationMs: Date.now() - startedAt };
    }

    /**
     * Normalisierung eines Referenz-Eintrags: `base:X` und blanker Base-Klassenname -> `base:X`;
     * Version-GUID -> ihre lineageId (PK-Lookup); lineageId bleibt; Unbekanntes bleibt roh, resolved 0.
     */
    async normalize(raw: string): Promise<NormalizedRef> {
        return this.baseKeyOf(raw) ?? this.lookup(raw);
    }

    /** Der synchrone Teil der Normalisierung: Base-Dogs. null = kein Base-Dog. */
    normalizeToKey(raw: string): string | null {
        return this.baseKeyOf(raw)?.toKey ?? null;
    }

    private baseKeyOf(raw: string): NormalizedRef | null {
        if (raw.startsWith(BASE_DOG_PREFIX)) {
            return { toKey: raw, resolved: this.baseDogsMap.has(raw.slice(BASE_DOG_PREFIX.length)) ? 1 : 0 };
        }
        if (this.baseDogsMap.has(raw)) return { toKey: BASE_DOG_PREFIX + raw, resolved: 1 };
        return null;
    }

    /** Version-GUID (PK) oder lineageId; sonst dangling. */
    private async lookup(raw: string): Promise<NormalizedRef> {
        try {
            const row = await this.nodesStore.load(raw);
            if (row) {
                const cfg = typeof row === 'string' ? parseJson(row) : row;
                const lineageId = cfg?.lineageId || parseJson(cfg?.serializedDogConfig)?.lineageId;
                return { toKey: typeof lineageId === 'string' && lineageId ? lineageId : raw, resolved: 1 };
            }
            const versions = await this.nodesStore.findByLineageId(raw);
            return { toKey: raw, resolved: versions.length > 0 ? 1 : 0 };
        } catch {
            return { toKey: raw, resolved: 0 };
        }
    }

    private async replace(kind: DogReferenceFromKind, key: string, rows: DogReferenceRow[]): Promise<void> {
        await this.store.replaceReferences(kind, key, rows);
        if (rows.length > 0) this.rowsBySource.set(sourceKey(kind, key), rows.length);
        else this.rowsBySource.delete(sourceKey(kind, key));
        this.changed();
    }

    private changed(): void {
        for (const listener of this.listeners) {
            try { listener(); } catch { /* ein Zuhoerer darf den Index nicht brechen */ }
        }
    }

    /**
     * Eine Lineage kann Versionen beider Typen tragen (ein SerializedDog, der spaeter `imitates` bekam,
     * wird MimicDog) — findLatestByType liefert dann je Typ einen Kopf. Kopf ist der neueste ueber beide,
     * mit derselben Ordnung wie das SQL-Fenster: createdAt absteigend (ohne createdAt zuletzt), dann id.
     */
    static oneHeadPerLineage(rows: any[]): any[] {
        const rank = (r: any) => (r?.createdAt ? new Date(r.createdAt).getTime() : Number.NEGATIVE_INFINITY);
        const heads = new Map<string, any>();
        for (const row of rows) {
            const key = DogReferenceIndex.dogLineageOf(row);
            if (!key) continue;
            const current = heads.get(key);
            if (!current || rank(row) > rank(current) || (rank(row) === rank(current) && String(row.id) > String(current.id))) {
                heads.set(key, row);
            }
        }
        return [...heads.values()];
    }

    /** Die Lineage einer Dog-Kopfzeile: Spalte, sonst Konfig, sonst die Zeilen-id (Altbestand). */
    static dogLineageOf(row: any): string | null {
        const key = row?.lineageId || parseJson(row?.serializedDogConfig)?.lineageId || row?.id;
        return typeof key === 'string' && key ? key : null;
    }
}
