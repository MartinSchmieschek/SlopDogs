export interface ScryfallResult {
    mode: string;
    query: string;
    /** Bei search: Liste; bei named/random: einzelne Karte */
    data: unknown;
    totalCards?: number;
    hasMore?: boolean;
}
