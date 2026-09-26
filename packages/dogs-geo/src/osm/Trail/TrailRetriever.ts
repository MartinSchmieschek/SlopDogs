import { IHuntingSeason } from "@slopdogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import { type OverpassRawElement } from "../base/overpassMirrorChain";
import { TrailQueryPact, type TrailQuery } from "./pacts";

export type TrailType = "hiking" | "bicycle" | "both" | "walkable";

/**
 * Highways die Menschen betreten duerfen (ohne foot=no-Ausschluss).
 * Breiter als "hiking" — umfasst auch Fussgaengerzonen, Wohnstrassen und
 * geteilte Service-Wege.
 */
const WALKABLE_HIGHWAYS = new Set([
    "footway",
    "path",
    "pedestrian",
    "living_street",
    "steps",
    "track",
    "residential",
    "service",
    "unclassified",
    "cycleway",
]);

function isWalkable(tags: Record<string, string>): boolean {
    if (tags["foot"] === "no") return false;
    if (tags["access"] === "no" || tags["access"] === "private") return false;
    if (tags["route"] === "hiking" || tags["route"] === "foot") return true;
    const hw = tags["highway"];
    return !!hw && WALKABLE_HIGHWAYS.has(hw);
}
export type TrailPoint = { lat: number; lng: number };

export interface TrailElement {
    id: number;
    type: "way" | "relation";
    name?: string;
    trailType: "hiking" | "bicycle";
    distance?: string;
    surface?: string;
    /** Flat list: concatenation of all segments (for legacy consumers). */
    coordinates: TrailPoint[];
    /** Structured polylines: one entry per way (relations yield one per member). */
    segments: TrailPoint[][];
    tags: Record<string, string>;
}

/**
 * Das Trail-Result wird **mit** Helper-Funktionen zurueckgegeben. Die Basis-Klasse
 * ruft `postProcess()` auf jedem Rueckgabepfad auf — frisch, Area-Cache-Hit,
 * Key-Cache-Hit — damit der Consumer niemals ein nacktes Objekt sieht.
 */
export interface TrailResult {
    center: { lat: number; lng: number };
    radiusM: number;
    trailType: TrailType;
    trails: TrailElement[];
    toPolylines: (element: TrailElement) => TrailPoint[][];
    resolveAll: () => Array<{
        id: number;
        name?: string;
        trailType: "hiking" | "bicycle";
        segments: TrailPoint[][];
    }>;
    toGeoJSON: () => {
        type: "FeatureCollection";
        features: Array<{
            type: "Feature";
            geometry: { type: "LineString" | "MultiLineString"; coordinates: any };
            properties: Record<string, any>;
        }>;
    };
}

function classifyTrailType(tags: Record<string, string>): "hiking" | "bicycle" {
    const route = tags["route"] ?? "";
    if (route === "bicycle") return "bicycle";
    if (route === "hiking" || route === "foot") return "hiking";
    const highway = tags["highway"] ?? "";
    if (highway === "cycleway") return "bicycle";
    if (tags["bicycle"] === "yes" && highway !== "footway") return "bicycle";
    return "hiking";
}

function parseTrailType(raw?: string): TrailType {
    if (!raw) return "both";
    const v = raw.toLowerCase();
    if (v === "walkable" || v === "pedestrian" || v === "all_walkable") return "walkable";
    if (v === "hiking" || v === "walking" || v === "foot") return "hiking";
    if (v === "bicycle" || v === "cycling" || v === "bike") return "bicycle";
    return "both";
}

function makeToPolylines(): (element: TrailElement) => TrailPoint[][] {
    return (element: TrailElement): TrailPoint[][] => {
        if (!element) return [];
        if (Array.isArray(element.segments) && element.segments.length > 0) {
            return element.segments.filter((seg) => Array.isArray(seg) && seg.length >= 2);
        }
        if (Array.isArray(element.coordinates) && element.coordinates.length >= 2) {
            return [element.coordinates];
        }
        return [];
    };
}

function attachTrailHelpers(raw: Omit<TrailResult, "toPolylines" | "resolveAll" | "toGeoJSON">): TrailResult {
    const trails = raw.trails ?? [];
    const toPolylines = makeToPolylines();
    const resolveAll = () =>
        trails.map((t) => ({
            id: t.id,
            name: t.name,
            trailType: t.trailType,
            segments: toPolylines(t),
        }));
    const toGeoJSON = () => ({
        type: "FeatureCollection" as const,
        features: trails.map((t) => {
            const polylines = toPolylines(t);
            const isMulti = polylines.length !== 1;
            return {
                type: "Feature" as const,
                geometry: isMulti
                    ? {
                          type: "MultiLineString" as const,
                          coordinates: polylines.map((seg) => seg.map((p) => [p.lng, p.lat])),
                      }
                    : {
                          type: "LineString" as const,
                          coordinates: (polylines[0] ?? []).map((p) => [p.lng, p.lat]),
                      },
                properties: {
                    id: t.id,
                    name: t.name,
                    trailType: t.trailType,
                    surface: t.surface,
                    distance: t.distance,
                    osmType: t.type,
                },
            };
        }),
    });
    return { ...raw, toPolylines, resolveAll, toGeoJSON };
}

export class TrailRetriever extends OsmFeatureRetriever<TrailResult, typeof TrailQueryPact> {
    protected readonly layer = "trails";
    protected readonly defaultRadiusM = 3000;
    protected readonly maxRadiusM = 15000;
    protected readonly queryPactClass = TrailQueryPact;
    /** Trail nutzt `out geom;` damit Way-Geometrien inline kommen. */
    protected readonly outStatement = "out geom;";

    get name(): string {
        return TrailRetriever.name;
    }

    get description(): string {
        return "Finds nearby hiking trails and cycling routes via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(TrailQueryPact, d));
        const query = (queryDog?.collected as TrailQuery | undefined) ?? ({} as TrailQuery);
        const trailType = parseTrailType(query.type);

        // Drei Facets: hiking (enge Wander-Wege), bicycle (Radwege),
        // walkable (alle begehbaren Wege — breiter als hiking).
        const facets: string[] = [];
        if (trailType === "walkable") facets.push("walkable");
        if (trailType === "hiking" || trailType === "both") facets.push("hiking");
        if (trailType === "bicycle" || trailType === "both") facets.push("bicycle");

        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            facets,
            postFilter: { trailType },
        };
    }

    protected buildOverpassBodyForTile(
        bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number },
        facets: string[],
    ): string {
        const bboxClause = `(${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng})`;
        const lines: string[] = [];

        if (facets.includes("hiking")) {
            lines.push(`  relation["route"="hiking"]${bboxClause};`);
            lines.push(`  relation["route"="foot"]${bboxClause};`);
            lines.push(`  way["highway"="path"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="footway"]${bboxClause};`);
        }

        if (facets.includes("bicycle")) {
            lines.push(`  relation["route"="bicycle"]${bboxClause};`);
            lines.push(`  way["highway"="cycleway"]${bboxClause};`);
            lines.push(`  way["highway"="path"]["bicycle"="yes"]${bboxClause};`);
            lines.push(`  way["highway"="track"]["bicycle"="yes"]${bboxClause};`);
        }

        if (facets.includes("walkable")) {
            // Alles wo Menschen gehen duerfen. Breiter Scope:
            // markierte Wanderwege + Fuss/Fahrrad-Typen + Stadt-Wege ohne foot=no.
            lines.push(`  relation["route"="hiking"]${bboxClause};`);
            lines.push(`  relation["route"="foot"]${bboxClause};`);
            lines.push(`  way["highway"="footway"]${bboxClause};`);
            lines.push(`  way["highway"="path"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="pedestrian"]${bboxClause};`);
            lines.push(`  way["highway"="living_street"]${bboxClause};`);
            lines.push(`  way["highway"="steps"]${bboxClause};`);
            lines.push(`  way["highway"="track"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="residential"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="service"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="unclassified"]["foot"!="no"]${bboxClause};`);
            lines.push(`  way["highway"="cycleway"]["foot"!="no"]${bboxClause};`);
        }

        return lines.join("\n");
    }

    protected classifyElementFacets(el: OverpassRawElement, fetchedFacets: string[]): string[] {
        const tags = el.tags ?? {};
        const matches: string[] = [];
        if (fetchedFacets.includes("walkable") && isWalkable(tags)) {
            matches.push("walkable");
        }
        const category = classifyTrailType(tags);
        if (fetchedFacets.includes(category)) matches.push(category);
        return matches;
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): TrailResult {
        const seen = new Set<string>();
        const trails: TrailElement[] = [];

        for (const el of elements) {
            if (el.type !== "way" && el.type !== "relation") continue;
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const segments: TrailPoint[][] = [];
            if (el.type === "way" && Array.isArray(el.geometry)) {
                if (el.geometry.length >= 2) {
                    segments.push(el.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                }
            } else if (el.type === "relation" && Array.isArray(el.members)) {
                for (const member of el.members) {
                    if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
                    if (member.geometry.length >= 2) {
                        segments.push(member.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                    }
                }
            }

            const coordinates: TrailPoint[] = ([] as TrailPoint[]).concat(...segments);

            trails.push({
                id: el.id,
                type: el.type as "way" | "relation",
                name: el.tags["name"],
                trailType: classifyTrailType(el.tags),
                distance: el.tags["distance"],
                surface: el.tags["surface"],
                coordinates,
                segments,
                tags: el.tags,
            });
        }

        const trailType = (q.postFilter?.trailType ?? "both") as TrailType;
        return attachTrailHelpers({
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            trailType,
            trails,
        });
    }

    /**
     * Nach jedem Rueckgabepfad: Helper-Funktionen neu anheften. Bei frischem Fetch
     * sind sie schon drin (mapElements hat sie angehaengt) — wir checken das und
     * bauen sie sonst aus den trails-Arrays neu auf. Idempotent.
     */
    protected postProcess(result: TrailResult, _q: OsmQueryBase): TrailResult {
        if (typeof result.toPolylines === "function" && typeof result.resolveAll === "function") {
            return result;
        }
        return attachTrailHelpers({
            center: result.center,
            radiusM: result.radiusM,
            trailType: result.trailType,
            trails: result.trails ?? [],
        });
    }

}
