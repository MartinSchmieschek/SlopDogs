import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryTvMaze } from "./tvMazeApiClient";
import type { TvMazeResult } from "./interfaces/tvMazeTypes";
import { TvMazeQueryPact, type TvMazeQuery } from "./pacts";

const TVMAZE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class TvMazeRetriever extends Dog<TvMazeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return TvMazeRetriever.name;
    }

    get description(): string {
        return "TvMaze: Serien, Episoden, Cast, Sendeplaene (search/singleSearch/show/episodes/cast/schedule).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCFA";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [TvMazeQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TvMazeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(TvMazeQueryPact, d));
        const query = (queryDog?.collected as TvMazeQuery | undefined) ?? {};
        const mode = (query.mode ?? "search").toLowerCase();
        const value = query.value ?? "";
        const key = `tvmaze:${mode}:${value.toLowerCase()}:${query.date ?? ""}:${query.embed ?? ""}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, TVMAZE_CACHE_TTL_MS, () =>
                queryTvMaze(mode, value, query.date, query.embed),
            );
        }
        return queryTvMaze(mode, value, query.date, query.embed);
    };
}
