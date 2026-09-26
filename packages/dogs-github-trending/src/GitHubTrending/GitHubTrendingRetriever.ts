/**
 * =========================================================================
 *  GITHUB TRENDING RETRIEVER — surfacing trending repos from the void
 * =========================================================================
 *
 *  Arr, matey! This hound sniffs out the hottest repositories on
 *  GitHub — trending by stars, filtered by language and time range —
 *  all surfaced from the developer void.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getTrending } from "./gitHubTrendingApiClient";
import type { GitHubTrendingResult } from "./interfaces/gitHubTrendingTypes";
import { GitHubTrendingQueryPact, type GitHubTrendingQuery } from "./pacts";

/**
 * Arr, the GitHubTrendingRetriever — a spectral hound that sniffs out
 * the hottest trending repositories from the developer void!
 */
export class GitHubTrendingRetriever extends Dog<GitHubTrendingResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GitHubTrendingRetriever.name;
    }

    get description(): string {
        return 'Fetches trending GitHub repositories by stars, with optional language and time range filters.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDC19";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [GitHubTrendingQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GitHubTrendingResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(GitHubTrendingQueryPact, d));
        const query = (queryDog?.collected as GitHubTrendingQuery | undefined) ?? ({} as GitHubTrendingQuery);

        const language = query['language'];
        const since = query['since'] ?? "daily";
        const key = `github-trending:${language ?? 'all'}:${since}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 15 * 60_000, () =>
                getTrending(language, since)
            );
        }
        return getTrending(language, since);
    };
}
