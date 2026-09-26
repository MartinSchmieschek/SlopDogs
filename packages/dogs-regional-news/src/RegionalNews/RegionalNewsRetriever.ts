/**
 * =========================================================================
 *  REGIONAL NEWS RETRIEVER — sniffin' out tidings from the information abyss
 * =========================================================================
 *
 *  Arr, matey! This hound follows a region name into the brooding
 *  depths of RSS feeds, summoning local news, events, and festivals
 *  from the eldritch gulfs of the press.
 *
 *  Google News RSS provides the default quarry, but custom feeds
 *  may be added to widen the hunt — local papers, event calendars,
 *  any XML that flows through the RSS current.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRegionalNews } from "./newsApiClient";
import type { RegionalNewsResult } from "./interfaces/newsTypes";
import { RegionalNewsQueryPact, type RegionalNewsQuery } from "./pacts";

/**
 * Arr, the RegionalNewsRetriever — a spectral hound that sniffs out
 * local news and events for a given region!
 * Headlines, festivals, happenings —
 * all plunder dredged from the RSS abyss.
 */
export class RegionalNewsRetriever extends Dog<RegionalNewsResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return RegionalNewsRetriever.name;
    }

    get description(): string {
        return 'Fetches regional news and events via Google News RSS for a given location. No API key required.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDCF0";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RegionalNewsQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RegionalNewsResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(RegionalNewsQueryPact, d));
        const query = (queryDog?.collected as RegionalNewsQuery | undefined) ?? ({} as RegionalNewsQuery);

        const searchQuery = query['query'];
        const feedUrls = query['feedUrls'] || undefined;
        const limit = parseInt(query['limit'] ?? '20', 10);

        if (!searchQuery && !feedUrls) {
            throw new Error('RegionalNewsRetriever: Missing required query param (query) or feedUrls');
        }

        const key = `news:${searchQuery ?? 'custom'}:${feedUrls ?? 'google'}:${limit}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 15 * 60_000, () =>
                getRegionalNews(searchQuery ?? '', feedUrls, limit)
            );
        }
        return getRegionalNews(searchQuery ?? '', feedUrls, limit);
    };
}
