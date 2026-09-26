/**
 * =========================================================================
 *  GEOCODING API CLIENT — translating between names and coordinates
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of Nominatim, the OSM oracle
 *  that translates addresses into coordinates and coordinates into
 *  addresses. No API key required — the map grants passage freely.
 *
 *  Rate limit: 1 request/second (Nominatim policy). Be gentle, matey.
 * =========================================================================
 */

import type { GeoLocation, GeoAddress, GeocodingResult } from "./interfaces/geocodingTypes";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

function parseAddress(addr: any): GeoAddress {
    const road = addr?.road ?? addr?.pedestrian ?? addr?.footway ?? null;
    const houseNumber = addr?.house_number ?? null;
    const street = road && houseNumber ? `${road} ${houseNumber}` : road;

    return {
        street,
        suburb: addr?.suburb ?? addr?.neighbourhood ?? addr?.city_district ?? null,
        city: addr?.city ?? addr?.town ?? addr?.village ?? addr?.municipality ?? null,
        postcode: addr?.postcode ?? null,
        state: addr?.state ?? null,
        country: addr?.country ?? null,
        countryCode: addr?.country_code ?? null,
    };
}

function parseLocation(item: any): GeoLocation {
    return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name ?? "",
        address: parseAddress(item.address),
        osmType: item.osm_type ?? null,
        importance: item.importance ?? 0,
    };
}

/**
 * Forward geocoding — Adresse/Ortsname zu GPS-Koordinaten.
 */
export async function forwardGeocode(
    query: string,
    limit: number = 5
): Promise<GeocodingResult> {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=${limit}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`Nominatim search failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any[];
    const results = data.map(parseLocation);

    return {
        mode: "forward",
        query,
        results,
        resultCount: results.length,
    };
}

/**
 * Reverse geocoding — GPS-Koordinaten zu Adresse.
 */
export async function reverseGeocode(
    lat: number,
    lng: number
): Promise<GeocodingResult> {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`Nominatim reverse failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;

    // Reverse returns a single object, not an array
    if (data.error) {
        return {
            mode: "reverse",
            query: `${lat},${lng}`,
            results: [],
            resultCount: 0,
        };
    }

    const result = parseLocation(data);

    return {
        mode: "reverse",
        query: `${lat},${lng}`,
        results: [result],
        resultCount: 1,
    };
}
