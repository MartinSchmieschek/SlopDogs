/**
 * =========================================================================
 *  SUN API CLIENT — reading the celestial void through Open-Meteo
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Open-Meteo daily forecast —
 *  summoning sunrise, sunset, daylight, sunshine and UV data.
 *  No API key required — the sun grants passage freely, matey.
 * =========================================================================
 */

import type { SunDay, SunResult } from "./interfaces/sunTypes";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/** UV-Index -> Risikobewertung */
function describeUvRisk(uv: number): string {
    if (uv <= 2) return "Niedrig";
    if (uv <= 5) return "Maessig";
    if (uv <= 7) return "Hoch";
    if (uv <= 10) return "Sehr hoch";
    return "Extrem";
}

/**
 * Fetch sun data from Open-Meteo.
 */
export async function getSunData(
    lat: number,
    lng: number,
    forecastDays: number = 7
): Promise<SunResult> {
    const days = Math.min(Math.max(forecastDays, 1), 16);
    const params = [
        `latitude=${lat}`,
        `longitude=${lng}`,
        `daily=sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max`,
        `timezone=auto`,
        `forecast_days=${days}`,
    ].join("&");

    const url = `${OPEN_METEO_BASE}?${params}`;

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
        throw new Error(`Open-Meteo sun failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const d = data.daily;
    const times: string[] = d.time ?? [];

    const allDays: SunDay[] = times.map((date: string, i: number) => ({
        date,
        sunrise: d.sunrise[i],
        sunset: d.sunset[i],
        daylightHours: Math.round((d.daylight_duration[i] / 3600) * 100) / 100,
        sunshineHours: Math.round((d.sunshine_duration[i] / 3600) * 100) / 100,
        uvIndexMax: d.uv_index_max[i],
        uvRisk: describeUvRisk(d.uv_index_max[i]),
    }));

    return {
        today: allDays[0],
        forecast: allDays,
        location: {
            lat: data.latitude,
            lng: data.longitude,
            timezone: data.timezone,
        },
    };
}
