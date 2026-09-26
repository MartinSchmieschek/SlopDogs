/**
 * =========================================================================
 *  OVERPASS LANDMARKS — the eldritch cartography of OpenStreetMap
 * =========================================================================
 */

import {
    clampOsmRadiusM,
    DEFAULT_OSM_RADIUS_M,
    fetchOverpassElements,
    MAX_OSM_RADIUS_M,
    overpassSettingsHeader,
    type OsmGeoElement,
    OsmGeoElementType,
} from "./overpassOsmShared";

/** @deprecated use DEFAULT_OSM_RADIUS_M from overpassOsmShared */
export const DEFAULT_LANDMARK_RADIUS_M = DEFAULT_OSM_RADIUS_M;
/** @deprecated use MAX_OSM_RADIUS_M from overpassOsmShared */
export const MAX_LANDMARK_RADIUS_M = MAX_OSM_RADIUS_M;

export { OsmGeoElementType as OsmLandmarkElementType };
export type OsmLandmarkElement = OsmGeoElement;

/**
 * OSM facets for the Overpass query — POI-style features (no highway=maxspeed, no generic landcover).
 */
export enum LandmarksOverpassFacet {
    Tourism = "tourism",
    Historic = "historic",
    Museum = "museum",
    Peak = "peak",
    Cemetery = "cemetery",
    Bridge = "bridge",
    Waterfall = "waterfall",
    Spring = "spring",
    Cave = "cave",
    Beach = "beach",
    Fountain = "fountain",
    PlaceOfWorship = "place_of_worship",
    Library = "library",
    Theatre = "theatre",
    Memorial = "memorial",
    Castle = "castle",
    Ruins = "ruins",
    ArchaeologicalSite = "archaeological_site",
    Battlefield = "battlefield",
    Monument = "monument",
    Windmill = "windmill",
    Lighthouse = "lighthouse",
    Dam = "dam",
    Zoo = "zoo",
    PicnicSite = "picnic_site",
    Artwork = "artwork",
    Viewpoint = "viewpoint",
    Information = "information",
    Military = "military",
}

export const DEFAULT_LANDMARKS_FACETS: readonly LandmarksOverpassFacet[] = [
    LandmarksOverpassFacet.Tourism,
    LandmarksOverpassFacet.Historic,
];

/** Every landmark facet — use preset string `"full"` or pass this list as `preset` */
export const ALL_LANDMARKS_OVERPASS_FACETS: readonly LandmarksOverpassFacet[] = [
    LandmarksOverpassFacet.Tourism,
    LandmarksOverpassFacet.Historic,
    LandmarksOverpassFacet.Museum,
    LandmarksOverpassFacet.Peak,
    LandmarksOverpassFacet.Cemetery,
    LandmarksOverpassFacet.Bridge,
    LandmarksOverpassFacet.Waterfall,
    LandmarksOverpassFacet.Spring,
    LandmarksOverpassFacet.Cave,
    LandmarksOverpassFacet.Beach,
    LandmarksOverpassFacet.Fountain,
    LandmarksOverpassFacet.PlaceOfWorship,
    LandmarksOverpassFacet.Library,
    LandmarksOverpassFacet.Theatre,
    LandmarksOverpassFacet.Memorial,
    LandmarksOverpassFacet.Castle,
    LandmarksOverpassFacet.Ruins,
    LandmarksOverpassFacet.ArchaeologicalSite,
    LandmarksOverpassFacet.Battlefield,
    LandmarksOverpassFacet.Monument,
    LandmarksOverpassFacet.Windmill,
    LandmarksOverpassFacet.Lighthouse,
    LandmarksOverpassFacet.Dam,
    LandmarksOverpassFacet.Zoo,
    LandmarksOverpassFacet.PicnicSite,
    LandmarksOverpassFacet.Artwork,
    LandmarksOverpassFacet.Viewpoint,
    LandmarksOverpassFacet.Information,
    LandmarksOverpassFacet.Military,
];

/** @deprecated use LandmarksOverpassFacet */
export type LandmarksPreset = LandmarksOverpassFacet;

export interface OsmLandmarksResult {
    center: { lat: number; lng: number };
    radiusM: number;
    preset: LandmarksOverpassFacet[];
    elements: OsmLandmarkElement[];
}

type LineGen = (r: number, lat: number, lng: number) => string;

const OVERPASS_LINE_BY_FACET: Record<LandmarksOverpassFacet, LineGen> = {
    [LandmarksOverpassFacet.Tourism]: (r, lat, lng) =>
        `  nwr["tourism"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Historic]: (r, lat, lng) =>
        `  nwr["historic"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Museum]: (r, lat, lng) =>
        `  nwr["amenity"="museum"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Peak]: (r, lat, lng) =>
        `  nwr["natural"="peak"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Cemetery]: (r, lat, lng) =>
        `  nwr["amenity"="grave_yard"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Bridge]: (r, lat, lng) =>
        `  nwr["man_made"="bridge"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Waterfall]: (r, lat, lng) =>
        `  nwr["waterway"="waterfall"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Spring]: (r, lat, lng) =>
        `  nwr["natural"="spring"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Cave]: (r, lat, lng) =>
        `  nwr["natural"="cave"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Beach]: (r, lat, lng) =>
        `  nwr["natural"="beach"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Fountain]: (r, lat, lng) =>
        `  nwr["amenity"="fountain"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.PlaceOfWorship]: (r, lat, lng) =>
        `  nwr["amenity"="place_of_worship"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Library]: (r, lat, lng) =>
        `  nwr["amenity"="library"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Theatre]: (r, lat, lng) =>
        `  nwr["amenity"="theatre"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Memorial]: (r, lat, lng) =>
        `  nwr["historic"="memorial"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Castle]: (r, lat, lng) =>
        `  nwr["historic"="castle"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Ruins]: (r, lat, lng) =>
        `  nwr["historic"="ruins"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.ArchaeologicalSite]: (r, lat, lng) =>
        `  nwr["historic"="archaeological_site"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Battlefield]: (r, lat, lng) =>
        `  nwr["historic"="battlefield"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Monument]: (r, lat, lng) =>
        `  nwr["historic"="monument"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Windmill]: (r, lat, lng) =>
        `  nwr["man_made"="windmill"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Lighthouse]: (r, lat, lng) =>
        `  nwr["man_made"="lighthouse"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Dam]: (r, lat, lng) =>
        `  nwr["waterway"="dam"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Zoo]: (r, lat, lng) =>
        `  nwr["tourism"="zoo"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.PicnicSite]: (r, lat, lng) =>
        `  nwr["tourism"="picnic_site"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Artwork]: (r, lat, lng) =>
        `  nwr["tourism"="artwork"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Viewpoint]: (r, lat, lng) =>
        `  nwr["tourism"="viewpoint"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Information]: (r, lat, lng) =>
        `  nwr["tourism"="information"](around:${r},${lat},${lng});`,
    [LandmarksOverpassFacet.Military]: (r, lat, lng) =>
        `  nwr["military"](around:${r},${lat},${lng});`,
};

function facetLines(f: LandmarksOverpassFacet, r: number, lat: number, lng: number): string[] {
    if (f === LandmarksOverpassFacet.Cemetery) {
        return [
            OVERPASS_LINE_BY_FACET[f](r, lat, lng),
            `  nwr["landuse"="cemetery"](around:${r},${lat},${lng});`,
        ];
    }
    return [OVERPASS_LINE_BY_FACET[f](r, lat, lng)];
}

function dedupeFacets(facets: LandmarksOverpassFacet[]): LandmarksOverpassFacet[] {
    const seen = new Set<LandmarksOverpassFacet>();
    const out: LandmarksOverpassFacet[] = [];
    for (const f of facets) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
    }
    return out;
}

function coerceFacet(raw: unknown): LandmarksOverpassFacet | null {
    if (typeof raw !== "string") {
        const vals = Object.values(LandmarksOverpassFacet) as LandmarksOverpassFacet[];
        return vals.includes(raw as LandmarksOverpassFacet) ? (raw as LandmarksOverpassFacet) : null;
    }
    const v = raw.toLowerCase();
    for (const facet of Object.values(LandmarksOverpassFacet) as LandmarksOverpassFacet[]) {
        if (facet === v) return facet;
    }
    return null;
}

/**
 * Parse `preset`: array of facets, `"landmarks"` (default), `"extended"` (+ museum, peak),
 * `"full"` (all landmark facets), or a single facet name.
 */
export function parseLandmarkFacets(raw: unknown): LandmarksOverpassFacet[] {
    const base = [...DEFAULT_LANDMARKS_FACETS];
    if (raw == null) return base;
    if (Array.isArray(raw)) {
        const mapped: LandmarksOverpassFacet[] = [];
        for (const item of raw) {
            const f = coerceFacet(item);
            if (f != null) mapped.push(f);
        }
        return mapped.length ? dedupeFacets(mapped) : base;
    }
    if (typeof raw === "string") {
        const v = raw.toLowerCase();
        if (v === "" || v === "landmarks") return base;
        if (v === "extended") {
            return dedupeFacets([
                ...base,
                LandmarksOverpassFacet.Museum,
                LandmarksOverpassFacet.Peak,
            ]);
        }
        if (v === "full") {
            return dedupeFacets([...ALL_LANDMARKS_OVERPASS_FACETS]);
        }
        const one = coerceFacet(raw);
        return one != null ? [one] : base;
    }
    const single = coerceFacet(raw);
    return single != null ? [single] : base;
}

/** @deprecated use parseLandmarkFacets */
export function parseLandmarksPreset(raw: string | LandmarksOverpassFacet | undefined): LandmarksOverpassFacet[] {
    return parseLandmarkFacets(raw);
}

export function buildLandmarksOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    facets: LandmarksOverpassFacet[]
): string {
    const r = radiusM;
    const list = facets.length ? dedupeFacets(facets) : [...DEFAULT_LANDMARKS_FACETS];
    const lines = list.flatMap((f) => facetLines(f, r, lat, lng));
    return `${overpassSettingsHeader()}
(
${lines.join("\n")}
);
out center;`;
}

export function clampRadiusM(parsed: number): number {
    return clampOsmRadiusM(parsed, DEFAULT_OSM_RADIUS_M, MAX_OSM_RADIUS_M);
}

export async function fetchNearbyLandmarks(
    lat: number,
    lng: number,
    radiusM: number,
    facets: LandmarksOverpassFacet[]
): Promise<OsmLandmarksResult> {
    const normalized = facets.length ? dedupeFacets(facets) : [...DEFAULT_LANDMARKS_FACETS];
    const query = buildLandmarksOverpassQuery(lat, lng, radiusM, normalized);
    const elements = await fetchOverpassElements(query, "OsmLandmarksRetriever");
    return {
        center: { lat, lng },
        radiusM,
        preset: normalized,
        elements,
    };
}
