/**
 * =========================================================================
 *  BIRD API CLIENT — reading the avian void through eBird
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the eBird oracle —
 *  Cornell Lab's gateway to bird observation data across the globe.
 *  An API key from the env scrolls grants passage, matey.
 *
 *  Endpoint: https://api.ebird.org/v2/
 * =========================================================================
 */

import type { BirdObservation, BirdResult } from "./interfaces/birdTypes";

const EBIRD_BASE = "https://api.ebird.org/v2";

function getApiKey(): string {
    return process.env.EBIRD_API_KEY ?? '';
}

/** Fetch raw observation data from an eBird endpoint */
async function fetchEbird(path: string): Promise<any[]> {
    const url = `${EBIRD_BASE}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
                "X-eBirdApiToken": getApiKey(),
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`eBird failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    return await res.json() as any[];
}

/** Parse an eBird observation record into our typed form */
function parseObservation(raw: any, notable: boolean): BirdObservation {
    return {
        speciesCode: raw.speciesCode ?? '',
        commonName: raw.comName ?? raw.speciesCode ?? 'Unknown',
        scientificName: raw.sciName ?? '',
        count: raw.howMany != null ? Number(raw.howMany) : null,
        location: raw.locName ?? '',
        observationDate: raw.obsDt ?? '',
        lat: raw.lat ?? 0,
        lng: raw.lng ?? 0,
        isNotable: notable,
    };
}

/** Fetch recent bird observations near GPS coordinates */
export async function fetchRecentBirds(
    lat: number,
    lng: number,
    radiusKm: number,
    back: number
): Promise<BirdObservation[]> {
    const path = `/data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=${radiusKm}&back=${back}`;
    const raw = await fetchEbird(path);
    return raw.map((r: any) => parseObservation(r, false));
}

/** Fetch notable (rare) bird observations near GPS coordinates */
export async function fetchNotableBirds(
    lat: number,
    lng: number,
    radiusKm: number,
    back: number
): Promise<BirdObservation[]> {
    const path = `/data/obs/geo/recent/notable?lat=${lat}&lng=${lng}&dist=${radiusKm}&back=${back}`;
    const raw = await fetchEbird(path);
    return raw.map((r: any) => parseObservation(r, true));
}

/**
 * Fetch both recent and notable birds, build a BirdResult.
 * The totalSpecies count is derived from unique speciesCodes in recent observations.
 */
export async function getBirds(
    lat: number,
    lng: number,
    radiusKm: number = 25,
    back: number = 14
): Promise<BirdResult> {
    const [recent, notable] = await Promise.all([
        fetchRecentBirds(lat, lng, radiusKm, back),
        fetchNotableBirds(lat, lng, radiusKm, back).catch(() => [] as BirdObservation[]),
    ]);

    const uniqueSpecies = new Set(recent.map(o => o.speciesCode));

    return {
        recentObservations: recent,
        notableObservations: notable,
        totalSpecies: uniqueSpecies.size,
        searchLocation: { lat, lng },
        radiusKm,
    };
}
