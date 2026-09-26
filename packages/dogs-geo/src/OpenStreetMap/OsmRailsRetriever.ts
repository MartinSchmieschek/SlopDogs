/**
 * OSM railway ways → GeoJSON line geometries. Tile-cached pro railway-Value.
 * Default: rail/tram/subway/light_rail. Caller schraenkt via `railway: [...]`.
 *
 * Result tragt simplify(toleranceM) und merge() — merge() ist hier
 * effektiv ein No-Op fuer Linien (sie werden unveraendert durchgereicht).
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmRailsGeometryPact, type OsmRailsGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmRailwayList, type OsmRailwayValue } from "./osmGeometryEnums";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export interface OsmRailsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    railway: OsmRailwayValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmRailsResultWithHelpers = OsmRailsResult & GeometryResultHelpers<OsmRailsResult>;

export class OsmRailsRetriever extends OsmFeatureRetriever<OsmRailsResult, typeof OsmRailsGeometryPact> {
    protected readonly layer = "rails";
    protected readonly defaultRadiusM = 1000;
    protected readonly maxRadiusM = 10000;
    protected readonly queryPactClass = OsmRailsGeometryPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmRailsRetriever.name;
    }

    get description(): string {
        return "Hunts railway lines within lat/lng/radius. Defaults to passenger transit (rail, tram, subway, light_rail). Pass `railway: [...]` from `OsmRailwayValue` (monorail, funicular, disused, abandoned, construction, …) or any **custom OSM value** matching `[a-z0-9_:]+`. `simplify(m)` thins vertices. Each feature's `properties` carries all OSM tags — `electrified`, `voltage`, `frequency`, `gauge`, `maxspeed`, `usage` (main/branch/industrial), `service` (yard/siding/spur), `operator`, `operator:wikidata`, `ref` (line number), `name`, `tunnel`, `bridge`, `layer`. Tile-cached per railway value.";
    }

    get icon(): string | undefined {
        return "🚆";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmRailsGeometryPact, d));
        const query = (queryDog?.collected as OsmRailsGeometryQueryInput | undefined) ?? ({} as OsmRailsGeometryQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const railway = parseOsmRailwayList(query.railway);
        return { lat, lng, radiusM, facets: [...railway] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const r of facets) {
            lines.push(`  way["railway"="${r}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const r = el.tags?.["railway"];
        if (!r) return [];
        return fetchedFacets.filter((f) => f === r);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmRailsResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const railway = (q.facets ?? []) as OsmRailwayValue[];
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            railway,
            geojson,
        };
    }

    protected postProcess(result: OsmRailsResult): OsmRailsResult {
        return attachGeometryHelpers(result);
    }
}
