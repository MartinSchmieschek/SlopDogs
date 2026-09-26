import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryHackerNews } from "./hackerNewsApiClient";
import type { HackerNewsResult } from "./interfaces/hackerNewsTypes";
import { HackerNewsQueryPact, type HackerNewsQuery } from "./pacts";

const HN_CACHE_TTL_MS = 5 * 60 * 1000;

export class HackerNewsRetriever extends Dog<HackerNewsResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return HackerNewsRetriever.name;
    }

    get description(): string {
        return "Hacker News Firebase API: top/new/best/ask/show/job stories oder item/user-Lookup.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDD36";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [HackerNewsQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<HackerNewsResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(HackerNewsQueryPact, d));
        const query = (queryDog?.collected as HackerNewsQuery | undefined) ?? {};
        const endpoint = (query.endpoint ?? "top").toLowerCase();
        const limit = query.limit ?? 20;
        const hydrate = query.hydrate ?? true;
        const key = `hackernews:${endpoint}:${(query.id ?? "").toLowerCase()}:${limit}:${hydrate}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, HN_CACHE_TTL_MS, () =>
                queryHackerNews(endpoint, query.id, limit, hydrate),
            );
        }
        return queryHackerNews(endpoint, query.id, limit, hydrate);
    };
}
