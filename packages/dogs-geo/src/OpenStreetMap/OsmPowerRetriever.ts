/**
 * OSM power-grid features — high-voltage lines, towers, poles, substations, plants, generators.
 * Mixed geometry: line/cable as ways, towers/poles/generators as nodes, substations/plants as ways/relations.
 */

import { type IHuntingSeason } from "@slopdogs/core";
import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { OsmFeatureRetriever, type OsmQueryBase } from "../osm/base/OsmFeatureRetriever";
import type { OverpassRawElement } from "../osm/base/overpassMirrorChain";
import { OsmPowerPact, type OsmPowerQueryInput } from "./osmGeometryPacts";
import {
    circleToBoundingBox,
    clampGeometryRadiusM,
    type BoundingBox,
} from "./overpassGeometryCore";
import {
    attachGeometryHelpers,
    type GeometryResultHelpers,
} from "./osmGeometryHelpers";

export enum OsmPowerValue {
    Line = "line",
    MinorLine = "minor_line",
    Cable = "cable",
    Tower = "tower",
    Pole = "pole",
    Substation = "substation",
    Transformer = "transformer",
    Plant = "plant",
    Generator = "generator",
    Switch = "switch",
    Portal = "portal",
}

const POWER_SET = new Set<string>(Object.values(OsmPowerValue));

const DEFAULT_POWER: readonly OsmPowerValue[] = [
    OsmPowerValue.Line,
    OsmPowerValue.MinorLine,
    OsmPowerValue.Tower,
    OsmPowerValue.Substation,
    OsmPowerValue.Generator,
];

function parsePowerList(raw: unknown): OsmPowerValue[] {
    if (raw == null) return [...DEFAULT_POWER];
    let parsed: string[] | null = null;
    if (Array.isArray(raw)) parsed = raw.map((x) => String(x).trim()).filter(Boolean);
    else if (typeof raw === "string") {
        const t = raw.trim();
        if (!t) return [...DEFAULT_POWER];
        try {
            const j = JSON.parse(t) as unknown;
            if (Array.isArray(j)) parsed = j.map((x) => String(x).trim()).filter(Boolean);
            else parsed = [t];
        } catch {
            parsed = [t];
        }
    }
    if (!parsed) return [...DEFAULT_POWER];
    const out: string[] = [];
    for (const s of parsed) if (POWER_SET.has(s) || /^[a-z0-9_:]+$/.test(s)) out.push(s);
    return (out.length ? out : [...DEFAULT_POWER]) as OsmPowerValue[];
}

export interface OsmPowerResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    power: OsmPowerValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export type OsmPowerResultWithHelpers = OsmPowerResult & GeometryResultHelpers<OsmPowerResult>;

export class OsmPowerRetriever extends OsmFeatureRetriever<OsmPowerResult, typeof OsmPowerPact> {
    protected readonly layer = "power";
    protected readonly defaultRadiusM = 2000;
    protected readonly maxRadiusM = 20000;
    protected readonly queryPactClass = OsmPowerPact;
    protected readonly outStatement = "out geom;";

    get name(): string {
        return OsmPowerRetriever.name;
    }

    get description(): string {
        return "Hunts power-grid infrastructure within lat/lng/radius — high-voltage lines, minor distribution lines, towers (Strommasten), poles, substations, transformers, power plants, generators (Windkraft / PV). Defaults to line + minor_line + tower + substation + generator. Pass `power: [...]` from `OsmPowerValue` or any **custom OSM value** matching `[a-z0-9_:]+`. `simplify(m)` thins vertices. Each feature's `properties` carries all OSM tags — `voltage`, `cables`, `frequency`, `circuits`, `wires`, `operator`, `name`, `ref`, `start_date`, `material`, plus generator-specific (`generator:source` wind/solar/nuclear/biomass, `generator:output:electricity`, `manufacturer`, `model`, `rotor:diameter`). Tile-cached per power value.";
    }

    get icon(): string | undefined {
        return "⚡";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmPowerPact, d));
        const query = (queryDog?.collected as OsmPowerQueryInput | undefined) ?? ({} as OsmPowerQueryInput);
        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const power = parsePowerList(query.power);
        return { lat, lng, radiusM, facets: [...power] };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];
        for (const v of facets) {
            lines.push(`  nwr["power"="${v}"]${bboxClause};`);
        }
        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const v = el.tags?.["power"];
        if (!v) return [];
        return fetchedFacets.filter((f) => f === v);
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OsmPowerResult {
        const bbox = circleToBoundingBox(q.lat, q.lng, q.radiusM);
        const power = (q.facets ?? []) as OsmPowerValue[];
        const geojson = osmtogeojson({ elements: elements as any }) as FeatureCollection<GeometryObject>;
        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            bbox,
            power,
            geojson,
        };
    }

    protected postProcess(result: OsmPowerResult): OsmPowerResult {
        return attachGeometryHelpers(result);
    }
}
