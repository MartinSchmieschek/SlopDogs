import type { GeoNamesResult, GeoNamesNearbyEntry } from "./interfaces/geoNamesTypes";

/**
 * GeoNames verlangt einen kostenlosen Username. Ohne Eintrag in
 * GEONAMES_USERNAME fallen wir auf "demo" zurueck — das ist stark
 * rate-limited und nur zum Testen geeignet.
 */
function geoNamesUsername(): string {
    return process.env.GEONAMES_USERNAME?.trim() || "demo";
}

const GEONAMES_BASE = "https://secure.geonames.org";

async function geoNamesFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`geonames failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const body = await res.json() as any;
    if (body.status) {
        throw new Error(`geonames error: ${body.status.message ?? JSON.stringify(body.status)}`);
    }
    return body as T;
}

export async function getNearbyPlaces(lat: number, lng: number, radiusKm: number = 10, maxRows: number = 20): Promise<GeoNamesResult> {
    const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(Math.max(1, Math.min(300, Math.floor(radiusKm)))),
        maxRows: String(Math.max(1, Math.min(100, Math.floor(maxRows)))),
        username: geoNamesUsername(),
    });
    const data = await geoNamesFetch<{ geonames?: GeoNamesNearbyEntry[] }>(`${GEONAMES_BASE}/findNearbyPlaceNameJSON?${params.toString()}`);
    return { lat, lng, entries: data.geonames ?? [] };
}
