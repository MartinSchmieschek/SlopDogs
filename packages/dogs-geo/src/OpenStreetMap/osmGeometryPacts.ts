/**
 * Pacts for OSM circle-based geometry queries — lat, lng, radius (meters) only.
 */

import { createPact } from "@slopdogs/core";

/** Query input for forest / area polygon geometry */
export interface OsmForestGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Landuse enum values — JSON array or string; defaults to forest */
    landuse?: string[] | string;
    /** Natural enum values — JSON array or string; defaults to wood */
    natural?: string[] | string;
}

export const OsmForestGeometryPact = createPact<OsmForestGeometryQueryInput>(
    "OsmForestGeometryQueryProvider",
    { fromSourceType: "OsmForestGeometryQueryInput" }
);

/** Query input for street line geometry */
export interface OsmStreetsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Highway enum values — JSON array or string */
    highway?: string[] | string;
    /** When set to `major_only`, expands to motorway/trunk/primary/secondary/tertiary */
    preset?: string;
}

export const OsmStreetsGeometryPact = createPact<OsmStreetsGeometryQueryInput>(
    "OsmStreetsGeometryQueryProvider",
    { fromSourceType: "OsmStreetsGeometryQueryInput" }
);

/** Query input for building polygons */
export interface OsmBuildingsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /**
     * Optional list of `building=*` values to restrict to (e.g. ["residential", "industrial"]).
     * Omit to fetch all buildings (any `building=*` tag).
     */
    building?: string[] | string;
}

export const OsmBuildingsGeometryPact = createPact<OsmBuildingsGeometryQueryInput>(
    "OsmBuildingsGeometryQueryProvider",
    { fromSourceType: "OsmBuildingsGeometryQueryInput" }
);

/** Query input for railway line geometry */
export interface OsmRailsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Railway enum values — JSON array or string; defaults to passenger transit */
    railway?: string[] | string;
}

export const OsmRailsGeometryPact = createPact<OsmRailsGeometryQueryInput>(
    "OsmRailsGeometryQueryProvider",
    { fromSourceType: "OsmRailsGeometryQueryInput" }
);

/**
 * Query input for landscape features — point trees, tree rows, walls/fences,
 * and vertical man-made structures (towers, masts). Caller picks subsets via
 * the four optional arrays; omit a field to take its default.
 */
export interface OsmLandscapeFeaturesQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `natural=tree | tree_row` (point + line vegetation, complements polygon vegetation) */
    nature?: string[] | string;
    /** `barrier=wall | fence | hedge | …` (linear obstructions) */
    barrier?: string[] | string;
    /** `man_made=tower | mast | chimney | silo | …` (vertical structures) */
    manMade?: string[] | string;
}

export const OsmLandscapeFeaturesPact = createPact<OsmLandscapeFeaturesQueryInput>(
    "OsmLandscapeFeaturesQueryProvider",
    { fromSourceType: "OsmLandscapeFeaturesQueryInput" }
);

/** Query input for water (polygons + waterways) */
export interface OsmWaterQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `natural=*` water-related values (water, bay, coastline, spring, …). */
    natural?: string[] | string;
    /** `waterway=*` line values (river, stream, canal, drain, ditch, riverbank). */
    waterway?: string[] | string;
}

export const OsmWaterPact = createPact<OsmWaterQueryInput>(
    "OsmWaterQueryProvider",
    { fromSourceType: "OsmWaterQueryInput" }
);

/** Query input for landuse polygons */
export interface OsmLanduseQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `landuse=*` enum values. Defaults to residential + commercial + industrial + retail. */
    landuse?: string[] | string;
}

export const OsmLandusePact = createPact<OsmLanduseQueryInput>(
    "OsmLanduseQueryProvider",
    { fromSourceType: "OsmLanduseQueryInput" }
);

/** Query input for broad amenity POIs */
export interface OsmAmenitiesQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /**
     * `amenity=*` values. Defaults to a curated everyday-life set; pass `'all'` for any
     * amenity, an array of values, a single value, or any **custom OSM string** outside
     * the curated enum (long-tail tags like `'waste_transfer_station'`).
     */
    amenity?: string[] | string;
}

export const OsmAmenitiesPact = createPact<OsmAmenitiesQueryInput>(
    "OsmAmenitiesQueryProvider",
    { fromSourceType: "OsmAmenitiesQueryInput" }
);

/** Query input for administrative + protected-area boundaries */
export interface OsmBoundariesQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `boundary=*` enum values (administrative, protected_area, national_park, …). */
    boundary?: string[] | string;
    /** `admin_level` filter as JSON array or single value (e.g. [4,6,8]); only applies to administrative. */
    adminLevel?: string[] | string;
}

export const OsmBoundariesPact = createPact<OsmBoundariesQueryInput>(
    "OsmBoundariesQueryProvider",
    { fromSourceType: "OsmBoundariesQueryInput" }
);

/** Query input for power-grid infrastructure */
export interface OsmPowerQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `power=*` enum values (line/cable/tower/pole/substation/plant/generator). */
    power?: string[] | string;
}

export const OsmPowerPact = createPact<OsmPowerQueryInput>(
    "OsmPowerQueryProvider",
    { fromSourceType: "OsmPowerQueryInput" }
);

/** Query input for public-transit stop points / platforms */
export interface OsmPublicTransitStopsQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /**
     * Transit kinds to fetch. Default fetches `bus`, `tram`, `subway`, `train`, `bus_station`.
     * Possible values: `bus`, `tram`, `subway`, `train`, `light_rail`, `monorail`, `ferry`,
     * `bus_station`, `aerialway`, `taxi`.
     */
    kinds?: string[] | string;
}

export const OsmPublicTransitStopsPact = createPact<OsmPublicTransitStopsQueryInput>(
    "OsmPublicTransitStopsQueryProvider",
    { fromSourceType: "OsmPublicTransitStopsQueryInput" }
);

/** Query input for shops */
export interface OsmShopsQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /**
     * `shop=*` values. Pass `'all'` (default) for any shop=*.
     * Or restrict via e.g. `['supermarket','bakery','clothes']`.
     */
    shop?: string[] | string;
}

export const OsmShopsPact = createPact<OsmShopsQueryInput>(
    "OsmShopsQueryProvider",
    { fromSourceType: "OsmShopsQueryInput" }
);

/** Query input for sports & recreation features */
export interface OsmSportsRecreationQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `leisure=*` values (sports_centre, pitch, track, swimming_pool, golf_course, fitness_centre, stadium, …). */
    leisure?: string[] | string;
    /** Optional filter on `sport=*` tag (football, tennis, swimming, …). */
    sport?: string[] | string;
}

export const OsmSportsRecreationPact = createPact<OsmSportsRecreationQueryInput>(
    "OsmSportsRecreationQueryProvider",
    { fromSourceType: "OsmSportsRecreationQueryInput" }
);
