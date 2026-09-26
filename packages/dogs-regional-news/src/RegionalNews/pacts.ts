/**
 * =========================================================================
 *  REGIONAL NEWS PACTS — eldritch accords with the information void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hound to the
 *  RSS abyss. A query string anchors us to a region,
 *  and optional custom feed URLs let the hound widen its hunt.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the regional news hunt */
export interface RegionalNewsQuery {
    /** Stadt- oder Regionsname fuer die Google News Suche (z.B. "Stuttgart") */
    query: string;
    /** Optionale komma-separierte RSS-Feed-URLs fuer zusaetzliche Quellen */
    feedUrls?: string;
    /** Maximale Anzahl Ergebnisse (default: 20) */
    limit?: string;
}

/** Der Pact fuer RegionalNews-Queries */
export const RegionalNewsQueryPact = createPact<RegionalNewsQuery>(
    "RegionalNewsQueryProvider",
    { fromSourceType: "RegionalNewsQuery" }
);
