/**
 * =========================================================================
 *  RANDOM FACT RETRIEVER — dredging trivia from the knowledge-void
 * =========================================================================
 *
 *  Arr, matey! This hound fetches a random fun fact from the
 *  uselessfacts API. No caching — every call conjures a fresh
 *  morsel of trivia from the abyss.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRandomFact } from "./randomFactApiClient";
import type { RandomFactResult } from "./interfaces/randomFactTypes";
import { RandomFactQueryPact, type RandomFactQuery } from "./pacts";

/**
 * Arr, the RandomFactRetriever — a spectral hound that dredges
 * random fun facts from the uselessfacts abyss! Each summon
 * yields a different morsel of trivia, matey.
 */
export class RandomFactRetriever extends Dog<RandomFactResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return RandomFactRetriever.name;
    }

    get description(): string {
        return 'Fetches a random fun fact from the uselessfacts API.';
    }

    get icon(): string | undefined {
        return "\uD83E\uDD14";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RandomFactQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RandomFactResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(RandomFactQueryPact, d));
        const query = (queryDog?.collected as RandomFactQuery | undefined) ?? ({} as RandomFactQuery);

        const lang = query['lang'] ?? 'en';

        // No caching — always fetch fresh random facts
        return getRandomFact(lang);
    };
}
