/**
 * =========================================================================
 *  INDEX OF THE ABYSS — dogs-geo barrel export
 * =========================================================================
 *
 *  Arr, matey! From brooding gulfs are we beheld, by that which bears
 *  no name. This here barrel file be the anchor of our vessel, bindin'
 *  together the cursed modules that dare chart routes across the deep.
 *
 *  Alle Geo-Hunde leben jetzt in einem Paket. OSM-POI-Dogs teilen sich
 *  die `OsmFeatureRetriever`-Basis unter `./osm/base`, die den kompletten
 *  Cache-/Fetch-/Area-Cache-Tanz uebernimmt.
 * =========================================================================
 */

// Bloodhound — ORS Routing & Isochrones
export * from './Bloodhound/BloodhoundRouteRetriever';
export * from './Bloodhound/BloodhoundIsochroneRetriever';
export * from './Bloodhound/pacts';

// OpenStreetMap geometric retrievers (Landmarks, Tracks, Vegetation, FastRoads, …)
export * from './OpenStreetMap/overpassOsmShared';
export * from './OpenStreetMap/OsmLandmarksRetriever';
export * from './OpenStreetMap/OsmTracksRetriever';
export * from './OpenStreetMap/OsmVegetationRetriever';
export * from './OpenStreetMap/OsmFastRoadsRetriever';
export * from './OpenStreetMap/OsmBuildingsRetriever';
export * from './OpenStreetMap/OsmRailsRetriever';
export * from './OpenStreetMap/OsmLandscapeFeaturesRetriever';
export * from './OpenStreetMap/OsmWaterRetriever';
export * from './OpenStreetMap/OsmLanduseRetriever';
export * from './OpenStreetMap/OsmAmenitiesRetriever';
export * from './OpenStreetMap/OsmBoundariesRetriever';
export * from './OpenStreetMap/OsmPowerRetriever';
export * from './OpenStreetMap/OsmPublicTransitStopsRetriever';
export * from './OpenStreetMap/OsmShopsRetriever';
export * from './OpenStreetMap/OsmSportsRecreationRetriever';
export * from './OpenStreetMap/osmGeometryEnums';
export * from './OpenStreetMap/osmGeometryPacts';
export * from './OpenStreetMap/osmGeometryHelpers';
export * from './OpenStreetMap/pacts';
export * from './OpenStreetMap/overpassLandmarks';
export * from './OpenStreetMap/overpassTracks';
export * from './OpenStreetMap/overpassVegetation';
export * from './OpenStreetMap/overpassFastRoads';

// Shared OSM feature base (for future retrievers)
export { OsmFeatureRetriever } from './osm/base/OsmFeatureRetriever';
export type { OsmQueryBase, OsmBaseResult } from './osm/base/OsmFeatureRetriever';
export {
    fetchOverpassElementsWithFallback,
    getOverpassUrlChain,
    overpassSettingsHeader,
    overpassElementRepresentativePoint,
    type OverpassRawElement,
} from './osm/base/overpassMirrorChain';

// Migrated OSM POI retrievers (formerly standalone packages)
export * from './osm/DrinkingWater/DrinkingWaterRetriever';
export * from './osm/DrinkingWater/pacts';
export * from './osm/Food/OpenFoodRetriever';
export * from './osm/Food/pacts';
export * from './osm/Noise/NoiseRetriever';
export * from './osm/Noise/pacts';
export * from './osm/Playground/PlaygroundRetriever';
export * from './osm/Playground/pacts';
export * from './osm/Parking/ParkingRetriever';
export * from './osm/Parking/pacts';
export * from './osm/Trail/TrailRetriever';
export * from './osm/Trail/pacts';
