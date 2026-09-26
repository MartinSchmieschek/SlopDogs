import { createPact } from "@slopdogs/core";

export interface WikidataQuery {
    /** Roh-SPARQL (wenn gesetzt, werden search/entity ignoriert) */
    sparql?: string;
    /** Einfache Labelsuche ueber wbsearchentities — liefert passende Q-IDs und Labels */
    search?: string;
    /** Direkte Q-ID (z.B. "Q42") — liefert Entitaetsdaten via wbgetentities */
    entity?: string;
    /** Sprache fuer Label/Beschreibung — default "en" */
    lang?: string;
    /** Max. Ergebnisse fuer search — default 10 */
    limit?: number;
}

export const WikidataQueryPact = createPact<WikidataQuery>(
    "WikidataQueryProvider",
    { fromSourceType: "WikidataQuery" }
);
