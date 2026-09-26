import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { AstronomyQueryPact, type AstronomyQuery } from "./pacts";

export interface AstronomyMoon {
    phase: string;
    illumination: number;
    age: number;
}

export interface AstronomySun {
    sunrise: string;
    sunset: string;
    daylightMinutes: number;
    sunshineMinutes: number;
    uvIndexMax: number;
}

export interface AstronomyResult {
    sun: AstronomySun;
    moon: AstronomyMoon;
    date: string;
}

const SYNODIC_MONTH = 29.53059;
const KNOWN_NEW_MOON = new Date("2000-01-06T18:14:00Z").getTime();

function getMoonPhase(date: Date): AstronomyMoon {
    const diff = date.getTime() - KNOWN_NEW_MOON;
    const daysSince = diff / (1000 * 60 * 60 * 24);
    const age = ((daysSince % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;

    let phase: string;
    if (age < 1.85) phase = "New Moon";
    else if (age < 7.38) phase = "Waxing Crescent";
    else if (age < 11.07) phase = "First Quarter";
    else if (age < 14.76) phase = "Waxing Gibbous";
    else if (age < 16.61) phase = "Full Moon";
    else if (age < 22.14) phase = "Waning Gibbous";
    else if (age < 25.83) phase = "Last Quarter";
    else phase = "Waning Crescent";

    const illumination = Math.round((1 - Math.cos(2 * Math.PI * age / SYNODIC_MONTH)) / 2 * 100);

    return { phase, illumination, age: Math.round(age * 10) / 10 };
}

export class AstronomyRetriever extends Dog<AstronomyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string { return AstronomyRetriever.name; }
    get description(): string { return "Moon phase, sunrise/sunset, UV index and daylight data for given GPS coordinates."; }
    get icon(): string | undefined { return "\uD83C\uDF19"; }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [AstronomyQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<AstronomyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(AstronomyQueryPact, d));
        const query = (queryDog?.collected as AstronomyQuery | undefined) ?? ({} as AstronomyQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("AstronomyRetriever: Missing required query params (lat, lng)");
        }

        const dateStr = query.date || new Date().toISOString().split("T")[0];
        // 1 km Zelle — Sonne/Mond aendern sich ueber diese Distanz nicht messbar.
        const key = geoBucketKey("astronomy", lat, lng, 1000, { bucketM: 1000, extras: { date: dateStr } });

        const fetchData = async (): Promise<AstronomyResult> => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 15_000);
            try {
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max&timezone=auto&forecast_days=1&start_date=${dateStr}&end_date=${dateStr}`;
                const res = await fetch(url, { signal: ctrl.signal });
                if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
                const data = await res.json() as any;
                const daily = data.daily;

                const sun: AstronomySun = {
                    sunrise: daily.sunrise?.[0] ?? "",
                    sunset: daily.sunset?.[0] ?? "",
                    daylightMinutes: Math.round((daily.daylight_duration?.[0] ?? 0) / 60),
                    sunshineMinutes: Math.round((daily.sunshine_duration?.[0] ?? 0) / 60),
                    uvIndexMax: daily.uv_index_max?.[0] ?? 0,
                };

                const moon = getMoonPhase(new Date(dateStr));

                return { sun, moon, date: dateStr };
            } finally {
                clearTimeout(timer);
            }
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, fetchData);
        }
        return fetchData();
    };
}
