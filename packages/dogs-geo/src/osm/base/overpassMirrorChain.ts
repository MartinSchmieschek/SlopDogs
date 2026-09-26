/**
 * ~~~ OVERPASS MIRROR CHAIN — resilient fetch across multiple interpreters ~~~
 *
 * Der public overpass-api.de Endpoint kippt unter Last haeufig mit HTTP 504
 * oder mit "HTTP 200 + HTML error". Die Mirror-Kette probiert darum mehrere
 * Interpreter durch, bis einer sauber antwortet. Reihenfolge:
 *
 *   1. $OVERPASS_URLS (Komma-Liste) oder $OVERPASS_URL (single)
 *   2. osm.ch (Swiss OSM Community) — meist schnellste Antwortzeiten in DACH
 *   3. lz4 / kumi Fallbacks
 *   4. overpass-api.de (offizieller Public-Endpoint)
 *
 * Retry-Strategie: AbortError, Netzwerk, HTTP 429/5xx, Non-JSON-Bodies gelten
 * als transient und eskalieren zum naechsten Mirror. HTTP 400 (Bad Query) und
 * Parse-Fehler bubbeln sofort durch — bei denen hilft kein anderer Server.
 *
 * Ein zentrales Modul fuer alle OSM-Dogs: kein copy-paste von fetch-Schleifen
 * mehr in jeden einzelnen Retriever.
 */

import { readOverpassBodyText } from "./overpassResponseLimit";

/** Overpass `[timeout:N]` — Server bricht die Query ab (leicht unter Client-Cap). */
const DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC = 25;
/** HTTP-Abort pro Overpass-Request; Cache-Reads/Writes haben eigenes Budget (Prisma/SQLite). */
const DEFAULT_OVERPASS_FETCH_TIMEOUT_MS = 30_000;
const MIN_OVERPASS_FETCH_TIMEOUT_MS = 5_000;

// Rate-Limit pro Overpass-Endpoint. Overpass-Policy: max ~2 parallele Requests,
// minimaler Abstand zwischen Requests, damit kein 429 kassiert wird.
const OVERPASS_MAX_CONCURRENT_PER_ENDPOINT = 2;
const OVERPASS_MIN_GAP_MS = 500;
const OVERPASS_BACKOFF_INITIAL_MS = 2_000;
const OVERPASS_BACKOFF_MAX_MS = 60_000;

interface EndpointState {
    running: number;
    queue: Array<() => void>;
    lastStartAt: number;
    backoffUntil: number;
    consecutiveFailures: number;
}

const endpointStates = new Map<string, EndpointState>();

function stateFor(url: string): EndpointState {
    let s = endpointStates.get(url);
    if (!s) {
        s = {
            running: 0,
            queue: [],
            lastStartAt: 0,
            backoffUntil: 0,
            consecutiveFailures: 0,
        };
        endpointStates.set(url, s);
    }
    return s;
}

async function acquireSlot(url: string): Promise<void> {
    const s = stateFor(url);
    while (true) {
        const now = Date.now();
        const waitForBackoff = s.backoffUntil - now;
        const waitForGap = s.lastStartAt + OVERPASS_MIN_GAP_MS - now;
        const wait = Math.max(waitForBackoff, waitForGap, 0);
        const hasSlot = s.running < OVERPASS_MAX_CONCURRENT_PER_ENDPOINT;
        if (hasSlot && wait === 0) {
            s.running++;
            s.lastStartAt = Date.now();
            return;
        }
        if (!hasSlot) {
            await new Promise<void>((resolve) => s.queue.push(resolve));
            continue;
        }
        // Slot frei, aber Gap/Backoff noch aktiv.
        await new Promise((resolve) => setTimeout(resolve, wait));
    }
}

function releaseSlot(url: string, outcome: 'ok' | 'transient' | 'permanent'): void {
    const s = stateFor(url);
    s.running = Math.max(0, s.running - 1);
    if (outcome === 'ok') {
        s.consecutiveFailures = 0;
        s.backoffUntil = 0;
    } else if (outcome === 'transient') {
        s.consecutiveFailures++;
        const backoff = Math.min(
            OVERPASS_BACKOFF_INITIAL_MS * 2 ** (s.consecutiveFailures - 1),
            OVERPASS_BACKOFF_MAX_MS,
        );
        s.backoffUntil = Date.now() + backoff;
    }
    // permanent: keinen Backoff setzen — der Fehler ist client-side.
    const next = s.queue.shift();
    if (next) next();
}

// Nur Mirrors mit globalem Datensatz. osm.ch ist entfernt — er hat nur Schweizer
// Daten und liefert fuer alle anderen Regionen stillschweigend 0 elements, ohne
// Fehler-Signal. Das bricht Caching-Entscheidungen, da ein "negatives" Resultat
// persistiert wird. Besser komplett weglassen.
const FALLBACK_OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
];

function parseEnvPositiveInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (v == null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Overpass-Server-Timeout (`[timeout:N]`). Env: OVERPASS_QUERY_TIMEOUT_SEC. */
export function getOverpassQueryTimeoutSec(): number {
    return parseEnvPositiveInt("OVERPASS_QUERY_TIMEOUT_SEC", DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC);
}

/** HTTP-Client-Abort-Budget pro Overpass-Request (nicht Tile-Cache). Env: OVERPASS_FETCH_TIMEOUT_MS. */
export function getOverpassFetchTimeoutMs(): number {
    const fromEnv = process.env.OVERPASS_FETCH_TIMEOUT_MS;
    if (fromEnv != null && fromEnv !== "") {
        const n = parseInt(fromEnv, 10);
        if (Number.isFinite(n) && n >= MIN_OVERPASS_FETCH_TIMEOUT_MS) return n;
    }
    return DEFAULT_OVERPASS_FETCH_TIMEOUT_MS;
}

/** Gebaute Mirror-Kette: Env-Overrides vorn, hardcoded Fallbacks hinten, dedupliziert. */
export function getOverpassUrlChain(): string[] {
    const chain: string[] = [];
    const multi = process.env.OVERPASS_URLS;
    if (multi) {
        for (const u of multi.split(",").map((s) => s.trim()).filter(Boolean)) chain.push(u);
    } else {
        const single = process.env.OVERPASS_URL;
        if (single) chain.push(single);
    }
    for (const u of FALLBACK_OVERPASS_URLS) chain.push(u);
    return Array.from(new Set(chain));
}

export interface OverpassRawElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
    members?: Array<{
        type: string;
        ref: number;
        role: string;
        geometry?: Array<{ lat: number; lon: number }>;
    }>;
    nodes?: number[];
    geometry?: Array<{ lat: number; lon: number }>;
}

/** Zieht den ersten sichtbaren Fehler-Satz aus einer HTML-Error-Antwort. */
function extractOverpassError(body: string): string {
    const match = body.match(/<p[^>]*>\s*(?:<strong[^>]*>[^<]*<\/strong>\s*:?\s*)?([^<]{5,300})<\/p>/i);
    if (match && match[1]) return match[1].trim();
    const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped.slice(0, 200);
}

function isRetryableOverpassError(err: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string; message?: string; code?: string };
    if (e.name === "AbortError") return true;
    const msg = (e.message ?? "").toLowerCase();
    if (!msg) return false;
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("econn") || msg.includes("etimedout")) return true;
    if (msg.includes("returned non-json")) return true;
    if (/http\s+(5\d\d|429|408)/.test(msg)) return true;
    return false;
}

async function fetchOverpassOnce(
    url: string,
    overpassQuery: string,
    fetchTimeoutMs: number,
    userAgentLabel: string,
): Promise<OverpassRawElement[]> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ??
        `SlopDogs/${userAgentLabel} (contact: set OVERPASS_USER_AGENT)`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);

    let res: Response;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": userAgent,
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new Error(
                `${userAgentLabel}: Overpass request aborted after ${fetchTimeoutMs}ms (client timeout)`,
            );
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }

    // Deckel auf dem Puffer: auch ein Fehler-Body wird nicht unbesehen in den Heap gezogen.
    let rawBody: string;
    try {
        rawBody = await readOverpassBodyText(res, userAgentLabel);
    } catch (err) {
        if (!res.ok) {
            throw new Error(
                `${userAgentLabel}: Overpass HTTP ${res.status} ${res.statusText} — ${(err as Error)?.message ?? err}`
            );
        }
        throw err;
    }
    if (!res.ok) {
        throw new Error(
            `${userAgentLabel}: Overpass HTTP ${res.status} ${res.statusText}${rawBody ? ` — ${rawBody.slice(0, 200)}` : ""}`
        );
    }
    const contentType = res.headers.get("content-type") ?? "";
    const looksLikeHtml = rawBody.trimStart().startsWith("<");
    if (!contentType.includes("json") || looksLikeHtml) {
        const hint = extractOverpassError(rawBody);
        throw new Error(
            `${userAgentLabel}: Overpass returned non-JSON (${contentType || "no content-type"})${hint ? ` — ${hint}` : ""}`
        );
    }

    let json: { elements?: OverpassRawElement[] };
    try {
        json = JSON.parse(rawBody) as { elements?: OverpassRawElement[] };
    } catch (err: any) {
        throw new Error(`${userAgentLabel}: Overpass JSON parse failed — ${err?.message || err}`);
    }
    return json.elements ?? [];
}

/**
 * Zentrale Fetch-Funktion: haemmert die Overpass-Query durch die Mirror-Kette,
 * bis einer sauber antwortet. Transient-Fehler springen zum naechsten Mirror,
 * permanente Fehler (Bad-Query, Parse) bubbeln sofort durch.
 */
export async function fetchOverpassElementsWithFallback(
    overpassQuery: string,
    userAgentLabel: string,
): Promise<OverpassRawElement[]> {
    const urls = getOverpassUrlChain();
    const fetchTimeoutMs = getOverpassFetchTimeoutMs();
    const errors: string[] = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        await acquireSlot(url);
        try {
            const res = await fetchOverpassOnce(url, overpassQuery, fetchTimeoutMs, userAgentLabel);
            releaseSlot(url, 'ok');
            return res;
        } catch (err: any) {
            const transient = isRetryableOverpassError(err);
            releaseSlot(url, transient ? 'transient' : 'permanent');
            const label = `${url}: ${err?.message ?? err}`;
            errors.push(label);
            if (!transient || i === urls.length - 1) {
                if (errors.length === 1) throw err;
                throw new Error(
                    `${userAgentLabel}: all Overpass mirrors failed — ${errors.join(" | ")}`
                );
            }
        }
    }

    throw new Error(`${userAgentLabel}: no Overpass URL configured`);
}

/** Einheitlicher `[out:json][timeout:N];`-Header. */
export function overpassSettingsHeader(): string {
    return `[out:json][timeout:${getOverpassQueryTimeoutSec()}];`;
}

/** Representativer Punkt aus einem Overpass-Element, zieht `lat/lon` oder `center`. */
export function overpassElementRepresentativePoint(
    el: OverpassRawElement,
): { lat: number; lng: number } | null {
    if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
    if (el.center) return { lat: el.center.lat, lng: el.center.lon };
    return null;
}
