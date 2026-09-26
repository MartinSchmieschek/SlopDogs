/**
 * =========================================================================
 *  WEBCAM PACTS — eldritch accords with the surveillance void
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hound to the
 *  Windy abyss. GPS coordinates anchor us to the mortal plane,
 *  and optional limits narrow the hunt.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query parameters for the webcam hunt */
export interface WebcamQuery {
    /** Breitengrad */
    lat: string;
    /** Laengengrad */
    lng: string;
    /** Suchradius in km (default: 50) */
    radius?: string;
    /** Maximale Anzahl Webcams (default: 10) */
    limit?: string;
}

/** Der Pact fuer Webcam-Queries */
export const WebcamQueryPact = createPact<WebcamQuery>(
    "WebcamQueryProvider",
    { fromSourceType: "WebcamQuery" }
);
