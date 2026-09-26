/**
 * OSM boundaries — administrative borders (country/state/city/district) + protected areas
 * (national parks, nature reserves). Optional admin_level filter for administrative.
 *
 * Default fetches administrative + protected_area + leisure=nature_reserve.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmBoundariesPact, type OsmBoundariesQueryInput } from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export enum OsmBoundaryValue {
    Administrative = "administrative",
    ProtectedArea = "protected_area",
    NationalPark = "national_park",
    PoliticalN = "political",
    PostalCode = "postal_code",
    Religious = "religious_administration",
    Maritime = "maritime",
    /** Special pseudo-value: queries `leisure=nature_reserve` instead of `boundary=*`. */
    NatureReserve = "nature_reserve",
}

const BOUNDARY_SET = new Set<string>(Object.values(OsmBoundaryValue));

const DEFAULT_BOUNDARIES: readonly OsmBoundaryValue[] = [
    OsmBoundaryValue.Administrative,
    OsmBoundaryValue.ProtectedArea,
    OsmBoundaryValue.NatureReserve,
];

function parseBoundaryList(raw: unknown): OsmBoundaryValue[] {
    if (raw == null) return [...DEFAULT_BOUNDARIES];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_BOUNDARIES];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_BOUNDARIES];
    const out: OsmBoundaryValue[] = [];
    for (const s of parsed) if (BOUNDARY_SET.has(s)) out.push(s as OsmBoundaryValue);
    return out.length ? out : [...DEFAULT_BOUNDARIES];
}

function parseAdminLevels(raw: unknown): number[] | null {
    if (raw == null) return null;
    let parsed: unknown[] | null = null;
    if (Array.isArray(raw)) parsed = raw;
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return null;
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j;
            else if (typeof j === "number") return [j];
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return null;
    const out: number[] = [];
    for (const v of parsed) {
        const n = typeof v === "number" ? v : parseInt(String(v), 10);
        if (Number.isFinite(n) && n >= 1 && n <= 12) out.push(n);
    }
    return out.length ? out : null;
}

export interface OsmBoundariesResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    boundary: OsmBoundaryValue[];
    adminLevel: number[] | null;
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmBoundariesResultWithHelpers = OsmBoundariesResult & GeometryResultHelpers<OsmBoundariesResult>;

export class OsmBoundariesRetriever extends OsmFeatureRetriever<OsmBoundariesResult, typeof OsmBoundariesPact> {
    protected readonly layer = "boundaries";
    protected readonly defaultRadiusM = 2000;
    protected readonly maxRadiusM = 20000;
    protected readonly queryPactClass = OsmBoundariesPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmBoundariesRetriever.name;
    }

    get description(): string {
        return "Hunts administrative boundaries and protected areas — country/state/city/district borders (`boundary=administrative` with `admin_level=2..11`), national parks, nature reserves, protected_area zones. Defaults to administrative + protected_area + nature_reserve. `boundary` values are validated against the `OsmBoundaryValue` enum — special-case routing (e.g. `nature_reserve` → `leisure=nature_reserve` query). `adminLevel: [4,6,8]` restricts admin levels (country/state/county/city granularity). `simplify(m)` thins vertices, `merge()` unions polygons. Each feature's `properties` carries all OSM tags — `name`, `name:en`, `name:de`, `wikidata`, `wikipedia`, `admin_level`, `boundary`, `protect_class`, `protection_title`, `iso3166_1`. Tile-cached per boundary value.";
    }

    get icon(): string | undefined {
        return "🗺️";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmBoundariesPact, d));
        const query = (queryDog?.collected as OsmBoundariesQueryInput | undefined) ?? ({} as OsmBoundariesQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const boundary = parseBoundaryList(query.boundary);
        const adminLevels = parseAdminLevels(query.adminLevel);
        const facets: string[] = [];
        for (const b of boundary) {
            if (b === OsmBoundaryValue.Administrative && adminLevels) {
                for (const lvl of adminLevels) facets.push(`admin:${lvl}`);
            } else {
                facets.push(b);
            }
        }
        return { lat, lng, radiusM, facets };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const f of facets) {
            if (f.startsWith("admin:")) {
                const lvl = f.slice("admin:".length);
                lines.push(`  relation["boundary"="administrative"]["admin_level"="${lvl}"]${bboxClause};`);
            } else if (f === OsmBoundaryValue.NatureReserve) {
                lines.push(`  way["leisure"="nature_reserve"]${bboxClause};`);
                lines.push(`  relation["leisure"="nature_reserve"]${bboxClause};`);
            } else {
                lines.push(`  way["boundary"="${f}"]${bboxClause};`);
                lines.push(`  relation["boundary"="${f}"]${bboxClause};`);
            }
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        for (const f of fetchedFacets) {
            if (f.startsWith("admin:")) {
                const lvl = f.slice("admin:".length);
                if (tags["boundary"] === "administrative" && tags["admin_level"] === lvl) matches.push(f);
            } else if (f === OsmBoundaryValue.NatureReserve) {
                if (tags["leisure"] === "nature_reserve") matches.push(f);
            } else if (tags["boundary"] === f) {
                matches.push(f);
            }
        }
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmBoundariesResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const boundary = new Set<OsmBoundaryValue>();
        const adminLevels = new Set<number>();
        for (const f of q.facets ?? []) {
            if (f.startsWith("admin:")) {
                boundary.add(OsmBoundaryValue.Administrative);
                const n = parseInt(f.slice("admin:".length), 10);
                if (Number.isFinite(n)) adminLevels.add(n);
            } else {
                boundary.add(f as OsmBoundaryValue);
            }
        }
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            boundary: Array.from(boundary),
            adminLevel: adminLevels.size > 0 ? Array.from(adminLevels).sort() : null,
            geojson,
        };
    }

    protected postProcess(result: OsmBoundariesResult): OsmBoundariesResult {
        return attachGeometryHelpers(result);
    }
}
