/**
 * =========================================================================
 *  AIR QUALITY PACTS — eldritch accords with the breathing void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS-Koordinaten fuer die Luftqualitaetsabfrage */
export interface AirQualityQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
}

/** Der Pact fuer AirQuality-Queries */
export const AirQualityQueryPact = createPact<AirQualityQuery>(
    "AirQualityQueryProvider",
    { fromSourceType: "AirQualityQuery" }
);
