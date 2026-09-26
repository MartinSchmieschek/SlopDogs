import { createPact } from "@slopdogs/core";

/**
 * Gemeinsamer Wort-Query-Pact fuer alle Wort-basierten Hunde dieses Packages.
 * Dictionary und Datamuse teilen sich diesen Vertrag.
 */
export interface WordQuery {
    /** Das Wort, das befragt werden soll */
    word: string;
    /** Sprache (nur fuer Dictionary relevant: en, de, es, fr, ja, hi, ru, ...) — default: en */
    lang?: string;
}

export const WordQueryPact = createPact<WordQuery>(
    "WordQueryProvider",
    { fromSourceType: "WordQuery" }
);
