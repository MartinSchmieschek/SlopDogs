/**
 * =========================================================================
 *  WEBCAM API CLIENT — peering through the all-seeing eyes of Windy
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Windy Webcams oracle —
 *  a gateway to live camera feeds scattered across the mortal plane.
 *  An API key from the env scrolls grants passage, matey.
 *
 *  Endpoint: https://api.windy.com/webcams/api/v3/webcams
 * =========================================================================
 */

import type { Webcam } from "./interfaces/webcamTypes";

const WINDY_BASE = "https://api.windy.com/webcams/api/v3/webcams";

function getApiKey(): string {
    return process.env.WINDY_API_KEY ?? '';
}

/** Parse a single Windy webcam record into our typed form */
function parseWebcam(raw: any): Webcam {
    const loc = raw.location ?? {};
    const images = raw.images ?? {};
    const player = raw.player ?? {};
    const categories = raw.categories ?? [];

    return {
        id: String(raw.id ?? ''),
        title: raw.title ?? 'Unknown Webcam',
        location: {
            lat: loc.latitude ?? 0,
            lng: loc.longitude ?? 0,
            city: loc.city ?? '',
            country: loc.country ?? '',
        },
        imageUrl: images?.current?.preview ?? images?.current?.thumbnail ?? '',
        playerUrl: player?.live?.embed ?? player?.day?.embed ?? '',
        lastUpdated: raw.lastUpdatedOn ?? '',
        status: raw.status ?? 'unknown',
        category: categories.map((c: any) => c.name ?? c.id ?? String(c)),
    };
}

/**
 * Fetch webcams near given GPS coordinates from Windy API v3.
 */
export async function fetchNearbyWebcams(
    lat: number,
    lng: number,
    radiusKm: number = 50,
    limit: number = 10
): Promise<Webcam[]> {
    const params = [
        `lat=${lat}`,
        `lng=${lng}`,
        `radius=${radiusKm}`,
        `limit=${limit}`,
        `include=images,location,player,categories`,
    ].join('&');

    const url = `${WINDY_BASE}?${params}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
                "x-windy-api-key": getApiKey(),
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Windy Webcams failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const webcams = data?.webcams ?? data?.result?.webcams ?? [];

    return webcams.map(parseWebcam);
}
