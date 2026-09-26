/**
 * =========================================================================
 *  AIR QUALITY RETRIEVER — sniffin' the particles from the breathing void
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  atmosphere, summoning pollution data and pollen counts
 *  from the eldritch depths of Open-Meteo Air Quality.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey, GEO_CACHE_TTL_AIR_QUALITY_MS } from "@slopdogs/core";
import { getAirQuality } from "./airQualityApiClient";
import type { AirQualityResult } from "./interfaces/airQualityTypes";
import { AirQualityQueryPact, type AirQualityQuery } from "./pacts";

/**
 * Arr, the AirQualityRetriever — a spectral hound that sniffs out
 * atmospheric pollutants and pollen near given GPS coordinates!
 * PM2.5, PM10, Ozon, NO2, Pollenflug — the breathing void laid bare.
 */
export class AirQualityRetriever extends Dog<AirQualityResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string { return AirQualityRetriever.name; }
    get description(): string { return 'Fetches current air quality index and pollutant levels from Open-Meteo.'; }
    get icon(): string | undefined { return "\uD83C\uDF2B\uFE0F"; }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [AirQualityQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<AirQualityResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(AirQualityQueryPact, d));
        const query = (queryDog?.collected as AirQualityQuery | undefined) ?? ({} as AirQualityQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('AirQualityRetriever: Missing required query params (lat, lng)');
        }

        // Open-Meteo Air Quality aktualisiert stuendlich — 30 min TTL + 1-km-Grid
        // reichen; GPS-Jitter darf keine Misses ausloesen.
        const key = geoBucketKey("air-quality", lat, lng, 1000);

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_AIR_QUALITY_MS, () => getAirQuality(lat, lng));
        }
        return getAirQuality(lat, lng);
    };
}
