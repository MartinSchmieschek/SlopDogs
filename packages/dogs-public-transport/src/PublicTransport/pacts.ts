/**
 * =========================================================================
 *  PUBLIC TRANSPORT PACTS — eldritch accords with the transit network
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our hounds to the
 *  public transit network. Through endless rails and roads,
 *  countless stations, a multitude unfolds — from brooding platforms
 *  are we beheld, by that which bears no name.
 *
 *  The GPS coordinates anchor us to the mortal plane,
 *  while buses, trams, and trains thunder through the void.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS-Koordinaten fuer die Suche nach nahegelegenen Haltestellen */
export interface PublicTransportQuery {
    /** Breitengrad — the latitude where the hound sniffs for stations in the void */
    lat: string;
    /** Laengengrad — the longitude from which transit vehicles are summoned */
    lng: string;
    /** Suchradius in Metern (default: 1000) — how far the hound dares venture from the anchor */
    radius?: string;
    /** Max. Anzahl Ergebnisse (default: 8) — how many stations the void shall reveal */
    results?: string;
}

/** Arr, the GPS query pact — an anchor binding the hound to its earthly coordinates */
export const PublicTransportQueryPact = createPact<PublicTransportQuery>(
    "PublicTransportQueryProvider",
    { fromSourceType: "PublicTransportQuery" }
);
