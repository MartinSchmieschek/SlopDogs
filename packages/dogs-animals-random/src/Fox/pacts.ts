import { createPact } from "@slopdogs/core";

export interface FoxQuery {
    /** Ohne Effekt — Pact dient nur als Form-Anker */
    noop?: string;
}

export const FoxQueryPact = createPact<FoxQuery>(
    "FoxQueryProvider",
    { fromSourceType: "FoxQuery" }
);
