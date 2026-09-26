// Aufrufe und Sterne je Kennel-Lineage (P4) — der Vertrag, den der Zaehler und der
// Stats-Dienst gegen den Store sprechen. Reine Zahlen: keine IP, kein User-Agent; die
// einzige Identitaet ist die userId einer Bewertung.

export const KENNEL_CALL_SOURCES = [
    'public', 'api-execute', 'mcp-execute',                                 // "Nutzung" — rankt
    'api-run', 'mcp-run', 'mcp-snapshot', 'mcp-build', 'swagger', 'unknown', // gespeichert, rankt nicht
    'landing',                                                               // Lauf fuer / (P5): gespeichert, rankt nicht
] as const;
export type KennelCallSource = typeof KENNEL_CALL_SOURCES[number];
/** Quellen, die in rankedTotal/ranked30d einfliessen. Einzige Stelle fuer diese Regel. */
export const RANKED_CALL_SOURCES: readonly KennelCallSource[] = ['public', 'api-execute', 'mcp-execute'];

export interface KennelCallDelta { lineageId: string; day: string; source: KennelCallSource; count: number; leadFailed: number; }
/** leadFailed zaehlt ueber alle Tage, leadFailed30d im selben Fenster wie last30d (Filter usage=failing). */
export interface KennelCallAggregate { lineageId: string; total: number; last30d: number; leadFailed: number; leadFailed30d: number; rankedTotal: number; ranked30d: number; }
export interface KennelRatingAggregate { lineageId: string; count: number; sum: number; }
export type KennelRatingHistogram = { 1: number; 2: number; 3: number; 4: number; 5: number };

export interface IKennelStatsStore {
    /**
     * Addiert jede Delta-Zeile atomar auf (lineageId, day, source). Leeres Array = no-op. Wirft bei DB-Fehler (Aufrufer behaelt die Deltas).
     * P4b: die Dog-Deltas desselben Flushs reisen in DERSELBEN Transaktion mit (ein Flush, ein Commit).
     */
    incrementKennelCalls(deltas: KennelCallDelta[], dogDeltas?: DogCallDelta[]): Promise<void>;
    /** Aggregate je Lineage. Ohne lineageIds: alle. Mit lineageIds: nur diese (fehlende -> Aufrufer nimmt 0). */
    readKennelCallAggregates(sinceDay: string, lineageIds?: string[]): Promise<KennelCallAggregate[]>;
    readKennelRatingAggregates(lineageIds?: string[]): Promise<KennelRatingAggregate[]>;
    /** Verteilung 1..5 fuer eine Lineage (nur Rating-Endpunkt). */
    readKennelRatingHistogram(lineageId: string): Promise<KennelRatingHistogram>;
    readKennelRating(lineageId: string, userId: string): Promise<number | null>;
    upsertKennelRating(lineageId: string, userId: string, stars: number): Promise<void>;
    deleteKennelRating(lineageId: string, userId: string): Promise<boolean>;
    /** Loescht alle Zaehler und Bewertungen der Lineage (Kennel-Delete). */
    deleteKennelStats(lineageId: string): Promise<void>;
}

// --- Dog-Aufrufe und Referenzen (P4b) — derselbe Vertrag, dieselbe Datei, derselbe Client ---

/** Ein Delta je (dogKey, kennelLineageId, day, source) — Zaehlungen je Ergebnisklasse plus Cache und Dauer. */
export interface DogCallDelta {
    dogKey: string; kennelLineageId: string; day: string; source: KennelCallSource;
    count: number; ok: number; cached: number; errors: number; timeouts: number; oom: number;
    cacheHits: number; cacheMisses: number; durationMsSum: number; durationMsMax: number;
}
export interface DogCallAggregate {
    dogKey: string;
    total: number; last30d: number; ranked30d: number;
    failures: number;               // errors + timeouts + oom, alle Tage (Filter usage=never_worked)
    failures30d: number;            // errors + timeouts + oom, 30 d
    cached30d: number; durationMsSum30d: number; count30d: number; durationMsMax30d: number;
    kennelsRun30d: number;          // distinct kennelLineageId mit count > 0 in 30 d
}
export interface DogKennelUsage { dogKey: string; kennelLineageId: string; count30d: number; failures30d: number; }
export type DogReferenceFromKind = 'kennel' | 'dog';
export type DogReferenceKind = 'crew' | 'required' | 'optional';
export interface DogReferenceRow {
    fromKind: DogReferenceFromKind; fromKey: string; toKey: string; kind: DogReferenceKind;
    position: number; fromOwnerId: string | null; resolved: 0 | 1;
}

export interface IDogStatsStore {
    /** Addiert jede Delta-Zeile atomar (ON CONFLICT … + excluded, durationMsMax per MAX/GREATEST). */
    incrementDogCalls(deltas: DogCallDelta[]): Promise<void>;
    /** Aggregate je Dog. Ohne dogKeys: alle. */
    readDogCallAggregates(sinceDay: string, dogKeys?: string[]): Promise<DogCallAggregate[]>;
    readDogKennelUsage(sinceDay: string, dogKey: string): Promise<DogKennelUsage[]>;
    deleteDogCalls(dogKey: string): Promise<void>;
    /** delete where (fromKind, fromKey) + insert, eine Transaktion. */
    replaceReferences(fromKind: DogReferenceFromKind, fromKey: string, rows: DogReferenceRow[]): Promise<void>;
    removeReferences(fromKind: DogReferenceFromKind, fromKey: string): Promise<void>;
    /** Fuer das Memo (klein: Kopfversionen). */
    readAllReferences(): Promise<DogReferenceRow[]>;
    /** DELETE ALL + insert, eine Transaktion (Boot). */
    rebuildReferences(rows: DogReferenceRow[]): Promise<void>;
}
