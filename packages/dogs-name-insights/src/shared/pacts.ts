import { createPact } from "@slopdogs/core";

/**
 * Gemeinsamer Name-Query-Pact fuer alle Name-Insight-Hunde.
 * Agify, Nationalize und Genderize teilen sich diesen Vertrag.
 */
export interface NameQuery {
    /** Vorname (einzelnes Wort; API verarbeitet nur den ersten Namen) */
    name: string;
    /** Optional: ISO-2 country code (z.B. "DE") — verbessert die Vorhersage */
    country?: string;
}

export const NameQueryPact = createPact<NameQuery>(
    "NameQueryProvider",
    { fromSourceType: "NameQuery" }
);
