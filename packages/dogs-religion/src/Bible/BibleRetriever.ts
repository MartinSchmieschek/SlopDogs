import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getBibleReference } from "./bibleApiClient";
import type { BibleResult } from "./interfaces/bibleTypes";
import { BibleQueryPact, type BibleQuery } from "./pacts";

const BIBLE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class BibleRetriever extends Dog<BibleResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return BibleRetriever.name;
    }

    get description(): string {
        return "Bibel-Referenz via bible-api.com (beliebige Uebersetzung, z.B. 'John 3:16').";
    }

    get icon(): string | undefined {
        return "\u271D\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BibleQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BibleResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BibleQueryPact, d));
        const query = queryDog?.collected as BibleQuery | undefined;
        if (!query?.reference) {
            throw new Error("BibleRetriever: Missing required query param 'reference'");
        }
        const translation = query.translation ?? "web";
        const key = `bible:${translation}:${query.reference.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, BIBLE_CACHE_TTL_MS, () =>
                getBibleReference(query.reference, translation),
            );
        }
        return getBibleReference(query.reference, translation);
    };
}
