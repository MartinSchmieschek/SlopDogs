/**
 * =========================================================================
 *  WIKI NEARBY RETRIEVER — summoning knowledge from the encyclopaedic void
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  depths of Wikipedia, summoning articles about nearby places,
 *  landmarks, and curiosities — each with a summary and thumbnail.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { getWikiNearby } from "./wikipediaApiClient";
import type { WikiNearbyResult } from "./interfaces/wikipediaTypes";
import { WikiNearbyQueryPact, type WikiNearbyQuery } from "./pacts";

const WIKI_NEARBY_CACHE_TTL_MS = 24 * 60 * 60_000; // 24 h — Geo-Artikel sind stabil

/**
 * Arr, the WikiNearbyRetriever — a spectral hound that sniffs out
 * Wikipedia articles near given GPS coordinates!
 * Each article comes with title, summary, thumbnail, and distance.
 */
export class WikiNearbyRetriever extends Dog<WikiNearbyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string { return WikiNearbyRetriever.name; }
    get description(): string { return 'Finds nearby Wikipedia articles for given GPS coordinates.'; }
    get icon(): string | undefined { return "\uD83D\uDCDA"; }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [WikiNearbyQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WikiNearbyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WikiNearbyQueryPact, d));
        const query = (queryDog?.collected as WikiNearbyQuery | undefined) ?? ({} as WikiNearbyQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const radius = parseInt(query['radius'] ?? '500', 10);
        const limit = parseInt(query['limit'] ?? '10', 10);
        const lang = query['lang'] ?? 'de';

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('WikiNearbyRetriever: Missing required query params (lat, lng)');
        }

        const key = geoBucketKey("wiki-nearby", lat, lng, radius, {
            extras: { lang, limit },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, WIKI_NEARBY_CACHE_TTL_MS, () =>
                getWikiNearby(lat, lng, radius, limit, lang)
            );
        }
        return getWikiNearby(lat, lng, radius, limit, lang);
    };
}
