/**
 * =========================================================================
 *  BLOODHOUND TYPES — the shapes that lurk in the abyss
 * =========================================================================
 *
 *  Geo-Felder folgen dem geo-pact: lat/lng-Objekte, niemals [lat,lng]-Tuples.
 * =========================================================================
 */

import type { GeoPoint } from "@slopdogs/geo-pact";

/**
 * Arr, a single step upon the route — safe for JSON.stringify, free of
 * circular graph-horrors that would drive a crew to madness.
 */
export interface TravelStepJson {
    /** Startpunkt dieses Schritts */
    startPoint: GeoPoint;
    /** Endpunkt dieses Schritts */
    endPoint: GeoPoint;
    /** Distance plundered in kilometers — how far the crew sailed through the deep */
    lengthInKm: number;
    /** Minutes lost to the void, arr — time consumed by this leg of the voyage */
    travelDurationInMinutes: number;
    /** The navigation instruction — whispered directions from brooding gulfs beyond */
    instruction: string;
}

/** A segment of the voyage — distance plundered and time lost to the void */
export interface RouteSegment {
    /** Arr, cumulative kilometers traversed — the total distance plundered from the void so far */
    traveldKm: number;
    /** Cumulative minutes elapsed, matey — time swallowed by the eldritch deep */
    time: number;
    /** Wegpunkte dieses Segments */
    points: GeoPoint[];
}

/** The full plunder of a route retrieval from the deep */
export interface BloodhoundRouteResult {
    /** Komplette Route-Geometrie als lat/lng-Punkte */
    coordinates: GeoPoint[];
    /** Cumulative route segments, matey — each one a deeper descent into the abyss */
    segments: RouteSegment[];
    /** The individual travel steps — eldritch instructions from the deep, JSON-safe and fearsome */
    travelSteps: TravelStepJson[];
}

/** The eldritch yield of an isochrone query — boundaries of the reachable abyss */
export interface BloodhoundIsochroneResult {
    /** Arr, the parsed isochrone features — boundaries of the reachable deep */
    features: IsochroneFeatureResult[];
    /** The raw response from the void, matey — unprocessed eldritch data for those who dare gaze upon it */
    raw: unknown;
}

/** A single isochrone feature — the void's boundary made manifest, matey */
export interface IsochroneFeatureResult {
    /** Polygon-Wegpunkte der Isochrone */
    coordinates: GeoPoint[];
    /** The isochrone value in seconds — how deep into the abyss this boundary extends */
    value: number;
    /** Mittelpunkt der Isochrone */
    center: GeoPoint;
}
