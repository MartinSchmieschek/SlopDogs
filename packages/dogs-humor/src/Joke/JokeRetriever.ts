/**
 * =========================================================================
 *  JOKE RETRIEVER — Witze aus der jokeapi.dev
 * =========================================================================
 *
 *  Jede Beschwoerung zieht frischen Spott aus dem Void. Kein Cache —
 *  ein zweimal erzaehlter Witz ist ein toter Witz.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getJoke } from "./jokeApiClient";
import type { JokeResult } from "./interfaces/jokeTypes";
import { JokeQueryPact, type JokeQuery } from "./pacts";

export class JokeRetriever extends Dog<JokeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return JokeRetriever.name;
    }

    get description(): string {
        return "Holt einen Witz von jokeapi.dev (Kategorie, Sprache, Blacklist-Filter).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDE02";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [JokeQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<JokeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(JokeQueryPact, d));
        const query = (queryDog?.collected as JokeQuery | undefined) ?? ({} as JokeQuery);

        return getJoke(query.category, query.lang, query.blacklist, query.type);
    };
}
