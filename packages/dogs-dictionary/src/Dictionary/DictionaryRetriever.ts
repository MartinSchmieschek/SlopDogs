import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getDictionaryEntry } from "./dictionaryApiClient";
import type { DictionaryResult } from "./interfaces/dictionaryTypes";
import { WordQueryPact, type WordQuery } from "../shared/pacts";

const DICTIONARY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class DictionaryRetriever extends Dog<DictionaryResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DictionaryRetriever.name;
    }

    get description(): string {
        return "Definitionen, Phonetik und Synonyme aus dictionaryapi.dev.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCD6";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WordQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DictionaryResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WordQueryPact, d));
        const query = queryDog?.collected as WordQuery | undefined;
        if (!query?.word) {
            throw new Error("DictionaryRetriever: Missing required query param 'word'");
        }
        const lang = query.lang ?? "en";
        const key = `dictionary:${lang}:${query.word.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, DICTIONARY_CACHE_TTL_MS, () =>
                getDictionaryEntry(query.word, lang),
            );
        }
        return getDictionaryEntry(query.word, lang);
    };
}
