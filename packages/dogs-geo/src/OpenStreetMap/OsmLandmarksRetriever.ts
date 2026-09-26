import { type IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { NearbyLandmarksPact, type OsmLandmarksQueryInput } from "./pacts";
import {
    clampRadiusM,
    parseLandmarkFacets,
    LandmarksOverpassFacet,
    DEFAULT_LANDMARKS_FACETS,
    ALL_LANDMARKS_OVERPASS_FACETS,
    DEFAULT_LANDMARK_RADIUS_M,
    MAX_LANDMARK_RADIUS_M,
    OsmLandmarkElementType,
    type OsmLandmarksResult,
    type OsmLandmarkElement,
} from "./overpassLandmarks";
import { mapOverpassElement } from "./overpassOsmShared";

/**
 * Facet → Tag-Bedingung. Ein Tag-Bedingungs-Array pro Facet: eine Facet matcht,
 * wenn mindestens EIN Tag-Pair zutrifft. `value: null` → Existenz-Check des Keys.
 */
const FACET_TAGS: Record<string, Array<{ key: string; value: string | null }>> = {
    [LandmarksOverpassFacet.Tourism]: [{ key: "tourism", value: null }],
    [LandmarksOverpassFacet.Historic]: [{ key: "historic", value: null }],
    [LandmarksOverpassFacet.Museum]: [{ key: "amenity", value: "museum" }],
    [LandmarksOverpassFacet.Peak]: [{ key: "natural", value: "peak" }],
    [LandmarksOverpassFacet.Cemetery]: [
        { key: "amenity", value: "grave_yard" },
        { key: "landuse", value: "cemetery" },
    ],
    [LandmarksOverpassFacet.Bridge]: [{ key: "man_made", value: "bridge" }],
    [LandmarksOverpassFacet.Waterfall]: [{ key: "waterway", value: "waterfall" }],
    [LandmarksOverpassFacet.Spring]: [{ key: "natural", value: "spring" }],
    [LandmarksOverpassFacet.Cave]: [{ key: "natural", value: "cave" }],
    [LandmarksOverpassFacet.Beach]: [{ key: "natural", value: "beach" }],
    [LandmarksOverpassFacet.Fountain]: [{ key: "amenity", value: "fountain" }],
    [LandmarksOverpassFacet.PlaceOfWorship]: [{ key: "amenity", value: "place_of_worship" }],
    [LandmarksOverpassFacet.Library]: [{ key: "amenity", value: "library" }],
    [LandmarksOverpassFacet.Theatre]: [{ key: "amenity", value: "theatre" }],
    [LandmarksOverpassFacet.Memorial]: [{ key: "historic", value: "memorial" }],
    [LandmarksOverpassFacet.Castle]: [{ key: "historic", value: "castle" }],
    [LandmarksOverpassFacet.Ruins]: [{ key: "historic", value: "ruins" }],
    [LandmarksOverpassFacet.ArchaeologicalSite]: [{ key: "historic", value: "archaeological_site" }],
    [LandmarksOverpassFacet.Battlefield]: [{ key: "historic", value: "battlefield" }],
    [LandmarksOverpassFacet.Monument]: [{ key: "historic", value: "monument" }],
    [LandmarksOverpassFacet.Windmill]: [{ key: "man_made", value: "windmill" }],
    [LandmarksOverpassFacet.Lighthouse]: [{ key: "man_made", value: "lighthouse" }],
    [LandmarksOverpassFacet.Dam]: [{ key: "waterway", value: "dam" }],
    [LandmarksOverpassFacet.Zoo]: [{ key: "tourism", value: "zoo" }],
    [LandmarksOverpassFacet.PicnicSite]: [{ key: "tourism", value: "picnic_site" }],
    [LandmarksOverpassFacet.Artwork]: [{ key: "tourism", value: "artwork" }],
    [LandmarksOverpassFacet.Viewpoint]: [{ key: "tourism", value: "viewpoint" }],
    [LandmarksOverpassFacet.Information]: [{ key: "tourism", value: "information" }],
    [LandmarksOverpassFacet.Military]: [{ key: "military", value: null }],
};

function tagClause(key: string, value: string | null): string {
    return value == null ? `["${key}"]` : `["${key}"="${value}"]`;
}

export class OsmLandmarksRetriever extends OsmFeatureRetriever<OsmLandmarksResult, typeof NearbyLandmarksPact> {
    protected readonly layer = "landmarks";
    protected readonly defaultRadiusM = DEFAULT_LANDMARK_RADIUS_M;
    protected readonly maxRadiusM = MAX_LANDMARK_RADIUS_M;
    protected readonly queryPactClass = NearbyLandmarksPact;
    protected readonly outStatement = "out center;";

    get name(): string {
        return OsmLandmarksRetriever.name;
    }

    get description(): string {
        return 'Finds nearby OSM landmarks (tourism, historic, museums, peaks, cemeteries, bridges, nature, amenities, …) via Overpass — use preset "full" or list facets. Each element\'s `tags` carries the full OSM record — `name`, `wikidata`, `wikipedia`, `image`, `opening_hours`, `wheelchair`, `addr:*`, `website`, `phone`, `operator`, `start_date`, `inscription`, `architect`, plus the facet-defining tag (`tourism`, `historic`, `amenity`, …).';
    }

    get icon(): string | undefined {
        return "\uD83C\uDFDB\uFE0F";
    }

    getVmContextContributions(): Record<string, any> {
        return {
            LandmarksOverpassFacet,
            DEFAULT_LANDMARKS_FACETS,
            ALL_LANDMARKS_OVERPASS_FACETS,
            DEFAULT_LANDMARK_RADIUS_M,
            MAX_LANDMARK_RADIUS_M,
            OsmLandmarkElementType,
        };
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyLandmarksPact, d));
        const query = (queryDog?.collected as OsmLandmarksQueryInput | undefined) ?? ({} as OsmLandmarksQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseLandmarkFacets(query.preset);
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const conditions = FACET_TAGS[f];
            if (!conditions) continue;
            for (const c of conditions) {
                lines.push(`  nwr${tagClause(c.key, c.value)}${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const conditions = FACET_TAGS[f];
            if (!conditions) continue;
            const any = conditions.some((c) =>
                c.value == null ? tags[c.key] != null : tags[c.key] === c.value,
            );
            if (any) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmLandmarksResult {
        const preset = (q.facets ?? []) as LandmarksOverpassFacet[];
        const seen = new Set<string>();
        const mapped: OsmLandmarkElement[] = [];
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
