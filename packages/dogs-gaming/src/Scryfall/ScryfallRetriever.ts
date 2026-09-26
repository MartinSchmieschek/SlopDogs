import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryScryfall } from "./scryfallApiClient";
import type { ScryfallResult } from "./interfaces/scryfallTypes";
import { ScryfallQueryPact, type ScryfallQuery } from "./pacts";

const SCRYFALL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class ScryfallRetriever extends Dog<ScryfallResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ScryfallRetriever.name;
    }

    get description(): string {
        return "Scryfall: Magic the Gathering Karten — named/search/random (alle Sets und Sprachen).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFB4";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ScryfallQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ScryfallResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ScryfallQueryPact, d));
        const query = (queryDog?.collected as ScryfallQuery | undefined) ?? {};
        const mode = (query.mode ?? "random").toLowerCase();
        const value = query.value ?? "";
        const match = query.match ?? "exact";
        const page = query.page ?? 1;

        // random nicht cachen
        if (mode !== "random" && this.cacheHandler) {
            const key = `scryfall:${mode}:${match}:${value.toLowerCase()}:${page}`;
            return this.cacheHandler.getOrFetch(key, SCRYFALL_CACHE_TTL_MS, () =>
                queryScryfall(mode, value, match, page),
            );
        }
        return queryScryfall(mode, value, match, page);
    };
}
