import { createPact } from "@slopdogs/core";

export interface BoredQuery {
    /** Typ: education, recreational, social, diy, charity, cooking, relaxation, music, busywork */
    type?: string;
    /** Teilnehmer-Anzahl */
    participants?: number;
    /** Max. Preis (0..1) */
    maxPrice?: number;
    /** Max. Schwierigkeit (0..1) */
    maxAccessibility?: number;
}

export const BoredQueryPact = createPact<BoredQuery>(
    "BoredQueryProvider",
    { fromSourceType: "BoredQuery" }
);
