/**
 * =========================================================================
 *  BIODIVERSITY PACTS — eldritch accords with the naturalist void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hound to the
 *  iNaturalist abyss. GPS coordinates anchor us to the mortal plane,
 *  and optional filters narrow the hunt to specific taxa or seasons.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the biodiversity hunt */
export interface BiodiversityQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Suchradius in km (default: 10) */
    radius?: string;
    /** Taxon-Filter: "Aves", "Mammalia", "Plantae", "Insecta", "Fungi", etc. */
    taxon?: string;
    /** Monate als Komma-Liste (1-12), z.B. "3,4,5" fuer Fruehling */
    months?: string;
}

/** Der Pact fuer Biodiversity-Queries */
export const BiodiversityQueryPact = createPact<BiodiversityQuery>(
    "BiodiversityQueryProvider",
    { fromSourceType: "BiodiversityQuery" }
);
