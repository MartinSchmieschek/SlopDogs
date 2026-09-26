/**
 * Overpass: landcover / vegetation polygons and sites near a point (natural=*, landuse=forest, leisure=park, …).
 */

import type { FeatureCollection, GeometryObject } from "geojson";
import {
    clampOsmRadiusM,
    DEFAULT_OSM_RADIUS_M,
    fetchOverpassElements,
    MAX_OSM_RADIUS_M,
    overpassSettingsHeader,
    type OsmGeoElement,
} from "./overpassOsmShared";

export const DEFAULT_VEGETATION_RADIUS_M = DEFAULT_OSM_RADIUS_M;
export const MAX_VEGETATION_RADIUS_M = MAX_OSM_RADIUS_M;

export enum VegetationOverpassFacet {
    Wood = "wood",
    Forest = "forest",
    Scrub = "scrub",
    Grassland = "grassland",
    Meadow = "meadow",
    Heath = "heath",
    Wetland = "wetland",
    Orchard = "orchard",
    Vineyard = "vineyard",
    Park = "park",
}

export const DEFAULT_VEGETATION_FACETS: readonly VegetationOverpassFacet[] = [
    VegetationOverpassFacet.Wood,
    VegetationOverpassFacet.Forest,
    VegetationOverpassFacet.Scrub,
];

export const ALL_VEGETATION_OVERPASS_FACETS: readonly VegetationOverpassFacet[] = [
    VegetationOverpassFacet.Wood,
    VegetationOverpassFacet.Forest,
    VegetationOverpassFacet.Scrub,
    VegetationOverpassFacet.Grassland,
    VegetationOverpassFacet.Meadow,
    VegetationOverpassFacet.Heath,
    VegetationOverpassFacet.Wetland,
    VegetationOverpassFacet.Orchard,
    VegetationOverpassFacet.Vineyard,
    VegetationOverpassFacet.Park,
];

export interface OsmVegetationResult {
    center: { lat: number; lng: number };
    radiusM: number;
    preset: VegetationOverpassFacet[];
    /** Centerpoint pro Element — fuer Liste/Marker-Renderer. */
    elements: OsmGeoElement[];
    /** Volle Polygon-Geometrie als GeoJSON — fuer Karten-Renderer. */
    geojson: FeatureCollection<GeometryObject>;
}

type LineGen = (r: number, lat: number, lng: number) => string;

const OVERPASS_LINE_BY_FACET: Record<VegetationOverpassFacet, LineGen> = {
    [VegetationOverpassFacet.Wood]: (r, lat, lng) =>
        `  nwr["natural"="wood"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Forest]: (r, lat, lng) =>
        `  nwr["landuse"="forest"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Scrub]: (r, lat, lng) =>
        `  nwr["natural"="scrub"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Grassland]: (r, lat, lng) =>
        `  nwr["natural"="grassland"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Meadow]: (r, lat, lng) =>
        `  nwr["landuse"="meadow"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Heath]: (r, lat, lng) =>
        `  nwr["natural"="heath"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Wetland]: (r, lat, lng) =>
        `  nwr["natural"="wetland"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Orchard]: (r, lat, lng) =>
        `  nwr["landuse"="orchard"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Vineyard]: (r, lat, lng) =>
        `  nwr["landuse"="vineyard"](around:${r},${lat},${lng});`,
    [VegetationOverpassFacet.Park]: (r, lat, lng) =>
        `  nwr["leisure"="park"](around:${r},${lat},${lng});`,
};

function dedupeFacets(facets: VegetationOverpassFacet[]): VegetationOverpassFacet[] {
    const seen = new Set<VegetationOverpassFacet>();
    const out: VegetationOverpassFacet[] = [];
    for (const f of facets) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
    }
    return out;
}

function coerceFacet(raw: unknown): VegetationOverpassFacet | null {
    if (typeof raw !== "string") {
        const vals = Object.values(VegetationOverpassFacet) as VegetationOverpassFacet[];
        return vals.includes(raw as VegetationOverpassFacet) ? (raw as VegetationOverpassFacet) : null;
    }
    const v = raw.toLowerCase();
    for (const facet of Object.values(VegetationOverpassFacet) as VegetationOverpassFacet[]) {
        if (facet === v) return facet;
    }
    return null;
}

export function parseVegetationFacets(raw: unknown): VegetationOverpassFacet[] {
    const base = [...DEFAULT_VEGETATION_FACETS];
    if (raw == null) return base;
    if (Array.isArray(raw)) {
        const mapped: VegetationOverpassFacet[] = [];
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
            return dedupeFacets([...ALL_VEGETATION_OVERPASS_FACETS]);
        }
        const one = coerceFacet(raw);
        return one != null ? [one] : base;
    }
    const single = coerceFacet(raw);
    return single != null ? [single] : base;
}

export function buildVegetationOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    facets: VegetationOverpassFacet[]
): string {
    const r = radiusM;
    const list = facets.length ? dedupeFacets(facets) : [...DEFAULT_VEGETATION_FACETS];
    const lines = list.map((f) => OVERPASS_LINE_BY_FACET[f](r, lat, lng));
    return `${overpassSettingsHeader()}
(
${lines.join("\n")}
);
out center;`;
}

export function clampVegetationRadiusM(parsed: number): number {
    return clampOsmRadiusM(parsed, DEFAULT_OSM_RADIUS_M, MAX_OSM_RADIUS_M);
}

export async function fetchNearbyVegetation(
    lat: number,
    lng: number,
    radiusM: number,
    facets: VegetationOverpassFacet[]
): Promise<OsmVegetationResult> {
    const normalized = facets.length ? dedupeFacets(facets) : [...DEFAULT_VEGETATION_FACETS];
    const query = buildVegetationOverpassQuery(lat, lng, radiusM, normalized);
    const elements = await fetchOverpassElements(query, "OsmVegetationRetriever");
    return {
        center: { lat, lng },
        radiusM,
        preset: normalized,
        elements,
        geojson: { type: "FeatureCollection", features: [] },
    };
}
