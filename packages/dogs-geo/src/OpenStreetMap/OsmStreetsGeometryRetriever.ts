/**
 * OSM highway ways → GeoJSON line geometries.
 * Tile-basiertes Caching: pro highway-Value eine eigene Facet-Partition.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmStreetsGeometryPact, type OsmStreetsGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmHighwayList, type OsmHighwayValue } from "./osmGeometryEnums";
import { circleToBoundingBox, clampGeometryRadiusM, type BoundingBox } from "./overpassGeometryCore";

export interface OsmStreetsGeometryResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    highway: OsmHighwayValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export class OsmStreetsGeometryRetriever extends OsmFeatureRetriever<OsmStreetsGeometryResult, typeof OsmStreetsGeometryPact> {
    protected readonly layer = "streetsGeometry";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmStreetsGeometryPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmStreetsGeometryRetriever.name;
    }

    get icon(): string | undefined {
        return undefined;
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmStreetsGeometryPact, d));
        const query = (queryDog?.collected as OsmStreetsGeometryQueryInput | undefined) ?? ({} as OsmStreetsGeometryQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const highway = parseOsmHighwayList(query.highway, query.preset);
        return { lat, lng, radiusM, facets: [...highway] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const hw of facets) {
            lines.push(`  way["highway"="${hw}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const hw = el.tags?.["highway"];
        if (!hw) return [];
        return fetchedFacets.filter((f) => f === hw);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmStreetsGeometryResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const highway = (q.facets ?? []) as OsmHighwayValue[];
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            highway,
            geojson,
        };
    }
}
