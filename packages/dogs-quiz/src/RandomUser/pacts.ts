import { createPact } from "@slopdogs/core";

export interface RandomUserQuery {
    /** Anzahl — default 1 (max 5000) */
    results?: number;
    /** Geschlecht: male, female */
    gender?: string;
    /** Nationalitaet-Codes (komma-separiert, z.B. "de,us,fr") */
    nat?: string;
    /** Seed fuer deterministische Ergebnisse — optional */
    seed?: string;
}

export const RandomUserQueryPact = createPact<RandomUserQuery>(
    "RandomUserQueryProvider",
    { fromSourceType: "RandomUserQuery" }
);
