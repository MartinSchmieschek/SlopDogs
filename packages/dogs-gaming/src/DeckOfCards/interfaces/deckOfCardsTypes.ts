export interface DeckCard {
    code: string;
    image: string;
    images?: { svg?: string; png?: string };
    value: string;
    suit: string;
}

export interface DeckOfCardsResult {
    mode: string;
    success: boolean;
    deckId: string;
    remaining: number;
    cards?: DeckCard[];
    shuffled?: boolean;
}
