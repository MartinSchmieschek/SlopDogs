import type { LemmyResult } from "./interfaces/lemmyTypes";

async function lemmyFetch<T>(url: string): Promise<T> {
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
        throw new Error(`lemmy ${url} failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

function instanceBase(instance: string): string {
    const trimmed = instance.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${trimmed}/api/v3`;
}

export async function queryLemmy(
    instance: string = "lemmy.world",
    mode: string = "postList",
    community?: string,
    q?: string,
    sort: string = "Hot",
    type: string = "Local",
    limit: number = 10,
    page: number = 1,
): Promise<LemmyResult> {
    const base = instanceBase(instance);
    const m = mode.toLowerCase();
    const l = Math.max(1, Math.min(50, Math.floor(limit)));
    const p = Math.max(1, Math.floor(page));

    if (m === "site") {
        const data = await lemmyFetch<unknown>(`${base}/site`);
        return { instance, mode: m, data };
    }

    if (m === "community") {
        if (!community?.trim()) throw new Error("LemmyRetriever: mode=community requires 'community'");
        const data = await lemmyFetch<unknown>(`${base}/community?name=${encodeURIComponent(community.trim())}`);
        return { instance, mode: m, data };
    }

    if (m === "search") {
        if (!q?.trim()) throw new Error("LemmyRetriever: mode=search requires 'q'");
        const params = new URLSearchParams({
            q: q.trim(),
            sort,
            type_: type,
            limit: String(l),
            page: String(p),
        });
        if (community?.trim()) params.set("community_name", community.trim());
        const data = await lemmyFetch<unknown>(`${base}/search?${params.toString()}`);
        return { instance, mode: m, data };
    }

    if (m === "postlist") {
        const params = new URLSearchParams({
            sort,
            type_: type,
            limit: String(l),
            page: String(p),
        });
        if (community?.trim()) params.set("community_name", community.trim());
        const data = await lemmyFetch<unknown>(`${base}/post/list?${params.toString()}`);
        return { instance, mode: m, data };
    }

    throw new Error(`LemmyRetriever: unknown mode "${mode}" (expected: postList, community, search, site)`);
}
