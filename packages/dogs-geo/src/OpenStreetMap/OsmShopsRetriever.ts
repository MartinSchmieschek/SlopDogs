/**
 * OSM shops — `shop=*` POIs. Default fetches every shop (`shop=*` wildcard).
 * Optional `shop: ['supermarket','bakery',…]` filters Overpass-side, narrows cache partition.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmShopsPact, type OsmShopsQueryInput } from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

/**
 * Curated set of common `shop=*` values — sourced from Taginfo top-in-wiki frequencies.
 * OSM has 300+ shop values in the long tail; this enum covers the everyday ones, and
 * any other value matching `[a-z0-9_:]+` is accepted as a custom long-tail tag.
 */
export enum OsmShopValue {
    Convenience = "convenience",
    Supermarket = "supermarket",
    Clothes = "clothes",
    Hairdresser = "hairdresser",
    CarRepair = "car_repair",
    Bakery = "bakery",
    Beauty = "beauty",
    Car = "car",
    Hardware = "hardware",
    Butcher = "butcher",
    Kiosk = "kiosk",
    MobilePhone = "mobile_phone",
    Furniture = "furniture",
    CarParts = "car_parts",
    Alcohol = "alcohol",
    VarietyStore = "variety_store",
    Florist = "florist",
    Electronics = "electronics",
    Optician = "optician",
    DoItYourself = "doityourself",
    Jewelry = "jewelry",
    Shoes = "shoes",
    Books = "books",
    Bicycle = "bicycle",
    Pet = "pet",
    Toys = "toys",
    Sports = "sports",
    Confectionery = "confectionery",
    SecondHand = "second_hand",
    Stationery = "stationery",
    Tobacco = "tobacco",
    Tattoo = "tattoo",
    Gift = "gift",
    Greengrocer = "greengrocer",
    Travel_Agency = "travel_agency",
    DryCleaning = "dry_cleaning",
    Tailor = "tailor",
    Laundry = "laundry",
    Wine = "wine",
    Beverages = "beverages",
}

const SHOP_SET = new Set<string>(Object.values(OsmShopValue));
const SHOP_ALL = "all";

function parseShopList(raw: unknown): string[] {
    if (raw == null) return [SHOP_ALL];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t || t === SHOP_ALL) return [SHOP_ALL];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed || parsed.length === 0) return [SHOP_ALL];
    if (parsed.includes(SHOP_ALL)) return [SHOP_ALL];
    // Accept enum values + any long-tail OSM shop value matching the standard tag shape.
    const out = parsed.filter((s) => SHOP_SET.has(s) || /^[a-z0-9_:]+$/.test(s));
    return out.length ? out : [SHOP_ALL];
}

export interface OsmShopsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    shop: string[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmShopsResultWithHelpers = OsmShopsResult & GeometryResultHelpers<OsmShopsResult>;

export class OsmShopsRetriever extends OsmFeatureRetriever<OsmShopsResult, typeof OsmShopsPact> {
    protected readonly layer = "shops";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmShopsPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmShopsRetriever.name;
    }

    get description(): string {
        return "Hunts shops within lat/lng/radius — `shop=*` POIs. Defaults to every shop (`shop: 'all'`); narrow via `shop: ['supermarket','bakery','butcher','clothes','books',…]` from the curated `OsmShopValue` enum, or pass any **custom OSM value** for long-tail tags (`'hifi'`, `'pottery'`, `'gas'`, …) — any value matching `[a-z0-9_:]+` is accepted. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `brand`, `operator`, `opening_hours`, `wheelchair`, `addr:*`, `phone`, `website`, `email`, `payment:*`, plus shop-specific (`organic`, `cuisine`, `clothes`, `second_hand`). Tile-cached per shop value.";
    }

    get icon(): string | undefined {
        return "🛒";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmShopsPact, d));
        const query = (queryDog?.collected as OsmShopsQueryInput | undefined) ?? ({} as OsmShopsQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const shop = parseShopList(query.shop);
        return { lat, lng, radiusM, facets: shop };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            if (f === SHOP_ALL) {
                lines.push(`  nwr["shop"]${bboxClause};`);
            } else {
                lines.push(`  nwr["shop"="${f}"]${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["shop"];
        if (!v) return [];
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            if (f === SHOP_ALL || f === v) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmShopsResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            shop: [...(q.facets ?? [])],
            geojson,
        };
    }

    protected postProcess(result: OsmShopsResult): OsmShopsResult {
        return attachGeometryHelpers(result);
    }
}
