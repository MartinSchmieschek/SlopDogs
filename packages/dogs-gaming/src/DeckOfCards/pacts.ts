import { createPact } from "@slopdogs/core";

export interface DeckOfCardsQuery {
    /** Modus: newShuffled (neues gemischtes Deck), draw (Karten aus Deck ziehen), shuffle (reshuffle) */
    mode?: string;
    /** Deck-ID fuer draw/shuffle — bei newShuffled wird sie erzeugt */
    deckId?: string;
    /** Anzahl Decks zusammenmischen (newShuffled) — default 1 */
    deckCount?: number;
    /** Anzahl Karten ziehen (draw) — default 1 */
    count?: number;
    /** Nur Jokers einbeziehen (newShuffled) — default false */
    jokers?: boolean;
}

export const DeckOfCardsQueryPact = createPact<DeckOfCardsQuery>(
    "DeckOfCardsQueryProvider",
    { fromSourceType: "DeckOfCardsQuery" }
);
