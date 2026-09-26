import { IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import {
    type OverpassRawElement,
    overpassElementRepresentativePoint,
} from "../base/overpassMirrorChain";
import { ParkingQueryPact, type ParkingQuery } from "./pacts";

export type ParkingSpotType = "car" | "bicycle" | "motorcycle" | "park_ride";

export interface ParkingSpot {
    lat: number;
    lng: number;
    type: ParkingSpotType;
    name?: string;
    capacity?: string;
    access?: string;
    fee?: string;
    tags: Record<string, string>;
}

export interface ParkingResult {
    center: { lat: number; lng: number };
    radiusM: number;
    spots: ParkingSpot[];
    counts: {
        car: number;
        bicycle: number;
        motorcycle: number;
        parkRide: number;
        total: number;
    };
}

function classifyParkingType(tags: Record<string, string>): ParkingSpotType {
    if (tags["park_ride"] === "yes") return "park_ride";
    if (tags["amenity"] === "bicycle_parking") return "bicycle";
    if (tags["amenity"] === "motorcycle_parking") return "motorcycle";
    return "car";
}

const FACET_TAGS: Record<string, { key: string; value: string }> = {
    car: { key: "amenity", value: "parking" },
    bicycle: { key: "amenity", value: "bicycle_parking" },
    motorcycle: { key: "amenity", value: "motorcycle_parking" },
    park_ride: { key: "park_ride", value: "yes" },
};

const ALL_FACETS = Object.keys(FACET_TAGS);

export class ParkingRetriever extends OsmFeatureRetriever<ParkingResult, typeof ParkingQueryPact> {
    protected readonly layer = "parking";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 3000;
    protected readonly queryPactClass = ParkingQueryPact;

    get name(): string {
        return ParkingRetriever.name;
    }

    get description(): string {
        return "Finds nearby parking spots, bicycle parking, P+R and motorcycle parking via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(ParkingQueryPact, d));
        const query = (queryDog?.collected as ParkingQuery | undefined) ?? ({} as ParkingQuery);
        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            facets: ALL_FACETS,
        };
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
            lines.push(`  node["${c.key}"="${c.value}"]${bboxClause};`);
            if (f === "car") {
                lines.push(`  way["${c.key}"="${c.value}"]${bboxClause};`);
            }
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

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): ParkingResult {
        const seen = new Set<string>();
        const spots: ParkingSpot[] = [];

        for (const el of elements) {
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const point = overpassElementRepresentativePoint(el);
            if (!point) continue;

            spots.push({
                lat: point.lat,
                lng: point.lng,
                type: classifyParkingType(el.tags),
                name: el.tags["name"],
                capacity: el.tags["capacity"],
                access: el.tags["access"],
                fee: el.tags["fee"],
                tags: el.tags,
            });
        }

        const counts = {
            car: spots.filter((s) => s.type === "car").length,
            bicycle: spots.filter((s) => s.type === "bicycle").length,
            motorcycle: spots.filter((s) => s.type === "motorcycle").length,
            parkRide: spots.filter((s) => s.type === "park_ride").length,
            total: spots.length,
        };

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            spots,
            counts,
        };
    }
}
