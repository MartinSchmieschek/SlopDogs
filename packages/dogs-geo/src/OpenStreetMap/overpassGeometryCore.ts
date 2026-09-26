/**
 * Shared Overpass geometry helpers: circle → bbox, fetch, OSM JSON → GeoJSON.
 */

import osmtogeojson from "osmtogeojson";
import type { FeatureCollection, GeometryObject } from "geojson";
import { getOverpassFetchTimeoutMs } from "./overpassOsmShared";

/** Default instance; often overloaded — see `getOverpassEndpoints()` */
export const OVERPASS_INTERPRETER_URL = "https://overpass-api.de/api/interpreter";

/** Used when `OVERPASS_INTERPRETER_URL` is unset: try main, then mirror */
const DEFAULT_OVERPASS_ENDPOINTS: readonly string[] = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Endpoints to POST to. Set `OVERPASS_INTERPRETER_URL` to force a single server (e.g. a private Overpass).
 */
export function getOverpassEndpoints(): string[] {
    const custom = process.env.OVERPASS_INTERPRETER_URL?.trim();
    if (custom) return [custom];
    return [...DEFAULT_OVERPASS_ENDPOINTS];
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default search radius in meters — matches landmark defaults */
export const DEFAULT_GEOMETRY_RADIUS_M = 500;
/** Maximum radius in meters — matches MAX_LANDMARK_RADIUS_M */
export const MAX_GEOMETRY_RADIUS_M = 5000;

export interface BoundingBox {
    south: number;
    west: number;
    north: number;
    east: number;
}

/**
 * Axis-aligned bounding box that fully contains the circle (center, radiusM).
 */
export function circleToBoundingBox(lat: number, lng: number, radiusM: number): BoundingBox {
    const latRad = (lat * Math.PI) / 180;
    const mPerDegLat = 111320;
    const cosLat = Math.max(Math.cos(latRad), 1e-6);
    const dLat = radiusM / mPerDegLat;
    const dLng = radiusM / (mPerDegLat * cosLat);
    return {
        south: lat - dLat,
        west: lng - dLng,
        north: lat + dLat,
        east: lng + dLng,
    };
}

export function clampGeometryRadiusM(parsed: number): number {
    if (Number.isNaN(parsed) || parsed < 1) {
        return DEFAULT_GEOMETRY_RADIUS_M;
    }
    return Math.min(Math.round(parsed), MAX_GEOMETRY_RADIUS_M);
}

function formatBBoxForOverpass(b: BoundingBox): string {
    return `${b.south},${b.west},${b.north},${b.east}`;
}

/** Build Overpass QL for polygon features (ways + relations) with landuse/natural tags */
export function buildForestAreaOverpassQuery(
    bbox: BoundingBox,
    landuse: readonly string[],
    natural: readonly string[],
    timeoutSec: number
): string {
    const bb = formatBBoxForOverpass(bbox);
    const lines: string[] = [];
    for (const v of landuse) {
        lines.push(`  way["landuse"="${escapeOverpassString(v)}"](${bb});`);
        lines.push(`  relation["landuse"="${escapeOverpassString(v)}"](${bb});`);
    }
    for (const v of natural) {
        lines.push(`  way["natural"="${escapeOverpassString(v)}"](${bb});`);
        lines.push(`  relation["natural"="${escapeOverpassString(v)}"](${bb});`);
    }
    return `[out:json][timeout:${timeoutSec}];
(
${lines.join("\n")}
);
(._;>;);
out geom;`;
}

function escapeOverpassString(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Build Overpass QL for linear highway ways */
export function buildStreetsOverpassQuery(
    bbox: BoundingBox,
    highways: readonly string[],
    timeoutSec: number
): string {
    const bb = formatBBoxForOverpass(bbox);
    const lines = highways.map(
        (v) => `  way["highway"="${escapeOverpassString(v)}"](${bb});`
    );
    return `[out:json][timeout:${timeoutSec}];
(
${lines.join("\n")}
);
out geom;`;
}

export interface OverpassOsmJson {
    elements?: unknown[];
    [key: string]: unknown;
}

/**
 * POSTs to Overpass with retries on 502/503/504 and optional fallback mirrors.
 * `timeoutMs` is the client abort window per attempt (default: `getOverpassFetchTimeoutMs()` → 30s).
 */
export async function fetchOverpassGeometry(
    query: string,
    timeoutMs = getOverpassFetchTimeoutMs(),
): Promise<OverpassOsmJson> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ??
        "jsonAggregator/OsmGeometryRetriever (contact: set OVERPASS_USER_AGENT)";

    const endpoints = getOverpassEndpoints();
    const maxAttemptsPerEndpoint = 3;
    let lastError = "";

    for (const endpoint of endpoints) {
        for (let attempt = 0; attempt < maxAttemptsPerEndpoint; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": userAgent,
                    },
                    body: `data=${encodeURIComponent(query)}`,
                    signal: controller.signal,
                });

                const text = await res.text().catch(() => "");

                if (res.ok) {
                    try {
                        return JSON.parse(text) as OverpassOsmJson;
                    } catch {
                        throw new Error(`Overpass: response was not JSON — ${text.slice(0, 200)}`);
                    }
                }

                const retryable = res.status === 502 || res.status === 503 || res.status === 504;
                lastError = formatOverpassHttpError(res.status, res.statusText, text);

                if (retryable && attempt < maxAttemptsPerEndpoint - 1) {
                    await sleep(2000 + attempt * 1500);
                    continue;
                }

                if (retryable && endpoints.length > 1 && endpoint === endpoints[0]) {
                    break;
                }

                throw new Error(formatOverpassUserHint(lastError));
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") {
                    lastError = `Overpass: request aborted after ${timeoutMs}ms (client timeout)`;
                    if (attempt < maxAttemptsPerEndpoint - 1) {
                        await sleep(2000 + attempt * 1500);
                        continue;
                    }
                    if (endpoints.length > 1 && endpoint === endpoints[0]) break;
                    throw new Error(formatOverpassUserHint(lastError));
                }
                if (e instanceof Error && e.message.startsWith("Overpass HTTP")) {
                    throw e;
                }
                throw e;
            } finally {
                clearTimeout(timer);
            }
        }
    }

    throw new Error(
        formatOverpassUserHint(lastError || "Overpass: all endpoints and retries exhausted")
    );
}

function formatOverpassHttpError(status: number, statusText: string, body: string): string {
    if (body.includes("<?xml") || body.includes("<!DOCTYPE html")) {
        return `Overpass HTTP ${status} ${statusText} (gateway returned HTML/XML error page — query too heavy or server busy)`;
    }
    return `Overpass HTTP ${status} ${statusText}${body ? ` — ${body.slice(0, 240)}` : ""}`;
}

function formatOverpassUserHint(detail: string): string {
    const hint =
        " Hint: use a smaller radius, fewer tags/highway classes, or set OVERPASS_INTERPRETER_URL to another Overpass instance.";
    return detail.includes("Hint:") ? detail : `${detail}${hint}`;
}

export function overpassJsonToGeoJson(osm: OverpassOsmJson): FeatureCollection<GeometryObject> {
    return osmtogeojson(osm as Parameters<typeof osmtogeojson>[0], { flatProperties: true });
}
