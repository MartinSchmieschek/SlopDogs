/**
 * OSM landscape features — Punkt-/Linien-Geometrien, die zu Vegetations-
 * Polygonen komplementaer sind:
 *   - natural=tree, natural=tree_row    (point + line vegetation)
 *   - barrier=wall, fence, hedge, …      (linear obstructions)
 *   - man_made=tower, mast, chimney, …   (vertical structures)
 *
 * Caller waehlt Subsets ueber `nature[]`, `barrier[]`, `manMade[]`.
 * Tile-Cache-Facets enkodieren `key:value` (z. B. `barrier:wall`).
 *
 * Result tragt simplify(toleranceM) und merge() — merge() wirkt nur auf
 * Polygone (hier i. d. R. keine), Punkte/Linien werden durchgereicht.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import {
    OsmLandscapeFeaturesPact,
    type OsmLandscapeFeaturesQueryInput,
} from "./osmGeometryPacts";
import {
    parseOsmNaturePointList,
    parseOsmBarrierList,
    parseOsmManMadeList,
    type OsmNaturePointValue,
    type OsmBarrierValue,
    type OsmManMadeValue,
} from "./osmGeometryEnums";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export interface OsmLandscapeFeaturesResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    nature: OsmNaturePointValue[];
    barrier: OsmBarrierValue[];
    manMade: OsmManMadeValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmLandscapeFeaturesResultWithHelpers = OsmLandscapeFeaturesResult & GeometryResultHelpers<OsmLandscapeFeaturesResult>;

function facetFor(key: "natural" | "barrier" | "man_made", value: string): string {
    return `${key}:${value}`;
}

function splitFacet(f: string): { key: string; value: string } | null {
    const colon = f.indexOf(":");
    if (colon < 0) return null;
    const k = f.slice(0, colon);
    const v = f.slice(colon + 1);
    if (!v) return null;
    return { key: k, value: v };
}

export class OsmLandscapeFeaturesRetriever extends OsmFeatureRetriever<OsmLandscapeFeaturesResult, typeof OsmLandscapeFeaturesPact> {
    protected readonly layer = "landscapeFeatures";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmLandscapeFeaturesPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmLandscapeFeaturesRetriever.name;
    }

    get description(): string {
        return "Hunts point + line features that vegetation polygons miss: single trees, tree rows, walls/fences/hedges, towers/masts/chimneys/incinerators/gas-tanks. Three independent axes — `nature`, `barrier`, `manMade` — each accepts enum values or **custom OSM values** matching `[a-z0-9_:]+`. Defaults pick sensible subsets. Returns mixed Points + LineStrings. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — trees: `species` (latin + `species:de`), `genus`, `height`, `circumference`, `leaf_type`, `leaf_cycle`, `denotation`, `start_date`; barriers: `height`, `material`; towers/masts: `tower:type`, `height`, `operator`.";
    }

    get icon(): string | undefined {
        return "🌳";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmLandscapeFeaturesPact, d));
        const query = (queryDog?.collected as OsmLandscapeFeaturesQueryInput | undefined) ?? ({} as OsmLandscapeFeaturesQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));

        const nature = parseOsmNaturePointList(query.nature);
        const barrier = parseOsmBarrierList(query.barrier);
        const manMade = parseOsmManMadeList(query.manMade);

        const facets: string[] = [];
        for (const v of nature) facets.push(facetFor("natural", v));
        for (const v of barrier) facets.push(facetFor("barrier", v));
        for (const v of manMade) facets.push(facetFor("man_made", v));

        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const split = splitFacet(f);
            if (!split) continue;
            const { key, value } = split;
            // natural=tree ist ein Knoten; tree_row ein Way. barrier/man_made
            // koennen Knoten oder Ways sein. nwr deckt alle Faelle ab.
            lines.push(`  nwr["${key}"="${value}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const split = splitFacet(f);
            if (!split) continue;
            if (tags[split.key] === split.value) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmLandscapeFeaturesResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const nature = new Set<string>();
        const barrier = new Set<string>();
        const manMade = new Set<string>();
        for (const f of q.facets ?? []) {
            const split = splitFacet(f);
            if (!split) continue;
            if (split.key === "natural") nature.add(split.value);
            else if (split.key === "barrier") barrier.add(split.value);
            else if (split.key === "man_made") manMade.add(split.value);
        }
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            nature: Array.from(nature) as OsmNaturePointValue[],
            barrier: Array.from(barrier) as OsmBarrierValue[],
            manMade: Array.from(manMade) as OsmManMadeValue[],
            geojson,
        };
    }

    protected postProcess(result: OsmLandscapeFeaturesResult): OsmLandscapeFeaturesResult {
        return attachGeometryHelpers(result);
    }
}
