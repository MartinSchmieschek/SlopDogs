/**
 * OSM landuse polygons — residential, industrial, commercial, retail, farmland, cemetery, …
 * Tile-cached pro landuse-Value.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmLandusePact, type OsmLanduseQueryInput } from "./osmGeometryPacts";
import { OsmLanduseValue } from "./osmGeometryEnums";

const LANDUSE_SET = new Set<string>(Object.values(OsmLanduseValue));
const DEFAULT_LANDUSE: readonly OsmLanduseValue[] = [
    OsmLanduseValue.Residential,
    OsmLanduseValue.Commercial,
    OsmLanduseValue.Industrial,
    OsmLanduseValue.Retail,
];

function parseLanduseList(raw: unknown): OsmLanduseValue[] {
    if (raw == null) return [...DEFAULT_LANDUSE];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_LANDUSE];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_LANDUSE];
    // Accept enum values + any long-tail OSM landuse value matching the standard tag shape.
    const out: string[] = [];
    for (const s of parsed) if (LANDUSE_SET.has(s) || /^[a-z0-9_:]+$/.test(s)) out.push(s);
    return (out.length ? out : [...DEFAULT_LANDUSE]) as OsmLanduseValue[];
}
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export interface OsmLanduseResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    landuse: OsmLanduseValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmLanduseResultWithHelpers = OsmLanduseResult & GeometryResultHelpers<OsmLanduseResult>;

export class OsmLanduseRetriever extends OsmFeatureRetriever<OsmLanduseResult, typeof OsmLandusePact> {
    protected readonly layer = "landuse";
    protected readonly defaultRadiusM = 1000;
    protected readonly maxRadiusM = 10000;
    protected readonly queryPactClass = OsmLandusePact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmLanduseRetriever.name;
    }

    get description(): string {
        return "Hunts landuse polygons within lat/lng/radius — residential, commercial, industrial, retail, farmland, cemetery, military, recreation_ground, allotments, brownfield, construction, quarry, etc. Defaults to residential + commercial + industrial + retail; pass `landuse: [...]` from `OsmLanduseValue` or any **custom OSM value** matching `[a-z0-9_:]+` for long-tail tags. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `operator`, `wikidata`, function-specific tags (crop/produce/military/cemetery type, …). Tile-cached per landuse value.";
    }

    get icon(): string | undefined {
        return "🏘️";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmLandusePact, d));
        const query = (queryDog?.collected as OsmLanduseQueryInput | undefined) ?? ({} as OsmLanduseQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const landuse = parseLanduseList(query.landuse);
        return { lat, lng, radiusM, facets: [...landuse] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const v of facets) {
            lines.push(`  way["landuse"="${v}"]${bboxClause};`);
            lines.push(`  relation["landuse"="${v}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["landuse"];
        if (!v) return [];
        return fetchedFacets.filter((f) => f === v);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmLanduseResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const landuse = (q.facets ?? []) as OsmLanduseValue[];
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            landuse,
            geojson,
        };
    }

    protected postProcess(result: OsmLanduseResult): OsmLanduseResult {
        return attachGeometryHelpers(result);
    }
}
