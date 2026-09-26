import { createPact } from "@slopdogs/core";

export interface GutenbergQuery {
    /** Volltext-Suche (Autor, Titel, Schlagwoerter) */
    search?: string;
    /** ISO-Sprachcode (en, de, fr, ...) — optional */
    language?: string;
    /** Thema/Topic (Subject/Bookshelf, z.B. "children") — optional */
    topic?: string;
    /** Seite — default 1 */
    page?: number;
}

export const GutenbergQueryPact = createPact<GutenbergQuery>(
    "GutenbergQueryProvider",
    { fromSourceType: "GutenbergQuery" }
);
