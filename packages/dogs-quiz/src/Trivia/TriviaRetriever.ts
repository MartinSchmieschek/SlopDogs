import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getTrivia } from "./triviaApiClient";
import type { TriviaResult } from "./interfaces/triviaTypes";
import { TriviaQueryPact, type TriviaQuery } from "./pacts";

export class TriviaRetriever extends Dog<TriviaResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return TriviaRetriever.name;
    }

    get description(): string {
        return "Quizfragen von opentdb.com (Kategorie, Schwierigkeit, Typ).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFAF";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [TriviaQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TriviaResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(TriviaQueryPact, d));
        const query = (queryDog?.collected as TriviaQuery | undefined) ?? {};
        return getTrivia(query.amount, query.category, query.difficulty, query.type);
    };
}
