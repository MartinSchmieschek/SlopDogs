import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { querySportsDb } from "./sportsDbApiClient";
import type { SportsDbResult } from "./interfaces/sportsDbTypes";
import { SportsDbQueryPact, type SportsDbQuery } from "./pacts";

const SDB_CACHE_TTL_MS = 60 * 60 * 1000;

export class SportsDBRetriever extends Dog<SportsDbResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return SportsDBRetriever.name;
    }

    get description(): string {
        return "TheSportsDB: Teams, Spieler, Ligen, Events — diverse Endpoints (searchteams/lookupteam/eventsnext/…).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFC6";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [SportsDbQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<SportsDbResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(SportsDbQueryPact, d));
        const query = (queryDog?.collected as SportsDbQuery | undefined) ?? {};
        const endpoint = (query.endpoint ?? "searchteams").toLowerCase();
        const value = query.query ?? "";
        const key = `sportsdb:${endpoint}:${value.toLowerCase()}:${query.arg2 ?? ""}:${query.arg3 ?? ""}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, SDB_CACHE_TTL_MS, () =>
                querySportsDb(endpoint, value, query.arg2, query.arg3),
            );
        }
        return querySportsDb(endpoint, value, query.arg2, query.arg3);
    };
}
