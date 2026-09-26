import type { TvMazeResult } from "./interfaces/tvMazeTypes";

const TVMAZE_BASE = "https://api.tvmaze.com";

async function tvMazeFetch<T>(url: string): Promise<T> {
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
        throw new Error(`tvmaze failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryTvMaze(
    mode: string = "search",
    value: string = "",
    date?: string,
    embed?: string,
): Promise<TvMazeResult> {
    const m = mode.toLowerCase();

    if (m === "search") {
        if (!value.trim()) throw new Error("TvMazeRetriever: mode=search requires 'value'");
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/search/shows?q=${encodeURIComponent(value.trim())}`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "singlesearch") {
        if (!value.trim()) throw new Error("TvMazeRetriever: mode=singleSearch requires 'value'");
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/singlesearch/shows?q=${encodeURIComponent(value.trim())}`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "show") {
        if (!value.trim()) throw new Error("TvMazeRetriever: mode=show requires 'value' (show ID)");
        const params = new URLSearchParams();
        if (embed && embed.trim()) params.set("embed", embed.trim());
        const qs = params.toString() ? `?${params.toString()}` : "";
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/shows/${encodeURIComponent(value.trim())}${qs}`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "episodes") {
        if (!value.trim()) throw new Error("TvMazeRetriever: mode=episodes requires 'value' (show ID)");
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/shows/${encodeURIComponent(value.trim())}/episodes`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "cast") {
        if (!value.trim()) throw new Error("TvMazeRetriever: mode=cast requires 'value' (show ID)");
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/shows/${encodeURIComponent(value.trim())}/cast`);
        return { mode: m, query: value.trim(), data };
    }

    if (m === "schedule") {
        const country = value?.trim() || "US";
        const params = new URLSearchParams({ country });
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) params.set("date", date.trim());
        const data = await tvMazeFetch<unknown>(`${TVMAZE_BASE}/schedule?${params.toString()}`);
        return { mode: m, query: `${country}${date ? ":" + date : ""}`, data };
    }

    throw new Error(`TvMazeRetriever: unknown mode "${mode}" (expected: search, singleSearch, show, episodes, cast, schedule)`);
}
