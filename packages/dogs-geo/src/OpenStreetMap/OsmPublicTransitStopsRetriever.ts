/**
 * OSM public-transit stops — bus stops, tram stops, train halts, subway entrances,
 * bus stations, ferry terminals, generic public_transport platforms/stop_positions.
 * Aggregates across three OSM tagging schemes:
 *   - `highway=bus_stop`            (legacy bus stops)
 *   - `railway=tram_stop|halt|station`  (rail-side)
 *   - `public_transport=stop_position|platform|station`  (modern PT schema)
 *
 * `kinds` selects which transit types to fetch; each kind expands to one or more facets.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import {
    OsmPublicTransitStopsPact,
    type OsmPublicTransitStopsQueryInput,
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

export enum OsmTransitKind {
    Bus = "bus",
    Tram = "tram",
    Subway = "subway",
    Train = "train",
    LightRail = "light_rail",
    Monorail = "monorail",
    Ferry = "ferry",
    BusStation = "bus_station",
    Aerialway = "aerialway",
    Taxi = "taxi",
}

const TRANSIT_KIND_SET = new Set<string>(Object.values(OsmTransitKind));

const DEFAULT_KINDS: readonly OsmTransitKind[] = [
    OsmTransitKind.Bus,
    OsmTransitKind.Tram,
    OsmTransitKind.Subway,
    OsmTransitKind.Train,
    OsmTransitKind.BusStation,
];

function parseKindsList(raw: unknown): OsmTransitKind[] {
    if (raw == null) return [...DEFAULT_KINDS];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_KINDS];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_KINDS];
    const out: OsmTransitKind[] = [];
    for (const s of parsed) if (TRANSIT_KIND_SET.has(s)) out.push(s as OsmTransitKind);
    return out.length ? out : [...DEFAULT_KINDS];
}

/** Per kind, the Overpass tag filters that select stops for that kind. */
const KIND_FILTERS: Record<OsmTransitKind, ReadonlyArray<{ key: string; value: string }>> = {
    [OsmTransitKind.Bus]: [
        { key: "highway", value: "bus_stop" },
        { key: "public_transport", value: "platform" },
    ],
    [OsmTransitKind.Tram]: [{ key: "railway", value: "tram_stop" }],
    [OsmTransitKind.Subway]: [{ key: "station", value: "subway" }],
    [OsmTransitKind.Train]: [
        { key: "railway", value: "station" },
        { key: "railway", value: "halt" },
    ],
    [OsmTransitKind.LightRail]: [{ key: "station", value: "light_rail" }],
    [OsmTransitKind.Monorail]: [{ key: "station", value: "monorail" }],
    [OsmTransitKind.Ferry]: [{ key: "amenity", value: "ferry_terminal" }],
    [OsmTransitKind.BusStation]: [{ key: "amenity", value: "bus_station" }],
    [OsmTransitKind.Aerialway]: [{ key: "aerialway", value: "station" }],
    [OsmTransitKind.Taxi]: [{ key: "amenity", value: "taxi" }],
};

export interface OsmPublicTransitStopsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    kinds: OsmTransitKind[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmPublicTransitStopsResultWithHelpers = OsmPublicTransitStopsResult & GeometryResultHelpers<OsmPublicTransitStopsResult>;

export class OsmPublicTransitStopsRetriever extends OsmFeatureRetriever<OsmPublicTransitStopsResult, typeof OsmPublicTransitStopsPact> {
    protected readonly layer = "transitStops";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 5000;
    protected readonly queryPactClass = OsmPublicTransitStopsPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmPublicTransitStopsRetriever.name;
    }

    get description(): string {
        return "Hunts public-transit stop points within lat/lng/radius — bus stops, tram stops, train stations/halts, subway entrances, ferry terminals, bus stations, aerialway stations, taxi stands. Aggregates across legacy and modern PT tag schemes (`highway=bus_stop`, `railway=tram_stop|halt|station`, `public_transport=*`, `amenity=bus_station|ferry_terminal`). Defaults to bus + tram + subway + train + bus_station; switch via `kinds: ['ferry','taxi',…]`. **Only `OsmTransitKind` enum values** are accepted — each kind triggers a kind-specific multi-tag fetch (custom strings would have no fetch rule). `simplify(m)` thins vertices. Each feature's `properties` carries all OSM tags — `name`, `ref` (Haltestelle-Nummer), `network`, `operator`, `wheelchair`, `shelter`, `bench`, `bin`, `tactile_paving`, `departures_board`, `route_ref`. Tile-cached per transit kind.";
    }

    get icon(): string | undefined {
        return "🚌";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmPublicTransitStopsPact, d));
        const query = (queryDog?.collected as OsmPublicTransitStopsQueryInput | undefined) ?? ({} as OsmPublicTransitStopsQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const kinds = parseKindsList(query.kinds);
        return { lat, lng, radiusM, facets: [...kinds] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const kind of facets) {
            const filters = KIND_FILTERS[kind as OsmTransitKind];
            if (!filters) continue;
            for (const f of filters) {
                lines.push(`  nwr["${f.key}"="${f.value}"]${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const kind of fetchedFacets) {
            const filters = KIND_FILTERS[kind as OsmTransitKind];
            if (!filters) continue;
            for (const f of filters) {
                if (tags[f.key] === f.value) {
                    matches.push(kind);
                    break;
                }
            }
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmPublicTransitStopsResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const kinds = (q.facets ?? []) as OsmTransitKind[];
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            kinds,
            geojson,
        };
    }

    protected postProcess(result: OsmPublicTransitStopsResult): OsmPublicTransitStopsResult {
        return attachGeometryHelpers(result);
    }
}
