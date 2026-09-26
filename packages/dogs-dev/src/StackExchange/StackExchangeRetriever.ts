import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryStackExchange } from "./stackExchangeApiClient";
import type { StackExchangeResult } from "./interfaces/stackExchangeTypes";
import { StackExchangeQueryPact, type StackExchangeQuery } from "./pacts";

const SE_CACHE_TTL_MS = 30 * 60 * 1000;

export class StackExchangeRetriever extends Dog<StackExchangeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return StackExchangeRetriever.name;
    }

    get description(): string {
        return "Stack Exchange: Top-Fragen, Suche, Tags je Site (stackoverflow, superuser, ...).";
    }

    get icon(): string | undefined {
        return "\u2753";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [StackExchangeQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<StackExchangeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(StackExchangeQueryPact, d));
        const query = (queryDog?.collected as StackExchangeQuery | undefined) ?? {};
        const site = query.site ?? "stackoverflow";
        const endpoint = query.endpoint ?? "questions";
        const sort = query.sort ?? "hot";
        const pagesize = query.pagesize ?? 30;
        const page = query.page ?? 1;

        const key = `stackexchange:${site}:${endpoint}:${(query.q ?? "").toLowerCase()}:${query.tagged ?? ""}:${sort}:${pagesize}:${page}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, SE_CACHE_TTL_MS, () =>
                queryStackExchange(site, endpoint, query.q, query.tagged, sort, pagesize, page),
            );
        }
        return queryStackExchange(site, endpoint, query.q, query.tagged, sort, pagesize, page);
    };
}
