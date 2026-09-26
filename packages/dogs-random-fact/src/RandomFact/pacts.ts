/**
 * =========================================================================
 *  RANDOM FACT PACTS — eldritch accords with the knowledge-void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Optionale Sprache fuer die Fun-Fact-Abfrage */
export interface RandomFactQuery {
    /** Sprache: "en" oder "de" — default: "en" */
    lang?: string;
}

/** Der Pact fuer RandomFact-Queries */
export const RandomFactQueryPact = createPact<RandomFactQuery>(
    "RandomFactQueryProvider",
    { fromSourceType: "RandomFactQuery" }
);
