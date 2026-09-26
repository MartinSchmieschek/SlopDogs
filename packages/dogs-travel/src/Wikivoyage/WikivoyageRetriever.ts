import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getWikivoyageSnippet } from "./wikivoyageApiClient";
import type { WikivoyageResult } from "./interfaces/wikivoyageTypes";
import { WikivoyageQueryPact, type WikivoyageQuery } from "./pacts";

const WV_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class WikivoyageRetriever extends Dog<WikivoyageResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WikivoyageRetriever.name;
    }

    get description(): string {
        return "Wikivoyage-Snippet zu einem Reiseort (MediaWiki-API, keine Keys).";
    }

    get icon(): string | undefined {
        return "\uD83E\uDDF3";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WikivoyageQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WikivoyageResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WikivoyageQueryPact, d));
        const query = queryDog?.collected as WikivoyageQuery | undefined;
        if (!query?.place) {
            throw new Error("WikivoyageRetriever: Missing required query param 'place'");
        }
        const lang = query.lang ?? "en";
        const key = `wikivoyage:${lang}:${query.place.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, WV_CACHE_TTL_MS, () =>
                getWikivoyageSnippet(query.place, lang),
            );
        }
        return getWikivoyageSnippet(query.place, lang);
    };
}
