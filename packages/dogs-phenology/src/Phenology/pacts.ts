/**
 * =========================================================================
 *  PHENOLOGY PACTS — eldritch accords with the seasonal void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hound to the
 *  botanical calendar. GPS coordinates determine the hemisphere,
 *  and an optional date lets the hound peer into past or future seasons.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the phenology hunt */
export interface PhenologyQuery {
    /** Breitengrad (bestimmt Hemispaere) */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Optionales Datum im Format "YYYY-MM-DD" — default: heute */
    date?: string;
}

/** Der Pact fuer Phenology-Queries */
export const PhenologyQueryPact = createPact<PhenologyQuery>(
    "PhenologyQueryProvider",
    { fromSourceType: "PhenologyQuery" }
);
