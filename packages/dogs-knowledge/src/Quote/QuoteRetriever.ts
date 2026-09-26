import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRandomQuote } from "./quoteApiClient";
import type { QuoteResult } from "./interfaces/quoteTypes";
import { QuoteQueryPact, type QuoteQuery } from "./pacts";

export class QuoteRetriever extends Dog<QuoteResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return QuoteRetriever.name;
    }

    get description(): string {
        return "Zufallszitat von quotable.io (optional nach Autor, Tag, Laenge gefiltert).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCAC";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [QuoteQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<QuoteResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(QuoteQueryPact, d));
        const query = (queryDog?.collected as QuoteQuery | undefined) ?? ({} as QuoteQuery);
        return getRandomQuote(query.author, query.tag, query.minLength, query.maxLength);
    };
}
