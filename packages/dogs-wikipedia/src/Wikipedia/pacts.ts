/**
 * =========================================================================
 *  WIKIPEDIA PACTS — eldritch accords with the encyclopaedic void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS-Koordinaten und Optionen fuer die Wikipedia-Nearby-Suche */
export interface WikiNearbyQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Suchradius in Metern (default: 500, max: 10000) */
    radius?: string;
    /** Max. Anzahl Ergebnisse (default: 10, max: 50) */
    limit?: string;
    /** Wikipedia-Sprache (default: "de") */
    lang?: string;
}

/** Der Pact fuer Wikipedia-Nearby-Queries */
export const WikiNearbyQueryPact = createPact<WikiNearbyQuery>(
    "WikiNearbyQueryProvider",
    { fromSourceType: "WikiNearbyQuery" }
);
