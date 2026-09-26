import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getDatamuseWords } from "./datamuseApiClient";
import type { DatamuseResult } from "./interfaces/datamuseTypes";
import { DatamuseQueryPact, type DatamuseQuery } from "./pacts";

const DATAMUSE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class DatamuseRetriever extends Dog<DatamuseResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DatamuseRetriever.name;
    }

    get description(): string {
        return "Datamuse: Reime, Synonyme, verwandte Woerter (relation: rhy/syn/ant/ml/sl/…).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDD24";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DatamuseQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DatamuseResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DatamuseQueryPact, d));
        const query = queryDog?.collected as DatamuseQuery | undefined;
        if (!query?.word) {
            throw new Error("DatamuseRetriever: Missing required query param 'word'");
        }
        const relation = query.relation ?? "rhy";
        const max = query.max ?? 20;
        const key = `datamuse:${relation}:${max}:${query.word.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, DATAMUSE_CACHE_TTL_MS, () =>
                getDatamuseWords(query.word, relation, max),
            );
        }
        return getDatamuseWords(query.word, relation, max);
    };
}
