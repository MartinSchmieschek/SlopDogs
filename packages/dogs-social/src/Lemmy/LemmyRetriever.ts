import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryLemmy } from "./lemmyApiClient";
import type { LemmyResult } from "./interfaces/lemmyTypes";
import { LemmyQueryPact, type LemmyQuery } from "./pacts";

const LEMMY_CACHE_TTL_MS = 5 * 60 * 1000;

export class LemmyRetriever extends Dog<LemmyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return LemmyRetriever.name;
    }

    get description(): string {
        return "Lemmy (Fediverse): Posts/Communities/Search/Site — default lemmy.world, Instanz frei waehlbar.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF31";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [LemmyQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<LemmyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(LemmyQueryPact, d));
        const query = (queryDog?.collected as LemmyQuery | undefined) ?? {};
        const instance = query.instance ?? "lemmy.world";
        const mode = (query.mode ?? "postList").toLowerCase();
        const sort = query.sort ?? "Hot";
        const type = query.type ?? "Local";
        const limit = query.limit ?? 10;
        const page = query.page ?? 1;

        const key = `lemmy:${instance}:${mode}:${(query.community ?? "").toLowerCase()}:${(query.q ?? "").toLowerCase()}:${sort}:${type}:${limit}:${page}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, LEMMY_CACHE_TTL_MS, () =>
                queryLemmy(instance, mode, query.community, query.q, sort, type, limit, page),
            );
        }
        return queryLemmy(instance, mode, query.community, query.q, sort, type, limit, page);
    };
}
