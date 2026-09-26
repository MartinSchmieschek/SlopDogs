import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { searchGutenberg } from "./gutenbergApiClient";
import type { GutenbergResult } from "./interfaces/gutenbergTypes";
import { GutenbergQueryPact, type GutenbergQuery } from "./pacts";

const GUTENBERG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class GutenbergRetriever extends Dog<GutenbergResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GutenbergRetriever.name;
    }

    get description(): string {
        return "Durchsucht Project Gutenberg (gutendex.com) nach freien Buechern.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCDA";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [GutenbergQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GutenbergResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(GutenbergQueryPact, d));
        const query = (queryDog?.collected as GutenbergQuery | undefined) ?? ({} as GutenbergQuery);
        const page = query.page ?? 1;
        const search = (query.search ?? "").toLowerCase().trim();
        const language = (query.language ?? "").toLowerCase().trim();
        const topic = (query.topic ?? "").toLowerCase().trim();
        const key = `gutenberg:${search}:${language}:${topic}:${page}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GUTENBERG_CACHE_TTL_MS, () =>
                searchGutenberg(query.search, query.language, query.topic, page),
            );
        }
        return searchGutenberg(query.search, query.language, query.topic, page);
    };
}
