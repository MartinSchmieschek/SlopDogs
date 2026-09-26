/**
 * =========================================================================
 *  HISTORICAL WEATHER API CLIENT — reading the archive void through Open-Meteo
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Open-Meteo Archive API —
 *  a free, keyless gateway to historical weather data stretching back decades.
 *
 *  Endpoint: https://archive-api.open-meteo.com/v1/archive
 * =========================================================================
 */

import type { HistoricalDayEntry, HistoricalSummary, HistoricalWeatherResult } from "./interfaces/historicalWeatherTypes";

const ARCHIVE_API_BASE = "https://archive-api.open-meteo.com/v1/archive";

/**
 * Format a Date as YYYY-MM-DD.
 */
function formatDate(d: Date): string {
    return d.toISOString().split("T")[0];
}

/**
 * Compute default date range: end_date = yesterday, start_date = 7 days before that.
 */
function getDefaultDateRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = new Date(yesterday);
    startDate.setDate(startDate.getDate() - 7);

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(yesterday),
    };
}

/**
 * Fetch historical weather data from Open-Meteo Archive API.
 */
export async function getHistoricalWeather(
    lat: number,
    lng: number,
    startDate?: string,
    endDate?: string,
): Promise<HistoricalWeatherResult> {
    const defaults = getDefaultDateRange();
    const resolvedEnd = endDate ?? defaults.endDate;
    const resolvedStart = startDate ?? defaults.startDate;

    const params = [
        `latitude=${lat}`,
        `longitude=${lng}`,
        `start_date=${resolvedStart}`,
        `end_date=${resolvedEnd}`,
        `daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,rain_sum,snowfall_sum,windspeed_10m_max,windgusts_10m_max,sunshine_duration`,
        `timezone=auto`,
    ].join("&");

    const url = `${ARCHIVE_API_BASE}?${params}`;

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
        throw new Error(`Open-Meteo Archive failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as any;

    const d = data.daily;
    const times: string[] = d.time ?? [];

    // Build daily entries
    const daily: HistoricalDayEntry[] = [];
    for (let i = 0; i < times.length; i++) {
        daily.push({
            date: times[i],
            tempMax: d.temperature_2m_max?.[i] ?? 0,
            tempMin: d.temperature_2m_min?.[i] ?? 0,
            tempMean: d.temperature_2m_mean?.[i] ?? 0,
            precipitation: d.precipitation_sum?.[i] ?? 0,
            rain: d.rain_sum?.[i] ?? 0,
            snowfall: d.snowfall_sum?.[i] ?? 0,
            windMax: d.windspeed_10m_max?.[i] ?? 0,
            gustMax: d.windgusts_10m_max?.[i] ?? 0,
            sunshineHours: Math.round(((d.sunshine_duration?.[i] ?? 0) / 3600) * 100) / 100,
        });
    }

    // Compute summary
    let totalPrecipitation = 0;
    let totalSunshineHours = 0;
    let tempSum = 0;
    let hottestDay = daily[0]?.date ?? resolvedStart;
    let coldestDay = daily[0]?.date ?? resolvedStart;
    let hottestTemp = -Infinity;
    let coldestTemp = Infinity;

    for (const day of daily) {
        tempSum += day.tempMean;
        totalPrecipitation += day.precipitation;
        totalSunshineHours += day.sunshineHours;
        if (day.tempMax > hottestTemp) {
            hottestTemp = day.tempMax;
            hottestDay = day.date;
        }
        if (day.tempMin < coldestTemp) {
            coldestTemp = day.tempMin;
            coldestDay = day.date;
        }
    }

    const summary: HistoricalSummary = {
        avgTemp: daily.length > 0 ? Math.round((tempSum / daily.length) * 100) / 100 : 0,
        totalPrecipitation: Math.round(totalPrecipitation * 100) / 100,
        totalSunshineHours: Math.round(totalSunshineHours * 100) / 100,
        hottestDay,
        coldestDay,
    };

    return {
        period: {
            startDate: resolvedStart,
            endDate: resolvedEnd,
        },
        daily,
        summary,
    };
}
