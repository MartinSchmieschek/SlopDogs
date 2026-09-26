import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryOpenFda } from "./openFdaApiClient";
import type { OpenFdaResult } from "./interfaces/openFdaTypes";
import { OpenFdaQueryPact, type OpenFdaQuery } from "./pacts";

const FDA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class OpenFdaRetriever extends Dog<OpenFdaResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return OpenFdaRetriever.name;
    }

    get description(): string {
        return "openFDA: Drug/Device/Food events, enforcement (Rueckrufe), labels. Suchausdruecke in openFDA-Syntax.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDC8A";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OpenFdaQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OpenFdaResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(OpenFdaQueryPact, d));
        const query = (queryDog?.collected as OpenFdaQuery | undefined) ?? {};
        const endpoint = query.endpoint ?? "drug/event";
        const limit = query.limit ?? 10;
        const skip = query.skip ?? 0;
        const key = `openfda:${endpoint}:${(query.search ?? "").toLowerCase()}:${limit}:${skip}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, FDA_CACHE_TTL_MS, () =>
                queryOpenFda(endpoint, query.search, limit, skip),
            );
        }
        return queryOpenFda(endpoint, query.search, limit, skip);
    };
}
