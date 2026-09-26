import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryCoinGecko } from "./coinGeckoApiClient";
import type { CoinGeckoResult } from "./interfaces/coinGeckoTypes";
import { CoinGeckoQueryPact, type CoinGeckoQuery } from "./pacts";

/** Preise variieren sekuendlich — aber CoinGecko rate-limited hart; 60s Cache ist ein Kompromiss. */
const CG_CACHE_TTL_MS = 60 * 1000;

export class CoinGeckoRetriever extends Dog<CoinGeckoResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return CoinGeckoRetriever.name;
    }

    get description(): string {
        return "CoinGecko: Krypto-Preise, Markets, Coin-Details, Trending, Global-Stats, Suche.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD8E";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [CoinGeckoQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<CoinGeckoResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(CoinGeckoQueryPact, d));
        const query = (queryDog?.collected as CoinGeckoQuery | undefined) ?? {};
        const mode = (query.mode ?? "price").toLowerCase();
        const ids = query.ids ?? "bitcoin";
        const vs = query.vs ?? "usd";
        const q = query.q ?? "";
        const perPage = query.perPage ?? 10;
        const page = query.page ?? 1;
        const includeChange = query.includeChange ?? true;

        const key = `coingecko:${mode}:${ids.toLowerCase()}:${vs.toLowerCase()}:${q.toLowerCase()}:${perPage}:${page}:${includeChange}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, CG_CACHE_TTL_MS, () =>
                queryCoinGecko(mode, ids, vs, q, perPage, page, includeChange),
            );
        }
        return queryCoinGecko(mode, ids, vs, q, perPage, page, includeChange);
    };
}
