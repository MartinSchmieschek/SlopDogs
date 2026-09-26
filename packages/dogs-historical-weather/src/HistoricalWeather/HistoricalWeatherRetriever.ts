/**
 * =========================================================================
 *  HISTORICAL WEATHER RETRIEVER — sniffin' through the archive void
 * =========================================================================
 *
 *  Arr, matey! This hound digs through the temporal layers of the void,
 *  unearthing past weather data — temperatures, precipitation, wind,
 *  and sunshine from days gone by.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { getHistoricalWeather } from "./historicalWeatherApiClient";
import type { HistoricalWeatherResult } from "./interfaces/historicalWeatherTypes";
import { HistoricalWeatherQueryPact, type HistoricalWeatherQuery } from "./pacts";

/**
 * Arr, the HistoricalWeatherRetriever — a spectral hound that digs
 * through the temporal void, unearthing past weather records!
 * Temperature, precipitation, wind, sunshine — the archive void laid bare.
 */
export class HistoricalWeatherRetriever extends Dog<HistoricalWeatherResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return HistoricalWeatherRetriever.name;
    }

    get description(): string {
        return 'Fetches historical weather data from Open-Meteo Archive for given GPS coordinates and date range.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDCC5";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [HistoricalWeatherQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<HistoricalWeatherResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(HistoricalWeatherQueryPact, d));
        const query = (queryDog?.collected as HistoricalWeatherQuery | undefined) ?? ({} as HistoricalWeatherQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('HistoricalWeatherRetriever: Missing required query params (lat, lng)');
        }

        const startDate = query['start_date'];
        const endDate = query['end_date'];
        // Open-Meteo Archive hat ~10 km Aufloesung — 1 km Zelle ist sicher gross.
        const key = geoBucketKey("historical-weather", lat, lng, 1000, {
            bucketM: 1000,
            extras: { start: startDate ?? 'default', end: endDate ?? 'default' },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, () =>
                getHistoricalWeather(lat, lng, startDate, endDate)
            );
        }
        return getHistoricalWeather(lat, lng, startDate, endDate);
    };
}
