/**
 * Shared Overpass fetch + element mapping for OSM geo retrievers (landmarks, tracks, vegetation).
 */

import { readOverpassBodyText } from "../osm/base/overpassResponseLimit";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const DEFAULT_OSM_RADIUS_M = 500;
export const MAX_OSM_RADIUS_M = 5000;

/** Default server-side Overpass execution cap (seconds) — `[timeout:N]` in QL */
export const DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC = 25;

/** HTTP-Abort pro Overpass-Request; Tile-Cache hat eigenes Warte-Budget. */
export const DEFAULT_OVERPASS_FETCH_TIMEOUT_MS = 30_000;

function parseEnvPositiveInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (v == null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Overpass `[timeout:N]` (server max runtime). Env: `OVERPASS_QUERY_TIMEOUT_SEC` (default 25).
 */
export function getOverpassQueryTimeoutSec(): number {
    return parseEnvPositiveInt("OVERPASS_QUERY_TIMEOUT_SEC", DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC);
}

/**
 * HTTP client abort budget per Overpass request (not tile cache). Env: `OVERPASS_FETCH_TIMEOUT_MS` (default 30000).
 */
export function getOverpassFetchTimeoutMs(): number {
    const fromEnv = process.env.OVERPASS_FETCH_TIMEOUT_MS;
    if (fromEnv != null && fromEnv !== "") {
        const n = parseInt(fromEnv, 10);
        if (Number.isFinite(n) && n >= 5_000) return n;
    }
    return DEFAULT_OVERPASS_FETCH_TIMEOUT_MS;
}

/** First line of every Overpass QL body: `[out:json][timeout:N];` */
export function overpassSettingsHeader(): string {
    return `[out:json][timeout:${getOverpassQueryTimeoutSec()}];`;
}

export enum OsmGeoElementType {
    Node = "node",
    Way = "way",
    Relation = "relation",
}

/** A node, way, or relation with a representative point and tags */
export interface OsmGeoElement {
    type: OsmGeoElementType;
    id: number;
    lat: number;
    lng: number;
    name?: string;
    tags: Record<string, string>;
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export function mapOverpassElement(el: OverpassElement): OsmGeoElement | null {
    if (
        el.type !== OsmGeoElementType.Node &&
        el.type !== OsmGeoElementType.Way &&
        el.type !== OsmGeoElementType.Relation
    ) {
        return null;
    }
    let lat: number | undefined;
    let lng: number | undefined;
    if (el.lat != null && el.lon != null) {
        lat = el.lat;
        lng = el.lon;
    } else if (el.center) {
        lat = el.center.lat;
        lng = el.center.lon;
    }
    if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
    }
    const tags = el.tags ?? {};
    const name = tags["name"];
    return {
        type: el.type as OsmGeoElementType,
        id: el.id,
        lat,
        lng,
        ...(name ? { name } : {}),
        tags,
    };
}

export function clampOsmRadiusM(parsed: number, defaultM = DEFAULT_OSM_RADIUS_M, maxM = MAX_OSM_RADIUS_M): number {
    if (Number.isNaN(parsed) || parsed < 1) {
        return defaultM;
    }
    return Math.min(Math.round(parsed), maxM);
}

/**
 * POST Overpass interpreter; returns deduped elements. `userAgentLabel` appears in default User-Agent.
 */
export async function fetchOverpassElements(query: string, userAgentLabel: string): Promise<OsmGeoElement[]> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ?? `jsonAggregator/${userAgentLabel} (contact: set OVERPASS_USER_AGENT)`;

    const controller = new AbortController();
    const timeoutMs = getOverpassFetchTimeoutMs();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
        res = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": userAgent,
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(
                `${userAgentLabel}: Overpass request aborted after ${timeoutMs}ms (client timeout)`,
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await readOverpassBodyText(res, userAgentLabel).catch(() => "");
        throw new Error(
            `${userAgentLabel}: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
        );
    }

    // Deckel statt `res.json()`: die Antwortgroesse bestimmt die BBox, nicht wir.
    // Der Body wird gezaehlt und abgebrochen, bevor er im Heap liegt — siehe
    // osm/base/overpassResponseLimit.ts (OVERPASS_MAX_RESPONSE_BYTES).
    const body = await readOverpassBodyText(res, userAgentLabel);
    let json: { elements?: OverpassElement[] };
    try {
        json = JSON.parse(body) as { elements?: OverpassElement[] };
    } catch (err: any) {
        throw new Error(`${userAgentLabel}: Overpass JSON parse failed — ${err?.message || err}`);
    }
    const rawElements = json.elements ?? [];
    const seen = new Set<string>();
    const elements: OsmGeoElement[] = [];

    for (const raw of rawElements) {
        const mapped = mapOverpassElement(raw);
        if (!mapped) continue;
        const key = `${mapped.type}/${mapped.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push(mapped);
    }

    return elements;
}
