/**
 * OSM sports & recreation — `leisure=*` facilities (sports_centre, pitch, track, swimming_pool,
 * fitness_centre, golf_course, stadium, …). Optional post-filter by `sport=*` tag.
 *
 * Tile-cached pro leisure-Value.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import {
    OsmSportsRecreationPact,
    type OsmSportsRecreationQueryInput,
} from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export enum OsmLeisureValue {
    SportsCentre = "sports_centre",
    FitnessCentre = "fitness_centre",
    FitnessStation = "fitness_station",
    Pitch = "pitch",
    Track = "track",
    SwimmingPool = "swimming_pool",
    GolfCourse = "golf_course",
    MiniatureGolf = "miniature_golf",
    Stadium = "stadium",
    SportsHall = "sports_hall",
    HorseRiding = "horse_riding",
    IceRink = "ice_rink",
    BowlingAlley = "bowling_alley",
    Marina = "marina",
    SaunaN = "sauna",
    // Recreation / leisure (non-sports) — common Taginfo values
    Park = "park",
    Garden = "garden",
    Playground = "playground",
    PicnicTable = "picnic_table",
    PicnicSite = "picnic_site",
    NatureReserve = "nature_reserve",
    Bleachers = "bleachers",
    Firepit = "firepit",
    OutdoorSeating = "outdoor_seating",
    Slipway = "slipway",
    CommonE = "common",
    Beach_Resort = "beach_resort",
    DogPark = "dog_park",
    WaterPark = "water_park",
    AmusementArcade = "amusement_arcade",
    EscapeGame = "escape_game",
    Hackerspace = "hackerspace",
}

const LEISURE_SET = new Set<string>(Object.values(OsmLeisureValue));

const DEFAULT_LEISURE: readonly OsmLeisureValue[] = [
    OsmLeisureValue.SportsCentre,
    OsmLeisureValue.Pitch,
    OsmLeisureValue.Track,
    OsmLeisureValue.SwimmingPool,
    OsmLeisureValue.FitnessCentre,
    OsmLeisureValue.Stadium,
];

function parseLeisureList(raw: unknown): OsmLeisureValue[] {
    if (raw == null) return [...DEFAULT_LEISURE];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_LEISURE];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_LEISURE];
    // Accept enum values + any long-tail OSM leisure value matching the standard tag shape.
    const out: string[] = [];
    for (const s of parsed) if (LEISURE_SET.has(s) || /^[a-z0-9_:]+$/.test(s)) out.push(s);
    return (out.length ? out : [...DEFAULT_LEISURE]) as OsmLeisureValue[];
}

function parseSportList(raw: unknown): string[] | null {
    if (raw == null) return null;
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return null;
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    return parsed && parsed.length > 0 ? parsed : null;
}

export interface OsmSportsRecreationResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    leisure: OsmLeisureValue[];
    sport: string[] | null;
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmSportsRecreationResultWithHelpers = OsmSportsRecreationResult & GeometryResultHelpers<OsmSportsRecreationResult>;

export class OsmSportsRecreationRetriever extends OsmFeatureRetriever<OsmSportsRecreationResult, typeof OsmSportsRecreationPact> {
    protected readonly layer = "sportsRec";
    protected readonly defaultRadiusM = 1000;
    protected readonly maxRadiusM = 10000;
    protected readonly queryPactClass = OsmSportsRecreationPact;
    protected readonly outStatement = "out geom;";

    private sportFilter: string[] | null = null;

    get name(): string {
        return OsmSportsRecreationRetriever.name;
    }

    get description(): string {
        return "Hunts sports & recreation features within lat/lng/radius — sports centres, pitches, tracks, swimming pools, fitness centres, golf courses, stadiums, ice rinks, marinas, plus broader leisure (parks, gardens, playgrounds, picnic tables, nature reserves, dog parks, water parks). Defaults to sports_centre + pitch + track + swimming_pool + fitness_centre + stadium. Pass `leisure: [...]` from `OsmLeisureValue` or any **custom OSM value** matching `[a-z0-9_:]+`. Filter by sport via `sport: ['football','tennis','swimming']`. `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `sport`, `surface`, `opening_hours`, `fee`, `access`, `wheelchair`, `lit`, `operator`, `capacity`, `wikidata`. Tile-cached per leisure value.";
    }

    get icon(): string | undefined {
        return "🏃";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmSportsRecreationPact, d));
        const query = (queryDog?.collected as OsmSportsRecreationQueryInput | undefined) ?? ({} as OsmSportsRecreationQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const leisure = parseLeisureList(query.leisure);
        this.sportFilter = parseSportList(query.sport);
        return { lat, lng, radiusM, facets: [...leisure] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const v of facets) {
            lines.push(`  nwr["leisure"="${v}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["leisure"];
        if (!v) return [];
        return fetchedFacets.filter((f) => f === v);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmSportsRecreationResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const leisure = (q.facets ?? []) as OsmLeisureValue[];

        const filtered = this.sportFilter
            ? elements.filter((el) => {
                  const s = el.tags?.["sport"];
                  if (!s) return false;
                  // `sport` may be semicolon-separated list per OSM convention.
                  const set = s.split(";").map((x) => x.trim());
                  return set.some((x) => this.sportFilter!.includes(x));
              })
            : elements;

        const geojson = osmtogeojson({ elements: filtered as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            leisure,
            sport: this.sportFilter,
            geojson,
        };
    }

    protected postProcess(result: OsmSportsRecreationResult): OsmSportsRecreationResult {
        return attachGeometryHelpers(result);
    }
}
