import { createPact } from "@slopdogs/core";

export interface DuckQuery {
    /** Ohne Effekt — Pact dient nur als Form-Anker */
    noop?: string;
}

export const DuckQueryPact = createPact<DuckQuery>(
    "DuckQueryProvider",
    { fromSourceType: "DuckQuery" }
);
