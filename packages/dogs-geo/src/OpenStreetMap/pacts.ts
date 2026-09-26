/**
 * =========================================================================
 *  OSM PACTS — eldritch contracts with the cartographic void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";
import type { LandmarksOverpassFacet } from "./overpassLandmarks";
import type { TracksOverpassFacet } from "./overpassTracks";
import type { VegetationOverpassFacet } from "./overpassVegetation";
import type { FastRoadsOverpassFacet } from "./overpassFastRoads";

export {
    DEFAULT_LANDMARKS_FACETS,
    ALL_LANDMARKS_OVERPASS_FACETS,
    LandmarksOverpassFacet,
    LandmarksPreset,
    OsmLandmarkElementType,
} from "./overpassLandmarks";

export { TracksOverpassFacet, DEFAULT_TRACKS_FACETS, ALL_TRACKS_OVERPASS_FACETS } from "./overpassTracks";

export {
    VegetationOverpassFacet,
    DEFAULT_VEGETATION_FACETS,
    ALL_VEGETATION_OVERPASS_FACETS,
} from "./overpassVegetation";

export {
    FastRoadsOverpassFacet,
    DEFAULT_FAST_ROADS_FACETS,
    ALL_FAST_ROADS_OVERPASS_FACETS,
} from "./overpassFastRoads";

/**
 * Required query input for OsmLandmarksRetriever — the coordinates and
 * parameters we must whisper to the void (lowercase keys from QueryRetriever/Mimic).
 */
export interface OsmLandmarksQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Facets to query; omit for Tourism + Historic. Use preset string `"full"` for all landmark facets. */
    preset?: LandmarksOverpassFacet[];
}

/** Query input for OsmTracksRetriever — same shape, different pact + facet enum */
export interface OsmTracksQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    preset?: TracksOverpassFacet[];
}

/** Query input for OsmVegetationRetriever */
export interface OsmVegetationQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    preset?: VegetationOverpassFacet[];
}

/** Query input for OsmFastRoadsRetriever */
export interface OsmFastRoadsQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    preset?: FastRoadsOverpassFacet[];
}

/** @deprecated use OsmLandmarksQueryInput */
export type NearbyLandmarksQuery = OsmLandmarksQueryInput;

export const NearbyLandmarksPact = createPact<OsmLandmarksQueryInput>("NearbyLandmarksQueryProvider", {
    fromSourceType: "OsmLandmarksQueryInput",
});

export const NearbyTracksPact = createPact<OsmTracksQueryInput>("NearbyTracksQueryProvider", {
    fromSourceType: "OsmTracksQueryInput",
});

export const NearbyVegetationPact = createPact<OsmVegetationQueryInput>("NearbyVegetationQueryProvider", {
    fromSourceType: "OsmVegetationQueryInput",
});

export const NearbyFastRoadsPact = createPact<OsmFastRoadsQueryInput>("NearbyFastRoadsQueryProvider", {
    fromSourceType: "OsmFastRoadsQueryInput",
});
