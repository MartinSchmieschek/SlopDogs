import { type IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase, DEFAULT_FACET } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { NearbyTracksPact, type OsmTracksQueryInput } from "./pacts";
import {
    clampTracksRadiusM,
    parseTracksFacets,
    TracksOverpassFacet,
    DEFAULT_TRACKS_FACETS,
    DEFAULT_TRACKS_RADIUS_M,
    MAX_TRACKS_RADIUS_M,
    ALL_TRACKS_OVERPASS_FACETS,
    type OsmTracksResult,
} from "./overpassTracks";
import { mapOverpassElement, OsmGeoElementType, type OsmGeoElement } from "./overpassOsmShared";

/** highway-Values pro Track-Facet — 1:1 Mapping. */
const HIGHWAY_BY_FACET: Record<string, string> = {
    [TracksOverpassFacet.Path]: "path",
    [TracksOverpassFacet.Footway]: "footway",
    [TracksOverpassFacet.Cycleway]: "cycleway",
    [TracksOverpassFacet.Bridleway]: "bridleway",
    [TracksOverpassFacet.Track]: "track",
    [TracksOverpassFacet.Steps]: "steps",
};

export class OsmTracksRetriever extends OsmFeatureRetriever<OsmTracksResult, typeof NearbyTracksPact> {
    protected readonly layer = "tracks";
    protected readonly defaultRadiusM = DEFAULT_TRACKS_RADIUS_M;
    protected readonly maxRadiusM = MAX_TRACKS_RADIUS_M;
    protected readonly queryPactClass = NearbyTracksPact;
    protected readonly outStatement = "out center;";

    get name(): string {
        return OsmTracksRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM ways (path, footway, cycleway, track, bridleway, steps, …) via Overpass. Each element's `tags` carries the full OSM record — `surface` (paved/asphalt/gravel/dirt/grass), `smoothness`, `width`, `lit`, `access`, `incline`, `tunnel`, `bridge`, `layer`, `tracktype` (grade1-5), `sac_scale` (Wander-Schwierigkeit), `mtb:scale`, `name`, `ref`. Use a modest radius; results can be large.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD7E";
    }

    getVmContextContributions(): Record<string, any> {
        return {
            TracksOverpassFacet,
            DEFAULT_TRACKS_FACETS,
            DEFAULT_TRACKS_RADIUS_M,
            MAX_TRACKS_RADIUS_M,
            ALL_TRACKS_OVERPASS_FACETS,
        };
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyTracksPact, d));
        const query = (queryDog?.collected as OsmTracksQueryInput | undefined) ?? ({} as OsmTracksQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampTracksRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseTracksFacets(query.preset);

        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
        const lines: string[] = [];
        for (const f of facets) {
            const hw = HIGHWAY_BY_FACET[f];
            if (!hw) continue;
            lines.push(`  way["highway"="${hw}"](${bboxClause});`);
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

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmTracksResult {
        const preset = (q.facets ?? [DEFAULT_FACET]) as TracksOverpassFacet[];
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
