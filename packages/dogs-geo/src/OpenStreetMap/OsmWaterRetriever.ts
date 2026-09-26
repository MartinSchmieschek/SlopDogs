/**
 * OSM water features — polygons for lakes/ponds/bays + lines for rivers/streams/canals/coastline.
 * Two independent axes (`natural`, `waterway`); tile-cached per key:value facet.
 *
 * Result tragt simplify(toleranceM) und merge() — letzteres vereint Polygone
 * topologisch (e.g. überlappende Riverbanks).
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmWaterPact, type OsmWaterQueryInput } from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export enum OsmWaterNaturalValue {
    Water = "water",
    Bay = "bay",
    Coastline = "coastline",
    Spring = "spring",
    Strait = "strait",
    Wetland = "wetland",
    Hot_Spring = "hot_spring",
}

export enum OsmWaterwayValue {
    River = "river",
    Stream = "stream",
    Canal = "canal",
    Drain = "drain",
    Ditch = "ditch",
    Riverbank = "riverbank",
    Dock = "dock",
    Boatyard = "boatyard",
}

const NATURAL_SET = new Set<string>(Object.values(OsmWaterNaturalValue));
const WATERWAY_SET = new Set<string>(Object.values(OsmWaterwayValue));

const DEFAULT_NATURAL: readonly OsmWaterNaturalValue[] = [
    OsmWaterNaturalValue.Water,
    OsmWaterNaturalValue.Bay,
];
const DEFAULT_WATERWAY: readonly OsmWaterwayValue[] = [
    OsmWaterwayValue.River,
    OsmWaterwayValue.Stream,
    OsmWaterwayValue.Canal,
    OsmWaterwayValue.Riverbank,
];

function parseList<T extends string>(raw: unknown, validSet: Set<string>, fallback: readonly T[]): T[] {
    if (raw == null) return [...fallback];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...fallback];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...fallback];
    // Accept enum values + any long-tail OSM value matching the standard tag shape.
    const out: string[] = [];
    for (const s of parsed) if (validSet.has(s) || /^[a-z0-9_:]+$/.test(s)) out.push(s);
    return (out.length ? out : [...fallback]) as T[];
}

export interface OsmWaterResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    natural: OsmWaterNaturalValue[];
    waterway: OsmWaterwayValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmWaterResultWithHelpers = OsmWaterResult & GeometryResultHelpers<OsmWaterResult>;

function facetFor(key: "natural" | "waterway", value: string): string {
    return `${key}:${value}`;
}

function splitFacet(f: string): { key: string; value: string } | null {
    const colon = f.indexOf(":");
    if (colon < 0) return null;
    return { key: f.slice(0, colon), value: f.slice(colon + 1) };
}

export class OsmWaterRetriever extends OsmFeatureRetriever<OsmWaterResult, typeof OsmWaterPact> {
    protected readonly layer = "water";
    protected readonly defaultRadiusM = 1000;
    protected readonly maxRadiusM = 10000;
    protected readonly queryPactClass = OsmWaterPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmWaterRetriever.name;
    }

    get description(): string {
        return "Hunts water features — lakes/ponds/bays (natural=water/bay polygons), rivers/streams/canals/drains/ditches (waterway=* lines), coastlines, springs. Two independent axes — `natural`, `waterway` — each accepts enum values (`OsmWaterNaturalValue`, `OsmWaterwayValue`) or **custom OSM values** matching `[a-z0-9_:]+`. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `boat`, `motorboat`, `width`, `depth`, `intermittent`, `seasonal`, `salt`, `operator`, `wikidata`. Tile-cached per key:value pair.";
    }

    get icon(): string | undefined {
        return "💧";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmWaterPact, d));
        const query = (queryDog?.collected as OsmWaterQueryInput | undefined) ?? ({} as OsmWaterQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const natural = parseList<OsmWaterNaturalValue>(query.natural, NATURAL_SET, DEFAULT_NATURAL);
        const waterway = parseList<OsmWaterwayValue>(query.waterway, WATERWAY_SET, DEFAULT_WATERWAY);
        const facets: string[] = [];
        for (const v of natural) facets.push(facetFor("natural", v));
        for (const v of waterway) facets.push(facetFor("waterway", v));
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const s = splitFacet(f);
            if (!s) continue;
            lines.push(`  nwr["${s.key}"="${s.value}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const s = splitFacet(f);
            if (!s) continue;
            if (tags[s.key] === s.value) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmWaterResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const natural = new Set<string>();
        const waterway = new Set<string>();
        for (const f of q.facets ?? []) {
            const s = splitFacet(f);
            if (!s) continue;
            if (s.key === "natural") natural.add(s.value);
            else if (s.key === "waterway") waterway.add(s.value);
        }
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            natural: Array.from(natural) as OsmWaterNaturalValue[],
            waterway: Array.from(waterway) as OsmWaterwayValue[],
            geojson,
        };
    }

    protected postProcess(result: OsmWaterResult): OsmWaterResult {
        return attachGeometryHelpers(result);
    }
}
