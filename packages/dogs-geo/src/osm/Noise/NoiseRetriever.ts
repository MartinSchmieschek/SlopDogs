import { IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import {
    type OverpassRawElement,
    overpassElementRepresentativePoint,
} from "../base/overpassMirrorChain";
import { NoiseQueryPact, type NoiseQuery } from "./pacts";

export type NoiseAssessment = "very quiet" | "quiet" | "moderate" | "noisy" | "very noisy";

export interface QuietZone {
    lat: number;
    lng: number;
    type: string;
    name?: string;
    area?: string;
}

export interface NoiseSource {
    lat: number;
    lng: number;
    type: string;
    name?: string;
    subtype: string;
}

export interface NoiseProfile {
    quietZoneCount: number;
    noiseSourceCount: number;
    assessment: NoiseAssessment;
}

export interface NoiseResult {
    center: { lat: number; lng: number };
    radiusM: number;
    quietZones: QuietZone[];
    noiseSources: NoiseSource[];
    profile: NoiseProfile;
}

const QUIET_TAGS: Record<string, string> = {
    park: "leisure",
    garden: "leisure",
    forest: "landuse",
    wood: "natural",
    nature_reserve: "leisure",
};

const NOISE_TAGS: Record<string, string> = {
    motorway: "highway",
    trunk: "highway",
    primary: "highway",
    rail: "railway",
    aerodrome: "aeroway",
    runway: "aeroway",
};

/** Facet-ID = tag-value (eindeutig ueber beide Tabellen). */
const ALL_NOISE_FACETS = [...Object.keys(QUIET_TAGS), ...Object.keys(NOISE_TAGS)];

function tagKeyForFacet(facet: string): string | null {
    if (facet in QUIET_TAGS) return QUIET_TAGS[facet];
    if (facet in NOISE_TAGS) return NOISE_TAGS[facet];
    return null;
}

function classifyElement(
    tags: Record<string, string>
): { isQuiet: boolean; type: string; subtype: string } | null {
    for (const [value, key] of Object.entries(QUIET_TAGS)) {
        if (tags[key] === value) return { isQuiet: true, type: key, subtype: value };
    }
    for (const [value, key] of Object.entries(NOISE_TAGS)) {
        if (tags[key] === value) return { isQuiet: false, type: key, subtype: value };
    }
    return null;
}

function assessNoise(quietCount: number, noiseCount: number): NoiseAssessment {
    if (noiseCount === 0) return "very quiet";
    const ratio = quietCount / noiseCount;
    if (ratio > 3) return "very quiet";
    if (ratio > 1.5) return "quiet";
    if (ratio > 0.7) return "moderate";
    if (ratio > 0.3) return "noisy";
    return "very noisy";
}

export class NoiseRetriever extends OsmFeatureRetriever<NoiseResult, typeof NoiseQueryPact> {
    protected readonly layer = "noise";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 2000;
    protected readonly queryPactClass = NoiseQueryPact;

    get name(): string {
        return NoiseRetriever.name;
    }

    get description(): string {
        return "Analyzes nearby quiet zones and noise sources via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NoiseQueryPact, d));
        const query = (queryDog?.collected as NoiseQuery | undefined) ?? ({} as NoiseQuery);
        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            facets: ALL_NOISE_FACETS,
        };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            const k = tagKeyForFacet(f);
            if (!k) continue;
            lines.push(`  node["${k}"="${f}"]${bboxClause};`);
            lines.push(`  way["${k}"="${f}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            const k = tagKeyForFacet(f);
            if (!k) continue;
            if (tags[k] === f) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): NoiseResult {
        const seen = new Set<string>();
        const quietZones: QuietZone[] = [];
        const noiseSources: NoiseSource[] = [];

        for (const el of elements) {
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const classification = classifyElement(el.tags);
            if (!classification) continue;

            const point = overpassElementRepresentativePoint(el);
            if (!point) continue;

            if (classification.isQuiet) {
                quietZones.push({
                    lat: point.lat,
                    lng: point.lng,
                    type: classification.subtype,
                    name: el.tags["name"],
                    area: el.tags["area"],
                });
            } else {
                noiseSources.push({
                    lat: point.lat,
                    lng: point.lng,
                    type: classification.type,
                    name: el.tags["name"],
                    subtype: classification.subtype,
                });
            }
        }

        const assessment = assessNoise(quietZones.length, noiseSources.length);

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            quietZones,
            noiseSources,
            profile: {
                quietZoneCount: quietZones.length,
                noiseSourceCount: noiseSources.length,
                assessment,
            },
        };
    }
}
