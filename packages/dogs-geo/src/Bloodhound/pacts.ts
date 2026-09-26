/**
 * =========================================================================
 *  BLOODHOUND PACTS — eldritch accords sworn in the deep
 * =========================================================================
 *
 *  Geo-Felder folgen dem geo-pact: IMMER lat/lng (nie latitude/longitude/lon).
 *  Routen werden als Objekte modelliert: start/end (+ optional waypoints),
 *  niemals als getrennte startlat/startlng-Felder.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Movement profiles supported by OpenRouteService */
export enum BloodhoundProfile {
    FootWalking = "foot-walking",
    Hiking = "foot-hiking",
    DrivingCar = "driving-car",
    CyclingRegular = "cycling-regular",
    CyclingRoad = "cycling-road",
    CyclingMountain = "cycling-mountain",
    CyclingElectric = "cycling-electric",
    Wheelchair = "wheelchair",
}

/** The default profile when none is specified */
export const DEFAULT_BLOODHOUND_PROFILE = BloodhoundProfile.FootWalking;

/** Ein Geo-Punkt im Bloodhound-Pact (Strings, weil aus dem Querystring stammend) */
export interface BloodhoundPoint {
    /** Breitengrad in Dezimalgrad */
    lat: string;
    /** Laengengrad in Dezimalgrad */
    lng: string;
}

/** Query parameters for the BloodhoundRouteRetriever — start/end + optional waypoints */
export interface BloodhoundRouteQuery {
    /** Startpunkt der Route */
    start: BloodhoundPoint;
    /** Endpunkt der Route */
    end: BloodhoundPoint;
    /** Optionale Zwischenpunkte in Reihenfolge */
    waypoints?: BloodhoundPoint[];
    /** Bewegungsprofil (z. B. 'foot-walking') */
    profile?: string;
}

/** The coordinates and range fed to the isochrone abyss */
export interface BloodhoundIsochroneInput {
    /** Breitengrad des Mittelpunkts */
    lat: string;
    /** Laengengrad des Mittelpunkts */
    lng: string;
    /** Bewegungsprofil (z. B. 'foot-walking') */
    profile?: string;
    /** Reichweite in Sekunden */
    range: string;
}

/** Arr, the route query pact — an anchor binding retriever to its dark source */
export const BloodhoundRouteQueryPact = createPact<BloodhoundRouteQuery>(
    "BloodhoundQueryProvider",
    { fromSourceType: "BloodhoundRouteQuery" }
);

/** The isochrone pact — from brooding gulfs are we beheld, by that which bears no name */
export const BloodhoundIsochronePact = createPact<BloodhoundIsochroneInput>(
    "BloodhoundIsochroneProvider",
    { fromSourceType: "BloodhoundIsochroneInput" }
);
