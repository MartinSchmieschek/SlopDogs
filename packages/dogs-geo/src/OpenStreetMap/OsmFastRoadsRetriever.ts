import { type IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { NearbyFastRoadsPact, type OsmFastRoadsQueryInput } from "./pacts";
import {
    clampFastRoadsRadiusM,
    parseFastRoadsFacets,
    FastRoadsOverpassFacet,
    DEFAULT_FAST_ROADS_FACETS,
    DEFAULT_FAST_ROADS_RADIUS_M,
    MAX_FAST_ROADS_RADIUS_M,
    type OsmFastRoadsResult,
} from "./overpassFastRoads";
import { mapOverpassElement, type OsmGeoElement } from "./overpassOsmShared";

const HIGHWAY_BY_FACET: Record<string, string> = {
    [FastRoadsOverpassFacet.Motorway]: "motorway",
    [FastRoadsOverpassFacet.MotorwayLink]: "motorway_link",
    [FastRoadsOverpassFacet.Trunk]: "trunk",
    [FastRoadsOverpassFacet.TrunkLink]: "trunk_link",
    [FastRoadsOverpassFacet.Primary]: "primary",
    [FastRoadsOverpassFacet.Secondary]: "secondary",
};

export class OsmFastRoadsRetriever extends OsmFeatureRetriever<OsmFastRoadsResult, typeof NearbyFastRoadsPact> {
    protected readonly layer = "fastRoads";
    protected readonly defaultRadiusM = DEFAULT_FAST_ROADS_RADIUS_M;
    protected readonly maxRadiusM = MAX_FAST_ROADS_RADIUS_M;
    protected readonly queryPactClass = NearbyFastRoadsPact;
    protected readonly outStatement = "out center;";

    get name(): string {
        return OsmFastRoadsRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM fast roads (motorway, trunk, primary, secondary, tertiary) via Overpass. Each element's `tags` carries the full OSM record — `maxspeed`, `lanes`, `oneway`, `surface`, `lit`, `access`, `tunnel`, `bridge`, `layer`, `ref` (Straßennummer/A-/B-Nummer), `name`, `int_ref` (E-Roads), `operator`. Use a modest radius; many segments in dense areas.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEE3\uFE0F";
    }

    getVmContextContributions(): Record<string, any> {
        return {
            FastRoadsOverpassFacet,
            DEFAULT_FAST_ROADS_FACETS,
            DEFAULT_FAST_ROADS_RADIUS_M,
            MAX_FAST_ROADS_RADIUS_M,
        };
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyFastRoadsPact, d));
        const query = (queryDog?.collected as OsmFastRoadsQueryInput | undefined) ?? ({} as OsmFastRoadsQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampFastRoadsRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseFastRoadsFacets(query.preset);
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const hw = HIGHWAY_BY_FACET[f];
            if (!hw) continue;
            lines.push(`  way["highway"="${hw}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const hw = el.tags?.["highway"];
        if (!hw) return [];
        const match: string[] = [];
        for (const f of fetchedFacets) {
            if (HIGHWAY_BY_FACET[f] === hw) match.push(f);
        }
        return match;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmFastRoadsResult {
        const preset = (q.facets ?? []) as FastRoadsOverpassFacet[];
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
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            preset,
            elements: mapped,
        };
    }
}
