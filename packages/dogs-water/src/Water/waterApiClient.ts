/**
 * =========================================================================
 *  WATER API CLIENT — reading the coastal void through Open-Meteo Marine
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Open-Meteo Marine API —
 *  a free, keyless gateway to wave heights, ocean currents, and
 *  sea water temperatures.
 *
 *  Endpoint: https://marine-api.open-meteo.com/v1/marine
 * =========================================================================
 */

import type { WaterCurrent, WaterHourlyEntry, WaterResult } from "./interfaces/waterTypes";

const MARINE_API_BASE = "https://marine-api.open-meteo.com/v1/marine";

/**
 * Fetch marine/water conditions from Open-Meteo Marine API.
 * Returns error result for inland locations where no marine data is available.
 */
export async function getWaterConditions(lat: number, lng: number): Promise<WaterResult> {
    const params = [
        `latitude=${lat}`,
        `longitude=${lng}`,
        `current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction`,
        `hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_water_temperature`,
        `timezone=auto`,
        `forecast_days=2`,
    ].join("&");

    const url = `${MARINE_API_BASE}?${params}`;

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
        // Open-Meteo returns errors for inland locations
        if (res.status === 400 || text.toLowerCase().includes("no data")) {
            return {
                error: "No marine data for this location",
                current: null,
                hourly: [],
            };
        }
        throw new Error(`Open-Meteo Marine failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    let data: any;
    try {
        data = await res.json();
    } catch {
        return {
            error: "No marine data for this location",
            current: null,
            hourly: [],
        };
    }

    // Some inland coordinates return 200 but with null/empty data
    if (!data.current && !data.hourly) {
        return {
            error: "No marine data for this location",
            current: null,
            hourly: [],
        };
    }

    // Current conditions
    let current: WaterCurrent | null = null;
    if (data.current) {
        const c = data.current;
        current = {
            waveHeight: c.wave_height ?? 0,
            waveDirection: c.wave_direction ?? 0,
            wavePeriod: c.wave_period ?? 0,
            currentVelocity: c.ocean_current_velocity ?? 0,
            currentDirection: c.ocean_current_direction ?? 0,
        };
    }

    // Hourly forecast
    const hourly: WaterHourlyEntry[] = [];
    if (data.hourly) {
        const h = data.hourly;
        const times: string[] = h.time ?? [];
        for (let i = 0; i < times.length; i++) {
            hourly.push({
                time: times[i],
                waveHeight: h.wave_height?.[i] ?? 0,
                waveDirection: h.wave_direction?.[i] ?? 0,
                wavePeriod: h.wave_period?.[i] ?? 0,
                currentVelocity: h.ocean_current_velocity?.[i] ?? 0,
                currentDirection: h.ocean_current_direction?.[i] ?? 0,
                waterTemperature: h.sea_water_temperature?.[i] ?? 0,
            });
        }
    }

    return {
        current,
        hourly,
    };
}
