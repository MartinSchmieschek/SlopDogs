/**
 * OSM building polygons → GeoJSON. Tile-cached pro Building-Subtype.
 * Default-Facet `'all'` = jedes Element mit `building=*`. Optional schraenkt
 * der Caller via `building: ["residential", "industrial", …]` ein.
 *
 * Result tragt simplify(toleranceM) und merge() — letzteres vereint
 * angrenzende Gebaeude-Polygone topologisch zu einem MultiPolygon.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmBuildingsGeometryPact, type OsmBuildingsGeometryQueryInput } from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

const BUILDING_ALL_FACET = "all";

export interface OsmBuildingsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    /** Liste der angefragten Building-Subtypes; `["all"]` wenn keine Filter. */
    building: string[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmBuildingsResultWithHelpers = OsmBuildingsResult & GeometryResultHelpers<OsmBuildingsResult>;

function parseBuildingList(raw: unknown): string[] {
    if (raw == null) return [BUILDING_ALL_FACET];
    if (Array.isArray(raw)) {
        const out = raw.map((x) => String(x).trim()).filter(Boolean);
        return out.length > 0 ? out : [BUILDING_ALL_FACET];
    }
    if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [BUILDING_ALL_FACET];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) {
                const out = j.map((x) => String(x).trim()).filter(Boolean);
                return out.length > 0 ? out : [BUILDING_ALL_FACET];
            }
        } catch {
            return [t];
        }
        return [t];
    }
    return [BUILDING_ALL_FACET];
}

export class OsmBuildingsRetriever extends OsmFeatureRetriever<OsmBuildingsResult, typeof OsmBuildingsGeometryPact> {
    protected readonly layer = "buildings";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmBuildingsGeometryPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmBuildingsRetriever.name;
    }

    get description(): string {
        return "Hunts building polygons within lat/lng/radius. Defaults to every `building=*`; narrow via `building: ['residential','industrial','commercial','office','retail','garage','apartments','house','school','church',…]` — any **custom OSM value** matching `[a-z0-9_:]+` is accepted for long-tail tags. `simplify(m)` thins vertices, `merge()` unions adjacent buildings into one MultiPolygon. Each feature's `properties` carries all OSM tags — `building:levels`, `height`, `roof:shape`, `roof:material`, `addr:street/housenumber/postcode/city`, `name`, `start_date`, `wikidata`, `wikipedia`, plus combined-use tags (`amenity`, `shop`, `tourism`, `office`) and `wheelchair`. Tile-cached per subtype.";
    }

    get icon(): string | undefined {
        return "🏗️";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmBuildingsGeometryPact, d));
        const query = (queryDog?.collected as OsmBuildingsGeometryQueryInput | undefined) ?? ({} as OsmBuildingsGeometryQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseBuildingList(query.building);
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            if (f === BUILDING_ALL_FACET) {
                lines.push(`  way["building"]${bboxClause};`);
                lines.push(`  relation["building"]${bboxClause};`);
            } else {
                lines.push(`  way["building"="${f}"]${bboxClause};`);
                lines.push(`  relation["building"="${f}"]${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["building"];
        if (!v) return [];
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            if (f === BUILDING_ALL_FACET || f === v) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmBuildingsResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            building: [...(q.facets ?? [])],
            geojson,
        };
    }

    protected postProcess(result: OsmBuildingsResult): OsmBuildingsResult {
        return attachGeometryHelpers(result);
    }
}
