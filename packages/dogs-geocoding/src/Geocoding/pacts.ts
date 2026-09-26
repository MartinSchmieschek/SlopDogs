/**
 * =========================================================================
 *  GEOCODING PACTS — eldritch accords with the map-void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/**
 * Query fuer Geocoding — entweder Adresse ODER lat/lng.
 * Wenn `address` gesetzt ist: Forward-Geocoding (Adresse -> GPS).
 * Wenn `lat`+`lng` gesetzt sind: Reverse-Geocoding (GPS -> Adresse).
 * Wenn beides gesetzt: Forward hat Vorrang.
 */
export interface GeocodingQuery {
    /** Adresse / Ortsname fuer Forward-Geocoding */
    address?: string;
    /** Breitengrad fuer Reverse-Geocoding */
    lat?: string;
    /** Laengengrad fuer Reverse-Geocoding */
    lng?: string;
    /** Max. Anzahl Ergebnisse bei Forward (default: 5) */
    limit?: string;
}

/** Der Pact fuer Geocoding-Queries */
export const GeocodingQueryPact = createPact<GeocodingQuery>(
    "GeocodingQueryProvider",
    { fromSourceType: "GeocodingQuery" }
);
