import type { StackExchangeResult } from "./interfaces/stackExchangeTypes";

const SE_BASE = "https://api.stackexchange.com/2.3";

async function seFetch<T>(url: string): Promise<T> {
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
        throw new Error(`stackexchange failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryStackExchange(
    site: string = "stackoverflow",
    endpoint: string = "questions",
    q?: string,
    tagged?: string,
    sort: string = "hot",
    pagesize: number = 30,
    page: number = 1,
): Promise<StackExchangeResult> {
    const ep = endpoint.toLowerCase();
    const params = new URLSearchParams({
        site,
        order: "desc",
        sort,
        pagesize: String(Math.max(1, Math.min(100, Math.floor(pagesize)))),
        page: String(Math.max(1, Math.floor(page))),
    });
    if (tagged && tagged.trim()) params.set("tagged", tagged.trim());

    let path: string;
    if (ep === "questions") {
        path = "questions";
    } else if (ep === "search") {
        if (!q || !q.trim()) throw new Error("StackExchangeRetriever: endpoint=search requires 'q'");
        params.set("intitle", q.trim());
        path = "search";
    } else if (ep === "tags") {
        path = "tags";
    } else {
        throw new Error(`StackExchangeRetriever: unknown endpoint "${endpoint}" (expected: questions, search, tags)`);
    }

    const raw = await seFetch<any>(`${SE_BASE}/${path}?${params.toString()}`);
    return {
        site,
        endpoint: ep,
        quotaMax: raw.quota_max,
        quotaRemaining: raw.quota_remaining,
        hasMore: raw.has_more,
        items: raw.items ?? [],
    };
}
