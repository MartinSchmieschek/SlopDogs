/**
 * =========================================================================
 *  SUN PACTS — eldritch accords with the celestial void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS-Koordinaten fuer die Sonnenabfrage */
export interface SunQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Anzahl Vorhersage-Tage (default: 7, max: 16) */
    days?: string;
}

/** Der Pact fuer Sun-Queries */
export const SunQueryPact = createPact<SunQuery>(
    "SunQueryProvider",
    { fromSourceType: "SunQuery" }
);
