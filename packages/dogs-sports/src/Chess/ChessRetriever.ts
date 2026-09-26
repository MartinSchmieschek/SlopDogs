import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryChess } from "./chessApiClient";
import type { ChessResult } from "./interfaces/chessTypes";
import { ChessQueryPact, type ChessQuery } from "./pacts";

const CHESS_CACHE_TTL_MS = 10 * 60 * 1000;

export class ChessRetriever extends Dog<ChessResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ChessRetriever.name;
    }

    get description(): string {
        return "Lichess: Profile, Perf-Stats, Tagespuzzle, Turniere, Top-Players.";
    }

    get icon(): string | undefined {
        return "\u265F\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ChessQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ChessResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ChessQueryPact, d));
        const query = (queryDog?.collected as ChessQuery | undefined) ?? {};
        const endpoint = (query.endpoint ?? "profile").toLowerCase();
        const limit = query.limit ?? 20;
        const key = `chess:${endpoint}:${(query.id ?? "").toLowerCase()}:${(query.perf ?? "").toLowerCase()}:${limit}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, CHESS_CACHE_TTL_MS, () =>
                queryChess(endpoint, query.id, query.perf, limit),
            );
        }
        return queryChess(endpoint, query.id, query.perf, limit);
    };
}
