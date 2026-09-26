import { createPact } from "@slopdogs/core";

/**
 * Datamuse hat mehr Parameter als der simple WordQueryPact —
 * Relation-Typ (rhymes, related, synonym) und Limit.
 */
export interface DatamuseQuery {
    /** Ausgangs-Wort (ml, rel, sl-Bezug) */
    word: string;
    /** Beziehungstyp — siehe Datamuse-API:
     *  rhy = reime, nry = near rhymes, syn = Synonyme,
     *  ant = Antonyme, trg = Trigger-Woerter, ml = means like, sl = sounds like,
     *  sp = spelled like. Default: "rhy" */
    relation?: string;
    /** Max. Anzahl Ergebnisse (1-1000) — default 20 */
    max?: number;
}

export const DatamuseQueryPact = createPact<DatamuseQuery>(
    "DatamuseQueryProvider",
    { fromSourceType: "DatamuseQuery" }
);
