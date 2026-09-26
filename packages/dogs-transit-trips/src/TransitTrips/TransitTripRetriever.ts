/**
 * =========================================================================
 *  TRANSIT TRIP RETRIEVER — charting the full voyage of bus and rail
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the transit
 *  void: finds all nearby stations, collects their departures,
 *  deduplicates by line+direction, then fetches the FULL ROUTE
 *  for every unique line — every stop from origin to destination.
 *
 *  Where does the U4 go? From Enkheim to Bockenheimer Warte,
 *  through 26 stops. Where does the S1 run? This hound knows
 *  every stop along the way, with GPS coordinates to draw.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { fetchLocalTransitNetwork } from "./transitTripApiClient";
import type { TransitTripResult } from "./interfaces/transitTripTypes";
import { TransitTripQueryPact, type TransitTripQuery } from "./pacts";

/**
 * Arr, the TransitTripRetriever — a spectral hound that charts
 * the complete local transit network from GPS coordinates!
 * Every line, every stop from origin to destination, with lat/lng —
 * a full transit map dredged from the MOTIS abyss.
 */
export class TransitTripRetriever extends Dog<TransitTripResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return TransitTripRetriever.name;
    }

    get description(): string {
        return 'Fetches complete trip routes (all stops with GPS) for all lines near given coordinates via MOTIS. No API key required.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDE82";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [TransitTripQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TransitTripResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(TransitTripQueryPact, d));
        const query = (queryDog?.collected as TransitTripQuery | undefined) ?? ({} as TransitTripQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('TransitTripRetriever: Missing required query params (lat, lng)');
        }

        const radius = parseInt(query['radius'] ?? '1000', 10);
        const stations = parseInt(query['stations'] ?? '5', 10);
        const line = query['line'] || undefined;
        const limit = parseInt(query['limit'] ?? '10', 10);

        const key = geoBucketKey("trips", lat, lng, radius, {
            extras: { stations, line: line ?? 'all', limit },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 5 * 60_000, () =>
                fetchLocalTransitNetwork(lat, lng, radius, stations, line, limit)
            );
        }
        return fetchLocalTransitNetwork(lat, lng, radius, stations, line, limit);
    };
}
