import { createPact } from "@slopdogs/core";

export interface QuoteQuery {
    /** Autor-Filter (Slug, e.g. "albert-einstein") — optional */
    author?: string;
    /** Thema/Tag — optional (e.g. "wisdom", "life") */
    tag?: string;
    /** Minimale Zeichenzahl */
    minLength?: number;
    /** Maximale Zeichenzahl */
    maxLength?: number;
}

export const QuoteQueryPact = createPact<QuoteQuery>(
    "QuoteQueryProvider",
    { fromSourceType: "QuoteQuery" }
);
