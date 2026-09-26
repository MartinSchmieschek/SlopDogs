/**
 * Overpass: high-speed / major carriageways (motorway, trunk, primary, …) near a point.
 */

import {
    clampOsmRadiusM,
    DEFAULT_OSM_RADIUS_M,
    fetchOverpassElements,
    MAX_OSM_RADIUS_M,
    overpassSettingsHeader,
    type OsmGeoElement,
} from "./overpassOsmShared";

export const DEFAULT_FAST_ROADS_RADIUS_M = DEFAULT_OSM_RADIUS_M;
export const MAX_FAST_ROADS_RADIUS_M = MAX_OSM_RADIUS_M;

/** OSM highway=* values for fast / major roads */
export enum FastRoadsOverpassFacet {
    Motorway = "motorway",
    MotorwayLink = "motorway_link",
    Trunk = "trunk",
    TrunkLink = "trunk_link",
    Primary = "primary",
    Secondary = "secondary",
}

/** Default: Autobahn-äquivalent + Schnellstraßen (ohne jede innerörtliche primary) */
export const DEFAULT_FAST_ROADS_FACETS: readonly FastRoadsOverpassFacet[] = [
    FastRoadsOverpassFacet.Motorway,
    FastRoadsOverpassFacet.Trunk,
];

export const ALL_FAST_ROADS_OVERPASS_FACETS: readonly FastRoadsOverpassFacet[] = [
    FastRoadsOverpassFacet.Motorway,
    FastRoadsOverpassFacet.MotorwayLink,
    FastRoadsOverpassFacet.Trunk,
    FastRoadsOverpassFacet.TrunkLink,
    FastRoadsOverpassFacet.Primary,
    FastRoadsOverpassFacet.Secondary,
];

export interface OsmFastRoadsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    preset: FastRoadsOverpassFacet[];
    elements: OsmGeoElement[];
}

const HIGHWAY_BY_FACET: Record<FastRoadsOverpassFacet, string> = {
    [FastRoadsOverpassFacet.Motorway]: "motorway",
    [FastRoadsOverpassFacet.MotorwayLink]: "motorway_link",
    [FastRoadsOverpassFacet.Trunk]: "trunk",
    [FastRoadsOverpassFacet.TrunkLink]: "trunk_link",
    [FastRoadsOverpassFacet.Primary]: "primary",
    [FastRoadsOverpassFacet.Secondary]: "secondary",
};

function lineForFacet(f: FastRoadsOverpassFacet, r: number, lat: number, lng: number): string {
    const h = HIGHWAY_BY_FACET[f];
    return `  way["highway"="${h}"](around:${r},${lat},${lng});`;
}

function dedupeFacets(facets: FastRoadsOverpassFacet[]): FastRoadsOverpassFacet[] {
    const seen = new Set<FastRoadsOverpassFacet>();
    const out: FastRoadsOverpassFacet[] = [];
    for (const f of facets) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
    }
    return out;
}

function coerceFacet(raw: unknown): FastRoadsOverpassFacet | null {
    if (typeof raw !== "string") {
        const vals = Object.values(FastRoadsOverpassFacet) as FastRoadsOverpassFacet[];
        return vals.includes(raw as FastRoadsOverpassFacet) ? (raw as FastRoadsOverpassFacet) : null;
    }
    const v = raw.toLowerCase();
    for (const facet of Object.values(FastRoadsOverpassFacet) as FastRoadsOverpassFacet[]) {
        if (facet === v) return facet;
    }
    return null;
}

export function parseFastRoadsFacets(raw: unknown): FastRoadsOverpassFacet[] {
    const base = [...DEFAULT_FAST_ROADS_FACETS];
    if (raw == null) return base;
    if (Array.isArray(raw)) {
        const mapped: FastRoadsOverpassFacet[] = [];
        for (const item of raw) {
            const f = coerceFacet(item);
            if (f != null) mapped.push(f);
        }
        return mapped.length ? dedupeFacets(mapped) : base;
    }
    if (typeof raw === "string") {
        const v = raw.toLowerCase();
        if (v === "" || v === "default") return base;
        if (v === "full") {
            return dedupeFacets([...ALL_FAST_ROADS_OVERPASS_FACETS]);
        }
        const one = coerceFacet(raw);
        return one != null ? [one] : base;
    }
    const single = coerceFacet(raw);
    return single != null ? [single] : base;
}

export function buildFastRoadsOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    facets: FastRoadsOverpassFacet[]
): string {
    const r = radiusM;
    const list = facets.length ? dedupeFacets(facets) : [...DEFAULT_FAST_ROADS_FACETS];
    const lines = list.map((f) => lineForFacet(f, r, lat, lng));
    return `${overpassSettingsHeader()}
(
${lines.join("\n")}
);
out center;`;
}

export function clampFastRoadsRadiusM(parsed: number): number {
    return clampOsmRadiusM(parsed, DEFAULT_OSM_RADIUS_M, MAX_OSM_RADIUS_M);
}

export async function fetchNearbyFastRoads(
    lat: number,
    lng: number,
    radiusM: number,
    facets: FastRoadsOverpassFacet[]
): Promise<OsmFastRoadsResult> {
    const normalized = facets.length ? dedupeFacets(facets) : [...DEFAULT_FAST_ROADS_FACETS];
    const query = buildFastRoadsOverpassQuery(lat, lng, radiusM, normalized);
    const elements = await fetchOverpassElements(query, "OsmFastRoadsRetriever");
    return {
        center: { lat, lng },
        radiusM,
        preset: normalized,
        elements,
    };
}
