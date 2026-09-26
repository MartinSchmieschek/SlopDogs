import type { ScryfallResult } from "./interfaces/scryfallTypes";

const SCRYFALL_BASE = "https://api.scryfall.com";

async function scryfallFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
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
        throw new Error(`scryfall failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryScryfall(
    mode: string = "random",
    value: string = "",
    match: string = "exact",
    page: number = 1,
): Promise<ScryfallResult> {
    const m = mode.toLowerCase();

    if (m === "random") {
        const data = await scryfallFetch<unknown>(`${SCRYFALL_BASE}/cards/random`);
        return { mode: m, query: "", data };
    }

    if (m === "named") {
        if (!value.trim()) throw new Error("ScryfallRetriever: mode=named requires 'value'");
        const param = match.toLowerCase() === "fuzzy" ? "fuzzy" : "exact";
        const data = await scryfallFetch<unknown>(`${SCRYFALL_BASE}/cards/named?${param}=${encodeURIComponent(value.trim())}`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "search") {
        if (!value.trim()) throw new Error("ScryfallRetriever: mode=search requires 'value'");
        const p = Math.max(1, Math.floor(page));
        const data = await scryfallFetch<any>(`${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(value.trim())}&page=${p}`);
        return {
            mode: m,
            query: value.trim(),
            data: data.data ?? [],
            totalCards: data.total_cards,
            hasMore: data.has_more,
        };
    }

    throw new Error(`ScryfallRetriever: unknown mode "${mode}" (expected: named, search, random)`);
}
