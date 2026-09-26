export interface MusicBrainzResult {
    mode: "lookup" | "search";
    entity: string;
    /** Bei lookup: das Entity-Objekt; bei search: Suchergebnisse inkl. Pagination-Felder */
    data: unknown;
}
