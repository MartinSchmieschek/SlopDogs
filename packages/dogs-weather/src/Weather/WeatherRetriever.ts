/**
 * =========================================================================
 *  WEATHER RETRIEVER — sniffin' out the sky-void's moods
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  atmosphere, summoning current conditions and hourly forecasts
 *  from the eldritch depths of Open-Meteo.
 *
 *  Pass an optional time and the hound peers into the future,
 *  revealing what weather the void has planned for that hour.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey, GEO_CACHE_TTL_WEATHER_MS } from "@slopdogs/core";
import { getWeather } from "./weatherApiClient";
import type { WeatherResult } from "./interfaces/weatherTypes";
import { WeatherQueryPact, type WeatherQuery } from "./pacts";

/**
 * Arr, the WeatherRetriever — a spectral hound that sniffs out
 * atmospheric conditions near given GPS coordinates!
 * Temperature, wind, humidity, precipitation — all moods of the
 * sky-void dredged from the Open-Meteo abyss.
 */
export class WeatherRetriever extends Dog<WeatherResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WeatherRetriever.name;
    }

    get description(): string {
        return 'Fetches current weather and hourly forecast from Open-Meteo for given GPS coordinates.';
    }

    get icon(): string | undefined {
        return "\u26C5";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WeatherQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WeatherResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WeatherQueryPact, d));
        const query = (queryDog?.collected as WeatherQuery | undefined) ?? ({} as WeatherQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('WeatherRetriever: Missing required query params (lat, lng)');
        }

        // Wetter ist auf 1-km-Kacheln gebucketet — Open-Meteo liefert ohnehin
        // nur auf diesem Grid aufgeloeste Vorhersagen, GPS-Jitter soll keine
        // Cache-Misses ausloesen.
        const key = geoBucketKey("weather", lat, lng, 1000, {
            extras: {
                date: query['date'] ?? 'today',
                time: query['time'] ?? 'now',
            },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_WEATHER_MS, () =>
                getWeather(lat, lng, query['time'], query['date'])
            );
        }
        return getWeather(lat, lng, query['time'], query['date']);
    };
}
