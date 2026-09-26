/**
 * =========================================================================
 *  SEASON PACTS — eldritch accords with the temporal void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Breitengrad und optionales Datum fuer die Jahreszeitenabfrage */
export interface SeasonQuery {
    /** Breitengrad — bestimmt die Hemispaehre */
    lat: string;
    /** Optionales Datum im Format "YYYY-MM-DD" — default: heute */
    date?: string;
}

/** Der Pact fuer Season-Queries */
export const SeasonQueryPact = createPact<SeasonQuery>(
    "SeasonQueryProvider",
    { fromSourceType: "SeasonQuery" }
);
