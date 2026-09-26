/**
 * =========================================================================
 *  AIR QUALITY API CLIENT — reading the breathing void through Open-Meteo
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Open-Meteo Air Quality API —
 *  a free, keyless gateway to atmospheric pollutant data and pollen counts.
 *
 *  Endpoint: https://air-quality-api.open-meteo.com/v1/air-quality
 * =========================================================================
 */

import type { CurrentAirQuality, PollenData, HourlyAirQuality, AirQualityResult } from "./interfaces/airQualityTypes";

const AQ_API_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** European AQI -> menschenlesbare Beschreibung */
function describeAqi(aqi: number): string {
    if (aqi <= 20) return "Gut";
    if (aqi <= 40) return "Befriedigend";
    if (aqi <= 60) return "Maessig";
    if (aqi <= 80) return "Schlecht";
    if (aqi <= 100) return "Sehr schlecht";
    return "Extrem schlecht";
}

/**
 * Fetch air quality and pollen data from Open-Meteo.
 */
export async function getAirQuality(lat: number, lng: number): Promise<AirQualityResult> {
    const params = [
        `latitude=${lat}`,
        `longitude=${lng}`,
        `current=european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide`,
        `hourly=european_aqi,pm2_5,pm10,ozone,birch_pollen,grass_pollen,alder_pollen,ragweed_pollen,mugwort_pollen,olive_pollen`,
        `timezone=auto`,
        `forecast_days=2`,
    ].join("&");

    const url = `${AQ_API_BASE}?${params}`;

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
        throw new Error(`Open-Meteo Air Quality failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;

    // Current air quality
    const c = data.current;
    const current: CurrentAirQuality = {
        europeanAqi: c.european_aqi,
        aqiDescription: describeAqi(c.european_aqi),
        pm25: c.pm2_5,
        pm10: c.pm10,
        ozone: c.ozone,
        nitrogenDioxide: c.nitrogen_dioxide,
        sulphurDioxide: c.sulphur_dioxide,
        carbonMonoxide: c.carbon_monoxide,
        time: c.time,
    };

    // Hourly forecast (next 24h)
    const h = data.hourly;
    const times: string[] = h.time ?? [];
    const now = new Date();
    const hourly: HourlyAirQuality[] = [];

    for (let i = 0; i < times.length && hourly.length < 24; i++) {
        if (new Date(times[i]) < now) continue;
        hourly.push({
            time: times[i],
            europeanAqi: h.european_aqi[i],
            aqiDescription: describeAqi(h.european_aqi[i]),
            pm25: h.pm2_5[i],
            pm10: h.pm10[i],
            ozone: h.ozone[i],
        });
    }

    // Pollen — find the current/next hour
    let pollen: PollenData | null = null;
    const currentIdx = times.findIndex((t: string) => t === c.time);
    const pollenIdx = currentIdx >= 0 ? currentIdx : 0;
    if (h.birch_pollen) {
        pollen = {
            time: times[pollenIdx],
            birch: h.birch_pollen[pollenIdx] ?? 0,
            grass: h.grass_pollen[pollenIdx] ?? 0,
            alder: h.alder_pollen[pollenIdx] ?? 0,
            ragweed: h.ragweed_pollen[pollenIdx] ?? 0,
            mugwort: h.mugwort_pollen[pollenIdx] ?? 0,
            olive: h.olive_pollen[pollenIdx] ?? 0,
        };
    }

    return {
        current,
        pollen,
        hourly,
        location: {
            lat: data.latitude,
            lng: data.longitude,
            timezone: data.timezone,
        },
    };
}
