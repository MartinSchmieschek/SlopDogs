import type { DeckOfCardsResult } from "./interfaces/deckOfCardsTypes";

const DOC_BASE = "https://deckofcardsapi.com/api/deck";

async function docFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`deckofcardsapi failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryDeckOfCards(
    mode: string = "newShuffled",
    deckId?: string,
    deckCount: number = 1,
    count: number = 1,
    jokers: boolean = false,
): Promise<DeckOfCardsResult> {
    const m = mode.toLowerCase();

    if (m === "newshuffled" || m === "new") {
        const params = new URLSearchParams({ deck_count: String(Math.max(1, Math.min(20, Math.floor(deckCount)))) });
        if (jokers) params.set("jokers_enabled", "true");
        const data = await docFetch<any>(`${DOC_BASE}/new/shuffle/?${params.toString()}`);
        return { mode: m, success: data.success, deckId: data.deck_id, remaining: data.remaining, shuffled: data.shuffled };
    }

    if (m === "draw") {
        if (!deckId?.trim()) throw new Error("DeckOfCardsRetriever: mode=draw requires 'deckId'");
        const n = Math.max(1, Math.min(52, Math.floor(count)));
        const data = await docFetch<any>(`${DOC_BASE}/${encodeURIComponent(deckId.trim())}/draw/?count=${n}`);
        return { mode: m, success: data.success, deckId: data.deck_id, remaining: data.remaining, cards: data.cards };
    }

    if (m === "shuffle") {
        if (!deckId?.trim()) throw new Error("DeckOfCardsRetriever: mode=shuffle requires 'deckId'");
        const data = await docFetch<any>(`${DOC_BASE}/${encodeURIComponent(deckId.trim())}/shuffle/`);
        return { mode: m, success: data.success, deckId: data.deck_id, remaining: data.remaining, shuffled: data.shuffled };
    }

    throw new Error(`DeckOfCardsRetriever: unknown mode "${mode}" (expected: newShuffled, draw, shuffle)`);
}
