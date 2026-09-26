import type { HackerNewsItem, HackerNewsResult, HackerNewsUser } from "./interfaces/hackerNewsTypes";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

const LIST_ENDPOINTS: Record<string, string> = {
    top: "topstories.json",
    new: "newstories.json",
    best: "beststories.json",
    ask: "askstories.json",
    show: "showstories.json",
    job: "jobstories.json",
};

async function hnFetch<T>(url: string): Promise<T> {
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
        throw new Error(`hacker-news failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryHackerNews(
    endpoint: string = "top",
    id?: string,
    limit: number = 20,
    hydrate: boolean = true,
): Promise<HackerNewsResult> {
    const ep = endpoint.toLowerCase();

    if (ep === "item") {
        if (!id?.trim()) throw new Error("HackerNewsRetriever: endpoint=item requires 'id'");
        const item = await hnFetch<HackerNewsItem | null>(`${HN_BASE}/item/${encodeURIComponent(id.trim())}.json`);
        if (!item) throw new Error(`hacker-news: item ${id} not found`);
        return { endpoint: ep, item };
    }

    if (ep === "user") {
        if (!id?.trim()) throw new Error("HackerNewsRetriever: endpoint=user requires 'id'");
        const user = await hnFetch<HackerNewsUser | null>(`${HN_BASE}/user/${encodeURIComponent(id.trim())}.json`);
        if (!user) throw new Error(`hacker-news: user ${id} not found`);
        return { endpoint: ep, user };
    }

    const listPath = LIST_ENDPOINTS[ep];
    if (!listPath) {
        throw new Error(`HackerNewsRetriever: unknown endpoint "${endpoint}" (expected: ${[...Object.keys(LIST_ENDPOINTS), "item", "user"].join(", ")})`);
    }

    const l = Math.max(1, Math.min(500, Math.floor(limit)));
    const ids = await hnFetch<number[]>(`${HN_BASE}/${listPath}`);
    const slice = ids.slice(0, l);

    if (!hydrate) {
        return { endpoint: ep, totalIds: ids.length, items: slice.map(id => ({ id } as HackerNewsItem)) };
    }

    const items = await Promise.all(slice.map(id =>
        hnFetch<HackerNewsItem | null>(`${HN_BASE}/item/${id}.json`),
    ));
    return { endpoint: ep, totalIds: ids.length, items: items.filter((x): x is HackerNewsItem => Boolean(x)) };
}
