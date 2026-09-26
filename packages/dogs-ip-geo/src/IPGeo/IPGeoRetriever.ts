/**
 * =========================================================================
 *  IP GEO RETRIEVER — sniffin' out location from the network-void
 * =========================================================================
 *
 *  Arr, matey! This hound takes an IP address (or none at all)
 *  and divines the geographic location — country, city, coords,
 *  timezone, and ISP — from the depths of ip-api.com.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getIPGeoData } from "./ipGeoApiClient";
import type { IPGeoResult } from "./interfaces/ipGeoTypes";
import { IPGeoQueryPact, type IPGeoQuery } from "./pacts";

/**
 * Arr, the IPGeoRetriever — a spectral hound that sniffs out
 * geographic location from an IP address! Country, city, coords,
 * timezone — all dredged from the network-void.
 */
export class IPGeoRetriever extends Dog<IPGeoResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return IPGeoRetriever.name;
    }

    get description(): string {
        return 'Fetches geolocation data (country, city, coords, timezone) from an IP address via ip-api.com.';
    }

    get icon(): string | undefined {
        return "\uD83C\uDF10";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [IPGeoQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<IPGeoResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(IPGeoQueryPact, d));
        const query = (queryDog?.collected as IPGeoQuery | undefined) ?? ({} as IPGeoQuery);

        const ip = query['ip'] ?? '';

        const key = `ipgeo:${ip || 'auto'}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 5 * 60_000, () =>
                getIPGeoData(ip || undefined)
            );
        }
        return getIPGeoData(ip || undefined);
    };
}
