import type { CoinGeckoResult } from "./interfaces/coinGeckoTypes";

/**
 * CoinGecko Demo (ehemals "public") API. Ohne Key: 5-15 req/min,
 * mit kostenlosem Demo-Key (COINGECKO_API_KEY) ~30 req/min.
 */
const CG_BASE = "https://api.coingecko.com/api/v3";

async function cgFetch<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {
        "Accept": "application/json",
        "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
    };
    const key = process.env.COINGECKO_API_KEY?.trim();
    if (key) headers["x-cg-demo-api-key"] = key;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
        res = await fetch(url, { headers, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`coingecko failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryCoinGecko(
    mode: string = "price",
    ids: string = "bitcoin",
    vs: string = "usd",
    q: string = "",
    perPage: number = 10,
    page: number = 1,
    includeChange: boolean = true,
): Promise<CoinGeckoResult> {
    const m = mode.toLowerCase();

    if (m === "price") {
        const params = new URLSearchParams({
            ids: ids.trim() || "bitcoin",
            vs_currencies: vs.trim() || "usd",
        });
        if (includeChange) params.set("include_24hr_change", "true");
        const data = await cgFetch<unknown>(`${CG_BASE}/simple/price?${params.toString()}`);
        return { mode: m, query: `${ids}/${vs}`, data };
    }

    if (m === "markets") {
        const params = new URLSearchParams({
            vs_currency: vs.trim() || "usd",
            order: "market_cap_desc",
            per_page: String(Math.max(1, Math.min(250, Math.floor(perPage)))),
            page: String(Math.max(1, Math.floor(page))),
            sparkline: "false",
        });
        const data = await cgFetch<unknown>(`${CG_BASE}/coins/markets?${params.toString()}`);
        return { mode: m, query: `${vs}:page=${page}`, data };
    }

    if (m === "coin") {
        if (!ids.trim()) throw new Error("CoinGeckoRetriever: mode=coin requires 'ids' (single coin slug)");
        const slug = ids.trim().split(",")[0];
        const data = await cgFetch<unknown>(`${CG_BASE}/coins/${encodeURIComponent(slug)}?localization=false&tickers=false&community_data=false&developer_data=false`);
        return { mode: m, query: slug, data };
    }

    if (m === "trending") {
        const data = await cgFetch<unknown>(`${CG_BASE}/search/trending`);
        return { mode: m, query: "", data };
    }

    if (m === "search") {
        if (!q.trim()) throw new Error("CoinGeckoRetriever: mode=search requires 'q'");
        const data = await cgFetch<unknown>(`${CG_BASE}/search?query=${encodeURIComponent(q.trim())}`);
        return { mode: m, query: q.trim(), data };
    }

    if (m === "global") {
        const data = await cgFetch<unknown>(`${CG_BASE}/global`);
        return { mode: m, query: "", data };
    }

    throw new Error(`CoinGeckoRetriever: unknown mode "${mode}" (expected: price, markets, coin, trending, search, global)`);
}
