/**
 * =========================================================================
 *  WATER RETRIEVER — sniffin' the tides from the coastal void
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates to the shore,
 *  summoning wave heights, ocean currents, and sea temperatures
 *  from the eldritch depths of Open-Meteo Marine.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { getWaterConditions } from "./waterApiClient";
import type { WaterResult } from "./interfaces/waterTypes";
import { WaterQueryPact, type WaterQuery } from "./pacts";

/**
 * Arr, the WaterRetriever — a spectral hound that sniffs out
 * marine conditions near given GPS coordinates!
 * Wave heights, ocean currents, water temperature — the coastal void laid bare.
 */
export class WaterRetriever extends Dog<WaterResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WaterRetriever.name;
    }

    get description(): string {
        return 'Fetches marine wave, current, and temperature data from Open-Meteo for given GPS coordinates.';
    }

    get icon(): string | undefined {
        return "\uD83C\uDF0A";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WaterQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WaterResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WaterQueryPact, d));
        const query = (queryDog?.collected as WaterQuery | undefined) ?? ({} as WaterQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('WaterRetriever: Missing required query params (lat, lng)');
        }

        const key = geoBucketKey("water", lat, lng, 1000);

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 15 * 60_000, () =>
                getWaterConditions(lat, lng)
            );
        }
        return getWaterConditions(lat, lng);
    };
}
