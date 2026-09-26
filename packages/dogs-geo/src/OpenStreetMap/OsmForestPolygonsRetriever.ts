/**
 * OSM forest / landuse / natural area polygons → GeoJSON (full geometry).
 * Tile-basiertes Caching: pro Tile + Facet eine eigene Coverage-Zeile.
 * Facets kodieren Key:Value (z.B. "landuse:forest", "natural:wood").
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmForestGeometryPact, type OsmForestGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmLanduseList, parseOsmNaturalList } from "./osmGeometryEnums";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";

export interface OsmForestPolygonsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    landuse: string[];
    natural: string[];
    geojson: FeatureCollection<GeometryObject>;
}

function facetFor(key: "landuse" | "natural", value: string): string {
    return `${key}:${value}`;
}

export class OsmForestPolygonsRetriever extends OsmFeatureRetriever<OsmForestPolygonsResult, typeof OsmForestGeometryPact> {
    protected readonly layer = "forestPolygons";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmForestGeometryPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmForestPolygonsRetriever.name;
    }

    get icon(): string | undefined {
        return undefined;
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmForestGeometryPact, d));
        const query = (queryDog?.collected as OsmForestGeometryQueryInput | undefined) ?? ({} as OsmForestGeometryQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const landuse = parseOsmLanduseList(query.landuse);
        const natural = parseOsmNaturalList(query.natural);

        const facets: string[] = [];
        for (const v of landuse) facets.push(facetFor("landuse", v));
        for (const v of natural) facets.push(facetFor("natural", v));

        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const colon = f.indexOf(":");
            if (colon < 0) continue;
            const k = f.slice(0, colon);
            const v = f.slice(colon + 1);
            if (!v) continue;
            lines.push(`  way["${k}"="${v}"]${bboxClause};`);
            lines.push(`  relation["${k}"="${v}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const colon = f.indexOf(":");
            if (colon < 0) continue;
            const k = f.slice(0, colon);
            const v = f.slice(colon + 1);
            if (tags[k] === v) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmForestPolygonsResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const landuse = new Set<string>();
        const natural = new Set<string>();
        for (const f of q.facets ?? []) {
            const colon = f.indexOf(":");
            if (colon < 0) continue;
            const k = f.slice(0, colon);
            const v = f.slice(colon + 1);
            if (k === "landuse") landuse.add(v);
            else if (k === "natural") natural.add(v);
        }

        // osmtogeojson erwartet {elements: [...]} — unsere Raw-Elements haben
        // bereits die korrekte Struktur (wir haben out geom verwendet).
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            landuse: Array.from(landuse),
            natural: Array.from(natural),
            geojson,
        };
    }
}
