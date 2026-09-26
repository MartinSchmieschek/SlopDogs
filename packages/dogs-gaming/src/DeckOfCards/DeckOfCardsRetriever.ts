import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryDeckOfCards } from "./deckOfCardsApiClient";
import type { DeckOfCardsResult } from "./interfaces/deckOfCardsTypes";
import { DeckOfCardsQueryPact, type DeckOfCardsQuery } from "./pacts";

export class DeckOfCardsRetriever extends Dog<DeckOfCardsResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DeckOfCardsRetriever.name;
    }

    get description(): string {
        return "deckofcardsapi.com: Spielkarten-Deck bauen, mischen und ziehen.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDCCF";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DeckOfCardsQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DeckOfCardsResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DeckOfCardsQueryPact, d));
        const query = (queryDog?.collected as DeckOfCardsQuery | undefined) ?? {};
        // Alle Modi sind stateful / stochastisch — kein Cache
        return queryDeckOfCards(query.mode, query.deckId, query.deckCount ?? 1, query.count ?? 1, query.jokers ?? false);
    };
}
