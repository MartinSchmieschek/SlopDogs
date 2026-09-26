/**
 * =========================================================================
 *  IP GEO API CLIENT — probing the network-void through ip-api.com
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of ip-api.com — summoning
 *  geolocation data from an IP address. Leave the IP empty and
 *  the void reveals where *you* stand, matey.
 * =========================================================================
 */

import type { IPGeoApiResponse, IPGeoResult } from "./interfaces/ipGeoTypes";

const FIELDS = "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query";

/**
 * Fetch geolocation data from ip-api.com.
 */
export async function getIPGeoData(ip?: string): Promise<IPGeoResult> {
    const base = ip
        ? `http://ip-api.com/json/${encodeURIComponent(ip)}`
        : `http://ip-api.com/json/`;

    const url = `${base}?fields=${FIELDS}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

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
        throw new Error(`ip-api.com failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as IPGeoApiResponse;

    if (data.status === "fail") {
        throw new Error(`ip-api.com error: ${data.message ?? 'unknown error'}`);
    }

    return {
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        region: data.region,
        regionName: data.regionName,
        city: data.city,
        zip: data.zip,
        lat: data.lat,
        lng: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
    };
}
