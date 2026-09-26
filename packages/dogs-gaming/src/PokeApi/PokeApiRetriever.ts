import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryPokeApi } from "./pokeApiClient";
import type { PokeApiResult } from "./interfaces/pokeTypes";
import { PokeApiQueryPact, type PokeApiQuery } from "./pacts";

const POKE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class PokeApiRetriever extends Dog<PokeApiResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return PokeApiRetriever.name;
    }

    get description(): string {
        return "PokeAPI: Pokemon, Species, Abilities, Types, Moves, Generations, Natures, Berries, Items, …";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFAE";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PokeApiQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PokeApiResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PokeApiQueryPact, d));
        const query = (queryDog?.collected as PokeApiQuery | undefined) ?? {};
        const endpoint = query.endpoint ?? "pokemon";
        const list = query.list ?? false;
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;
        const key = `pokeapi:${endpoint}:${(query.idOrName ?? "").toLowerCase()}:${list}:${limit}:${offset}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, POKE_CACHE_TTL_MS, () =>
                queryPokeApi(endpoint, query.idOrName, list, limit, offset),
            );
        }
        return queryPokeApi(endpoint, query.idOrName, list, limit, offset);
    };
}
