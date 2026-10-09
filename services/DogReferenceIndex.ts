// DogReferenceIndex — wer wen referenziert (P4b 4b.5): Kennel -> Dog (dogIds, kind 'crew') und
// Dog -> Dog (parentsRequired/-Optional). Abgeleitet am Controller beim Speichern der Kopfversion,
// beim Boot einmal idempotent aus den Kopfversionen neu gebaut — zur Laufzeit kein Partitions-Scan.
//
// Warum am Controller und nicht in PrismaStore.save: der Store-Save ist ein generischer Upsert mit
// Aufrufern (Seeds, heal, cascadeVisibility, rename), denen die Bedeutung der Zeile fehlt. Was am
// Controller vorbeigeht (Seeds), heilt der naechste Boot.
import { BASE_DOG_PREFIX } from '@slopdogs/core';
import type { IStore, ReferenceHeadRow } from '../store/IStore';
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
/**
 * Gleichzeitige PK-Lookups im Rebuild. Bewusst klein: der Rebuild laeuft nach listen() neben echten Anfragen
 * und soll ihnen den 4er-Pool nicht wegnehmen; die Lookups sind schmal, die Dauer zaehlt wenig.
 */
const LOOKUP_CONCURRENCY = 2;

/** fn ueber items, hoechstens limit gleichzeitig; Ergebnis in Eingangsreihenfolge. */
async function mapBounded<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const out = new Array<R>(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const index = next++;
            out[index] = await fn(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
}

type PendingWrite = { kind: DogReferenceFromKind; key: string; rows: DogReferenceRow[] | null };

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
    private rebuilding = false;
    /** Schreibzugriffe waehrend eines Rebuilds, je Ursprung der letzte — danach nachgespielt. */
    private readonly writesDuringRebuild = new Map<string, PendingWrite>();

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
        if (this.rebuilding) this.writesDuringRebuild.set(sourceKey(kind, key), { kind, key, rows: null });
        this.changed();
    }

    /** Letzte Version eines Dogs geloescht: Referenzen von ihm, seine Laeufe, seine ungeflushten Deltas. */
    async forgetDog(lineageId: string): Promise<void> {
        this.counter?.forgetDog(lineageId);
        await this.store.deleteDogCalls(lineageId);
        await this.removeFrom('dog', lineageId);
    }

    /** Laeuft gerade ein Rebuild? Schreibt in der Zeit ein Controller, wird das danach nachgespielt. */
    get isRebuilding(): boolean {
        return this.rebuilding;
    }

    /**
     * Boot: aus den Kopfversionen (SQL-Fenster, keine ueberholten Versionen) alle Zeilen ableiten und in
     * EINER Transaktion ersetzen. Idempotent; heilt jede Drift (Seeds). Geladen wird schmal — je Kopf nur
     * id, Lineage, Owner und die Referenzlisten, nie tsCode — und Typ fuer Typ nacheinander, damit nie
     * mehrere Ergebnismengen gleichzeitig in Query-Engine und Heap liegen. Version-GUIDs, die keine
     * Kopfversion sind, werden mit hoechstens LOOKUP_CONCURRENCY parallelen PK-Lookups aufgeloest.
     *
     * Der Boot startet ihn NACH listen(): Controller-Schreibzugriffe waehrend des Rebuilds landen sofort in
     * der Tabelle und werden nach seiner Transaktion noch einmal geschrieben — der Rebuild ueberschreibt
     * sie also nicht mit seinem aelteren Stand.
     */
    async rebuild(): Promise<RebuildReport> {
        const startedAt = Date.now();
        this.rebuilding = true;
        this.writesDuringRebuild.clear();
        try {
            return await this.rebuildFromHeads(startedAt);
        } finally {
            this.rebuilding = false;
            this.writesDuringRebuild.clear();
        }
    }

    private async rebuildFromHeads(startedAt: number): Promise<RebuildReport> {
        const kennelRows = await this.headsOf('KennelConfig');
        const dogRowsByType: ReferenceHeadRow[][] = [];
        for (const type of DOG_TYPES) dogRowsByType.push(await this.headsOf(type));
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
            sources.push({
                fromKind: 'dog', fromKey: key, ownerId: row.ownerId ?? null,
                refs: [['required', stringList(parseJson(row.parentsRequired))], ['optional', stringList(parseJson(row.parentsOptional))]],
            });
        }

        // Gebuendelt: jede noch unbekannte GUID genau einmal nachschlagen — begrenzt parallel.
        const unknown = new Set<string>();
        for (const s of sources) for (const [, list] of s.refs) for (const raw of list) {
            if (!this.baseKeyOf(raw) && !known.has(raw)) unknown.add(raw);
        }
        const looked = await mapBounded([...unknown], LOOKUP_CONCURRENCY, async (raw) => [raw, await this.lookup(raw)] as const);
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
        await this.replayWritesDuringRebuild();
        this.changed();
        return { rows: rows.length, kennels: kennelRows.length, dogs: dogRows.length, durationMs: Date.now() - startedAt };
    }

    /** Schmale Kopfzeilen; scheitert der schmale Weg (Postgres: ungueltiges JSON im Cast), der alte volle. */
    private async headsOf(type: string): Promise<ReferenceHeadRow[]> {
        try {
            return await this.nodesStore.findReferenceHeads(type);
        } catch (err) {
            console.warn(`[DogReferenceIndex] schmale Kopfzeilen fuer ${type} gescheitert, voller Weg:`, err instanceof Error ? err.message : err);
            return (await this.nodesStore.findLatestByType(type)).map((row) => DogReferenceIndex.headFromFullRow(type, row));
        }
    }

    /** Dieselbe Ableitung wie die SQL-Extraktion in PrismaStore.findReferenceHeads — aus einer vollen Zeile. */
    static headFromFullRow(type: string, row: any): ReferenceHeadRow {
        const head: ReferenceHeadRow = { id: row.id, lineageId: row.lineageId ?? null, ownerId: row.ownerId ?? null, createdAt: row.createdAt ?? null };
        if (type === 'KennelConfig') return { ...head, dogIds: row.dogIds ?? null };
        const cfg = parseJson(row.serializedDogConfig);
        const asJson = (v: unknown) => (Array.isArray(v) || typeof v === 'string' ? JSON.stringify(v) : null);
        return {
            ...head,
            cfgLineageId: typeof cfg?.lineageId === 'string' && cfg.lineageId ? cfg.lineageId : null,
            parentsRequired: asJson(cfg?.parentsRequired),
            parentsOptional: asJson(cfg?.parentsOptional),
        };
    }

    /** Was Controller waehrend des Rebuilds geschrieben haben, gilt — nicht der aeltere Stand des Rebuilds. */
    private async replayWritesDuringRebuild(): Promise<void> {
        for (const [key, write] of this.writesDuringRebuild) {
            if (write.rows === null) {
                await this.store.removeReferences(write.kind, write.key);
                this.rowsBySource.delete(key);
            } else {
                await this.store.replaceReferences(write.kind, write.key, write.rows);
                if (write.rows.length > 0) this.rowsBySource.set(key, write.rows.length);
                else this.rowsBySource.delete(key);
            }
        }
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

    /**
     * Version-GUID (PK) oder lineageId; sonst dangling. Schmal: die Zeile liefert nur, ob sie Kennel-Spalten
     * oder eine Konfig traegt und welche Lineage darin steht. Nur Altformen, deren Lineage sich so nicht
     * zeigt, und ein gescheiterter schmaler Weg laufen ueber den alten vollen Lookup.
     */
    private async lookup(raw: string): Promise<NormalizedRef> {
        try {
            const target = await this.nodesStore.findReferenceTarget(raw);
            if (target && (target.kennelish || target.hasConfig)) {
                const lineageId = target.kennelish ? target.lineageId || target.cfgLineageId : target.cfgLineageId;
                return lineageId ? { toKey: lineageId, resolved: 1 } : this.fullLookup(raw);
            }
            return { toKey: raw, resolved: (await this.nodesStore.lineageExists(raw)) ? 1 : 0 };
        } catch {
            return this.fullLookup(raw);
        }
    }

    /** Der alte Lookup ueber die volle Zeile — dieselbe Semantik, mehr Daten. */
    private async fullLookup(raw: string): Promise<NormalizedRef> {
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
        if (this.rebuilding) this.writesDuringRebuild.set(sourceKey(kind, key), { kind, key, rows });
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
        const fromConfig = row?.cfgLineageId !== undefined ? row.cfgLineageId : parseJson(row?.serializedDogConfig)?.lineageId;
        const key = row?.lineageId || fromConfig || row?.id;
        return typeof key === 'string' && key ? key : null;
    }
}
