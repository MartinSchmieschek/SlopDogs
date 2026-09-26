import { IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import {
    type OverpassRawElement,
    overpassElementRepresentativePoint,
} from "../base/overpassMirrorChain";
import { PlaygroundQueryPact, type PlaygroundQuery } from "./pacts";

export type PlaygroundPlaceType =
    | "playground"
    | "sports_centre"
    | "fitness"
    | "dog_park"
    | "pitch"
    | "pool";

export interface PlaygroundPlace {
    lat: number;
    lng: number;
    type: PlaygroundPlaceType;
    name?: string;
    sport?: string;
    access?: string;
    tags: Record<string, string>;
}

export interface PlaygroundResult {
    center: { lat: number; lng: number };
    radiusM: number;
    places: PlaygroundPlace[];
    counts: {
        playground: number;
        sportsCentre: number;
        fitness: number;
        dogPark: number;
        pitch: number;
        pool: number;
        total: number;
    };
}

function classifyPlaceType(tags: Record<string, string>): PlaygroundPlaceType {
    const leisure = tags["leisure"] ?? "";
    if (leisure === "playground") return "playground";
    if (leisure === "sports_centre") return "sports_centre";
    if (leisure === "fitness_station") return "fitness";
    if (leisure === "dog_park") return "dog_park";
    if (leisure === "pitch") return "pitch";
    if (leisure === "swimming_pool") return "pool";
    return "playground";
}

const LEISURE_VALUES = [
    "playground",
    "sports_centre",
    "fitness_station",
    "dog_park",
    "pitch",
    "swimming_pool",
];

export class PlaygroundRetriever extends OsmFeatureRetriever<PlaygroundResult, typeof PlaygroundQueryPact> {
    protected readonly layer = "playground";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 3000;
    protected readonly queryPactClass = PlaygroundQueryPact;

    get name(): string {
        return PlaygroundRetriever.name;
    }

    get description(): string {
        return "Finds nearby playgrounds, sports facilities, dog parks and swimming pools via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(PlaygroundQueryPact, d));
        const query = (queryDog?.collected as PlaygroundQuery | undefined) ?? ({} as PlaygroundQuery);
        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            facets: [...LEISURE_VALUES],
        };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const value of facets) {
            lines.push(`  node["leisure"="${value}"]${bboxClause};`);
            lines.push(`  way["leisure"="${value}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const leisure = el.tags?.["leisure"];
        if (!leisure) return [];
        return fetchedFacets.filter((f) => f === leisure);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): PlaygroundResult {
        const seen = new Set<string>();
        const places: PlaygroundPlace[] = [];

        for (const el of elements) {
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const point = overpassElementRepresentativePoint(el);
            if (!point) continue;

            places.push({
                lat: point.lat,
                lng: point.lng,
                type: classifyPlaceType(el.tags),
                name: el.tags["name"],
                sport: el.tags["sport"],
                access: el.tags["access"],
                tags: el.tags,
            });
        }

        const counts = {
            playground: places.filter((p) => p.type === "playground").length,
            sportsCentre: places.filter((p) => p.type === "sports_centre").length,
            fitness: places.filter((p) => p.type === "fitness").length,
            dogPark: places.filter((p) => p.type === "dog_park").length,
            pitch: places.filter((p) => p.type === "pitch").length,
            pool: places.filter((p) => p.type === "pool").length,
            total: places.length,
        };

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            places,
            counts,
        };
    }
}
