import { IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import {
    type OverpassRawElement,
    overpassElementRepresentativePoint,
} from "../base/overpassMirrorChain";
import { DrinkingWaterQueryPact, type DrinkingWaterQuery } from "./pacts";

export type DrinkingWaterFacilityType = "drinking_water" | "toilet" | "water_point" | "water_tap";

export interface DrinkingWaterFacility {
    lat: number;
    lng: number;
    type: DrinkingWaterFacilityType;
    name?: string;
    fee?: string;
    wheelchair?: string;
    opening_hours?: string;
    tags: Record<string, string>;
}

export interface DrinkingWaterResult {
    center: { lat: number; lng: number };
    radiusM: number;
    facilities: DrinkingWaterFacility[];
    counts: {
        drinkingWater: number;
        toilet: number;
        waterPoint: number;
        waterTap: number;
        total: number;
    };
}

/** Jede Facility-Art als eigene Facet — getrennt cachen, zusammen ausliefern. */
const FACET_TAGS: Record<string, { key: string; value: string }> = {
    drinking_water: { key: "amenity", value: "drinking_water" },
    toilet: { key: "amenity", value: "toilets" },
    water_point: { key: "amenity", value: "water_point" },
    water_tap: { key: "man_made", value: "water_tap" },
};

const ALL_FACETS = Object.keys(FACET_TAGS);

function classifyFacilityType(tags: Record<string, string>): DrinkingWaterFacilityType {
    if (tags["man_made"] === "water_tap") return "water_tap";
    const amenity = tags["amenity"] ?? "";
    if (amenity === "drinking_water") return "drinking_water";
    if (amenity === "toilets") return "toilet";
    if (amenity === "water_point") return "water_point";
    return "drinking_water";
}

export class DrinkingWaterRetriever extends OsmFeatureRetriever<DrinkingWaterResult, typeof DrinkingWaterQueryPact> {
    protected readonly layer = "drinking-water";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 3000;
    protected readonly queryPactClass = DrinkingWaterQueryPact;

    get name(): string {
        return DrinkingWaterRetriever.name;
    }

    get description(): string {
        return "Finds nearby drinking water fountains, water points and public toilets via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(DrinkingWaterQueryPact, d));
        const query = (queryDog?.collected as DrinkingWaterQuery | undefined) ?? ({} as DrinkingWaterQuery);
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
            // Toilets/drinking_water koennen auch als Way getaggt sein.
            if (f === "drinking_water" || f === "toilet") {
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

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): DrinkingWaterResult {
        const seen = new Set<string>();
        const facilities: DrinkingWaterFacility[] = [];

        for (const el of elements) {
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const point = overpassElementRepresentativePoint(el);
            if (!point) continue;

            facilities.push({
                lat: point.lat,
                lng: point.lng,
                type: classifyFacilityType(el.tags),
                name: el.tags["name"],
                fee: el.tags["fee"],
                wheelchair: el.tags["wheelchair"],
                opening_hours: el.tags["opening_hours"],
                tags: el.tags,
            });
        }

        const counts = {
            drinkingWater: facilities.filter((f) => f.type === "drinking_water").length,
            toilet: facilities.filter((f) => f.type === "toilet").length,
            waterPoint: facilities.filter((f) => f.type === "water_point").length,
            waterTap: facilities.filter((f) => f.type === "water_tap").length,
            total: facilities.length,
        };

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            facilities,
            counts,
        };
    }
}
