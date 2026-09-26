/**
 * Overpass: walkable / rideable ways (highway paths) near a point — separate from landmarks to keep payloads predictable.
 */

import {
    clampOsmRadiusM,
    DEFAULT_OSM_RADIUS_M,
    fetchOverpassElements,
    MAX_OSM_RADIUS_M,
    overpassSettingsHeader,
    type OsmGeoElement,
} from "./overpassOsmShared";

export const DEFAULT_TRACKS_RADIUS_M = DEFAULT_OSM_RADIUS_M;
export const MAX_TRACKS_RADIUS_M = MAX_OSM_RADIUS_M;

export enum TracksOverpassFacet {
    Path = "path",
    Footway = "footway",
    Cycleway = "cycleway",
    Bridleway = "bridleway",
    Track = "track",
    Steps = "steps",
}

export const DEFAULT_TRACKS_FACETS: readonly TracksOverpassFacet[] = [
    TracksOverpassFacet.Path,
    TracksOverpassFacet.Footway,
];

export const ALL_TRACKS_OVERPASS_FACETS: readonly TracksOverpassFacet[] = [
    TracksOverpassFacet.Path,
    TracksOverpassFacet.Footway,
    TracksOverpassFacet.Cycleway,
    TracksOverpassFacet.Bridleway,
    TracksOverpassFacet.Track,
    TracksOverpassFacet.Steps,
];

export interface OsmTracksResult {
    center: { lat: number; lng: number };
    radiusM: number;
    preset: TracksOverpassFacet[];
    elements: OsmGeoElement[];
}

const HIGHWAY_BY_FACET: Record<TracksOverpassFacet, string> = {
    [TracksOverpassFacet.Path]: "path",
    [TracksOverpassFacet.Footway]: "footway",
    [TracksOverpassFacet.Cycleway]: "cycleway",
    [TracksOverpassFacet.Bridleway]: "bridleway",
    [TracksOverpassFacet.Track]: "track",
    [TracksOverpassFacet.Steps]: "steps",
};

function lineForFacet(f: TracksOverpassFacet, r: number, lat: number, lng: number): string {
    const h = HIGHWAY_BY_FACET[f];
    return `  way["highway"="${h}"](around:${r},${lat},${lng});`;
}

function dedupeFacets(facets: TracksOverpassFacet[]): TracksOverpassFacet[] {
    const seen = new Set<TracksOverpassFacet>();
    const out: TracksOverpassFacet[] = [];
    for (const f of facets) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
    }
    return out;
}

function coerceFacet(raw: unknown): TracksOverpassFacet | null {
    if (typeof raw !== "string") {
        const vals = Object.values(TracksOverpassFacet) as TracksOverpassFacet[];
        return vals.includes(raw as TracksOverpassFacet) ? (raw as TracksOverpassFacet) : null;
    }
    const v = raw.toLowerCase();
    for (const facet of Object.values(TracksOverpassFacet) as TracksOverpassFacet[]) {
        if (facet === v) return facet;
    }
    return null;
}

export function parseTracksFacets(raw: unknown): TracksOverpassFacet[] {
    const base = [...DEFAULT_TRACKS_FACETS];
    if (raw == null) return base;
    if (Array.isArray(raw)) {
        const mapped: TracksOverpassFacet[] = [];
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
            return dedupeFacets([...ALL_TRACKS_OVERPASS_FACETS]);
        }
        const one = coerceFacet(raw);
        return one != null ? [one] : base;
    }
    const single = coerceFacet(raw);
    return single != null ? [single] : base;
}

export function buildTracksOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    facets: TracksOverpassFacet[]
): string {
    const r = radiusM;
    const list = facets.length ? dedupeFacets(facets) : [...DEFAULT_TRACKS_FACETS];
    const lines = list.map((f) => lineForFacet(f, r, lat, lng));
    return `${overpassSettingsHeader()}
(
${lines.join("\n")}
);
out center;`;
}

export function clampTracksRadiusM(parsed: number): number {
    return clampOsmRadiusM(parsed, DEFAULT_OSM_RADIUS_M, MAX_OSM_RADIUS_M);
}

export async function fetchNearbyTracks(
    lat: number,
    lng: number,
    radiusM: number,
    facets: TracksOverpassFacet[]
): Promise<OsmTracksResult> {
    const normalized = facets.length ? dedupeFacets(facets) : [...DEFAULT_TRACKS_FACETS];
    const query = buildTracksOverpassQuery(lat, lng, radiusM, normalized);
    const elements = await fetchOverpassElements(query, "OsmTracksRetriever");
    return {
        center: { lat, lng },
        radiusM,
        preset: normalized,
        elements,
    };
}
