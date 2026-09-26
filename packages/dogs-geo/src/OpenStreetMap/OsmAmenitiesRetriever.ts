/**
 * OSM amenities — the broad everyday-life POI hunt. Schools, hospitals, restaurants,
 * banks, fuel, police, fire stations, libraries, etc. Complements OsmLandmarksRetriever
 * (which covers tourism + historic + nature landmarks).
 *
 * Tile-cached pro amenity-Value. Mit `amenity: 'all'` werden alle `amenity=*`
 * Elemente geholt (Cache-Partition `all` — keine Filterung in Overpass).
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmAmenitiesPact, type OsmAmenitiesQueryInput } from "./osmGeometryPacts";
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
 * Curated set of everyday amenities. Anything that doesn't fit the tourism/historic
 * scope of OsmLandmarksRetriever and isn't shop/leisure/healthcare is welcome here.
 */
export enum OsmAmenityValue {
    // Food & Drink
    Restaurant = "restaurant",
    Cafe = "cafe",
    FastFood = "fast_food",
    Bar = "bar",
    Pub = "pub",
    BiergartenN = "biergarten",
    IceCream = "ice_cream",
    FoodCourt = "food_court",
    // Education
    School = "school",
    Kindergarten = "kindergarten",
    University = "university",
    College = "college",
    Library = "library",
    DrivingSchool = "driving_school",
    LanguageSchool = "language_school",
    MusicSchool = "music_school",
    // Healthcare (broad strokes; OsmHealthcareRetriever could specialize later)
    Hospital = "hospital",
    Clinic = "clinic",
    Doctors = "doctors",
    Dentist = "dentist",
    Pharmacy = "pharmacy",
    Veterinary = "veterinary",
    // Public services
    Police = "police",
    FireStation = "fire_station",
    PostOffice = "post_office",
    Townhall = "townhall",
    Courthouse = "courthouse",
    Embassy = "embassy",
    SocialFacility = "social_facility",
    // Money
    Bank = "bank",
    Atm = "atm",
    BureauDeChange = "bureau_de_change",
    // Mobility
    Fuel = "fuel",
    Parking = "parking",
    BicycleParking = "bicycle_parking",
    BicycleRental = "bicycle_rental",
    CarRental = "car_rental",
    CarSharing = "car_sharing",
    ChargingStation = "charging_station",
    Taxi = "taxi",
    // Religion & culture
    PlaceOfWorship = "place_of_worship",
    CommunityCentre = "community_centre",
    ArtsCentre = "arts_centre",
    Theatre = "theatre",
    Cinema = "cinema",
    Nightclub = "nightclub",
    // Sanitation & waste
    Toilets = "toilets",
    DrinkingWater = "drinking_water",
    Shower = "shower",
    WasteBasket = "waste_basket",
    WasteDisposal = "waste_disposal",
    WasteTransferStation = "waste_transfer_station",
    Recycling = "recycling",
    SanitaryDumpStation = "sanitary_dump_station",
    // Parking detail
    ParkingSpace = "parking_space",
    ParkingEntrance = "parking_entrance",
    MotorcycleParking = "motorcycle_parking",
    // Mail
    PostBox = "post_box",
    LetterBox = "letter_box",
    // Misc useful
    Bench = "bench",
    Shelter = "shelter",
    Fountain = "fountain",
    ClockE = "clock",
    Bbq = "bbq",
    VendingMachine = "vending_machine",
    Marketplace = "marketplace",
    HuntingStand = "hunting_stand",
    Telephone = "telephone",
    PublicBath = "public_bath",
    Studio = "studio",
}

const AMENITY_SET = new Set<string>(Object.values(OsmAmenityValue));

/** Defaults — high-impact everyday amenities for general "what's around" maps. */
const DEFAULT_AMENITIES: readonly OsmAmenityValue[] = [
    OsmAmenityValue.Restaurant,
    OsmAmenityValue.Cafe,
    OsmAmenityValue.FastFood,
    OsmAmenityValue.Bar,
    OsmAmenityValue.School,
    OsmAmenityValue.Kindergarten,
    OsmAmenityValue.Hospital,
    OsmAmenityValue.Pharmacy,
    OsmAmenityValue.Police,
    OsmAmenityValue.FireStation,
    OsmAmenityValue.PostOffice,
    OsmAmenityValue.Bank,
    OsmAmenityValue.Atm,
    OsmAmenityValue.Fuel,
    OsmAmenityValue.ChargingStation,
    OsmAmenityValue.Library,
    OsmAmenityValue.PlaceOfWorship,
    OsmAmenityValue.Toilets,
];

const AMENITY_ALL = "all";

function parseAmenityList(raw: unknown): string[] {
    if (raw == null) return [...DEFAULT_AMENITIES];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_AMENITIES];
        if (t === AMENITY_ALL) return [AMENITY_ALL];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_AMENITIES];
    if (parsed.includes(AMENITY_ALL)) return [AMENITY_ALL];
    // Allow caller-supplied values even if not in our curated enum — OSM has long tail.
    // Any valid OSM tag value matching the standard `[a-z0-9_:]+` shape is accepted.
    const out = parsed.filter((s) => s.length > 0 && (AMENITY_SET.has(s) || /^[a-z0-9_:]+$/.test(s)));
    return out.length ? out : [...DEFAULT_AMENITIES];
}

export interface OsmAmenitiesResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    amenity: string[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmAmenitiesResultWithHelpers = OsmAmenitiesResult & GeometryResultHelpers<OsmAmenitiesResult>;

export class OsmAmenitiesRetriever extends OsmFeatureRetriever<OsmAmenitiesResult, typeof OsmAmenitiesPact> {
    protected readonly layer = "amenities";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmAmenitiesPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmAmenitiesRetriever.name;
    }

    get description(): string {
        return "Hunts everyday-life amenity POIs — restaurants, cafes, schools, hospitals, pharmacies, banks, ATMs, fuel, charging stations, police, fire stations, post offices, libraries, places of worship, toilets, parking, waste_basket, waste_disposal, recycling, etc. Defaults to a curated everyday set; pass `amenity: [...]` for a custom list, `amenity: 'all'` for every `amenity=*`, or any **custom OSM value** (e.g. `'waste_transfer_station'`, `'hunting_stand'`) — values outside the curated enum that still match `[a-z0-9_:]+` are accepted as long-tail tags. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `cuisine`, `opening_hours`, `wheelchair`, `phone`, `website`, `email`, `addr:*`, `operator`, `brand`, `wikidata`. Tile-cached per amenity value.";
    }

    get icon(): string | undefined {
        return "🍔";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmAmenitiesPact, d));
        const query = (queryDog?.collected as OsmAmenitiesQueryInput | undefined) ?? ({} as OsmAmenitiesQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const amenity = parseAmenityList(query.amenity);
        return { lat, lng, radiusM, facets: amenity };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            if (f === AMENITY_ALL) {
                lines.push(`  nwr["amenity"]${bboxClause};`);
            } else {
                lines.push(`  nwr["amenity"="${f}"]${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["amenity"];
        if (!v) return [];
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            if (f === AMENITY_ALL || f === v) matches.push(f);
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmAmenitiesResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            amenity: [...(q.facets ?? [])],
            geojson,
        };
    }

    protected postProcess(result: OsmAmenitiesResult): OsmAmenitiesResult {
        return attachGeometryHelpers(result);
    }
}
