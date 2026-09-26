/**
 * =========================================================================
 *  TRANSIT TRIP PACTS — eldritch accords with the railway void
 * =========================================================================
 *
 *  Arr, GPS coordinates anchor us to the mortal plane — from there
 *  the hound finds all nearby stations, fetches their departures,
 *  and dredges the full route for every line in the area.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the transit trip hunt */
export interface TransitTripQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Suchradius in Metern fuer Stationen (default: 1000) */
    radius?: string;
    /** Max. Anzahl Stationen die abgefragt werden (default: 5) */
    stations?: string;
    /** Optionaler Linien-Filter (z.B. "U4", "S1", "Bus 36") */
    line?: string;
    /** Max. Anzahl Trips pro Station (default: 10) */
    limit?: string;
}

/** Der Pact fuer TransitTrip-Queries */
export const TransitTripQueryPact = createPact<TransitTripQuery>(
    "TransitTripQueryProvider",
    { fromSourceType: "TransitTripQuery" }
);
