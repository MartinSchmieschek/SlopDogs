import { createPact } from "@slopdogs/core";

export interface CatFactQuery {
    /** Maximale Laenge des Fakts (Zeichen) — optional */
    maxLength?: number;
}

export const CatFactQueryPact = createPact<CatFactQuery>(
    "CatFactQueryProvider",
    { fromSourceType: "CatFactQuery" }
);
