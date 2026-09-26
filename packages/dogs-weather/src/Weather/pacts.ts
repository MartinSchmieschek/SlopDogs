/**
 * =========================================================================
 *  WEATHER PACTS — eldritch accords with the atmospheric void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hounds to the
 *  sky above. GPS coordinates anchor us to the mortal plane,
 *  and an optional time lets the hound peer into the future
 *  or the recent past of the atmosphere's moods.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS-Koordinaten und optionale Uhrzeit fuer die Wetterabfrage */
export interface WeatherQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Optionale Uhrzeit im Format "HH:mm" oder ISO-8601 — zeigt Vorhersage fuer diese Stunde */
    time?: string;
    /** Optionales Datum im Format "YYYY-MM-DD" — default: heute */
    date?: string;
}

/** Der Pact fuer Wetter-Queries */
export const WeatherQueryPact = createPact<WeatherQuery>(
    "WeatherQueryProvider",
    { fromSourceType: "WeatherQuery" }
);
