import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { NearbyVegetationPact, type OsmVegetationQueryInput } from "./pacts";
import {
    clampVegetationRadiusM,
    parseVegetationFacets,
    VegetationOverpassFacet,
    DEFAULT_VEGETATION_FACETS,
    DEFAULT_VEGETATION_RADIUS_M,
    MAX_VEGETATION_RADIUS_M,
    type OsmVegetationResult,
} from "./overpassVegetation";
import { mapOverpassElement, type OsmGeoElement } from "./overpassOsmShared";

const FACET_TAGS: Record<string, { key: string; value: string }> = {
    [VegetationOverpassFacet.Wood]: { key: "natural", value: "wood" },
    [VegetationOverpassFacet.Forest]: { key: "landuse", value: "forest" },
    [VegetationOverpassFacet.Scrub]: { key: "natural", value: "scrub" },
    [VegetationOverpassFacet.Grassland]: { key: "natural", value: "grassland" },
    [VegetationOverpassFacet.Meadow]: { key: "landuse", value: "meadow" },
    [VegetationOverpassFacet.Heath]: { key: "natural", value: "heath" },
    [VegetationOverpassFacet.Wetland]: { key: "natural", value: "wetland" },
    [VegetationOverpassFacet.Orchard]: { key: "landuse", value: "orchard" },
    [VegetationOverpassFacet.Vineyard]: { key: "landuse", value: "vineyard" },
    [VegetationOverpassFacet.Park]: { key: "leisure", value: "park" },
};

export class OsmVegetationRetriever extends OsmFeatureRetriever<OsmVegetationResult, typeof NearbyVegetationPact> {
    protected readonly layer = "vegetation";
    protected readonly defaultRadiusM = DEFAULT_VEGETATION_RADIUS_M;
    protected readonly maxRadiusM = MAX_VEGETATION_RADIUS_M;
    protected readonly queryPactClass = NearbyVegetationPact;
    // Vegetation-Polygone: Geometrie fuer Karten-Renderer wichtig.
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmVegetationRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM vegetation / landcover (wood, forest, meadow, park, scrub, grassland, heath, wetland, orchard, vineyard) via Overpass. Each element's `tags` carries the full OSM record — `leaf_type` (broadleaved/needleleaved/mixed), `leaf_cycle` (deciduous/evergreen), `name` (Naturparks/Wälder), `protect_class`, `protection_title`, `operator`, `wikidata`. Polygons can be large; prefer smaller radii.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF33";
    }

    getVmContextContributions(): Record<string, any> {
        return {
            VegetationOverpassFacet,
            DEFAULT_VEGETATION_FACETS,
            DEFAULT_VEGETATION_RADIUS_M,
            MAX_VEGETATION_RADIUS_M,
        };
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyVegetationPact, d));
        const query = (queryDog?.collected as OsmVegetationQueryInput | undefined) ?? ({} as OsmVegetationQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampVegetationRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseVegetationFacets(query.preset);
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const c = FACET_TAGS[f];
            if (!c) continue;
            lines.push(`  nwr["${c.key}"="${c.value}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const c = FACET_TAGS[f];
            if (!c) continue;
            if (tags[c.key] === c.value) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmVegetationResult {
        const preset = (q.facets ?? []) as VegetationOverpassFacet[];
        const seen = new Set<string>();
        const mapped: OsmGeoElement[] = [];
        for (const raw of elements) {
            const m = mapOverpassElement({
                type: raw.type,
                id: raw.id,
                lat: raw.lat,
                lon: raw.lon,
                center: raw.center,
                tags: raw.tags,
            });
            if (!m) continue;
            const key = `${m.type}/${m.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            mapped.push(m);
        }
        // out geom; liefert Polygon-Ringe inline — osmtogeojson baut daraus
        // ein FeatureCollection fuer Karten-Renderer.
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            preset,
            elements: mapped,
            geojson,
        };
    }
}
