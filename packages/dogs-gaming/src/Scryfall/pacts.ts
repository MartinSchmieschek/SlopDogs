import { createPact } from "@slopdogs/core";

export interface ScryfallQuery {
    /** Modus: named (exact/fuzzy), search (Volltext), random */
    mode?: string;
    /** Kartenname (named) oder Suchstring (search) */
    value?: string;
    /** Bei named: exact (default) oder fuzzy */
    match?: string;
    /** Bei search: page (default 1) */
    page?: number;
}

export const ScryfallQueryPact = createPact<ScryfallQuery>(
    "ScryfallQueryProvider",
    { fromSourceType: "ScryfallQuery" }
);
