/**
 * =========================================================================
 *  BIRD PACTS — eldritch accords with the ornithological void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our avian hound to the
 *  eBird abyss. GPS coordinates anchor us to the mortal plane,
 *  and optional filters narrow the hunt.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the bird observation hunt */
export interface BirdQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Suchradius in km (default: 25) */
    radius?: string;
    /** Tage zurueck (default: 14) */
    back?: string;
}

/** Der Pact fuer Bird-Queries */
export const BirdQueryPact = createPact<BirdQuery>(
    "BirdQueryProvider",
    { fromSourceType: "BirdQuery" }
);
