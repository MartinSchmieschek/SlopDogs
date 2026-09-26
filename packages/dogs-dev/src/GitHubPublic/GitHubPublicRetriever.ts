import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryGitHubPublic } from "./gitHubPublicApiClient";
import type { GitHubPublicResult } from "./interfaces/gitHubPublicTypes";
import { GitHubPublicQueryPact, type GitHubPublicQuery } from "./pacts";

const GH_CACHE_TTL_MS = 15 * 60 * 1000;

export class GitHubPublicRetriever extends Dog<GitHubPublicResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GitHubPublicRetriever.name;
    }

    get description(): string {
        return "GitHub Public API (anonym, rate-limitiert): user/repo/orgRepos/userRepos/search.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEE0\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [GitHubPublicQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GitHubPublicResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(GitHubPublicQueryPact, d));
        const query = (queryDog?.collected as GitHubPublicQuery | undefined) ?? {};
        const mode = query.mode ?? "repo";
        const searchType = query.searchType ?? "repositories";
        const sort = query.sort ?? "stars";
        const page = query.page ?? 1;
        const perPage = query.perPage ?? 30;

        const key = `ghpublic:${mode}:${(query.login ?? "").toLowerCase()}:${(query.repo ?? "").toLowerCase()}:${(query.q ?? "").toLowerCase()}:${searchType}:${sort}:${page}:${perPage}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GH_CACHE_TTL_MS, () =>
                queryGitHubPublic(mode, query.login, query.repo, query.q, searchType, sort, page, perPage),
            );
        }
        return queryGitHubPublic(mode, query.login, query.repo, query.q, searchType, sort, page, perPage);
    };
}
