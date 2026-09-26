import type { ChessResult } from "./interfaces/chessTypes";

const LICHESS_BASE = "https://lichess.org/api";

async function chessFetch<T>(url: string): Promise<T> {
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
        throw new Error(`lichess failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryChess(
    endpoint: string = "profile",
    id?: string,
    perf?: string,
    limit: number = 20,
): Promise<ChessResult> {
    const ep = endpoint.toLowerCase();
    if (ep === "puzzledaily") {
        const data = await chessFetch<unknown>(`${LICHESS_BASE}/puzzle/daily`);
        return { endpoint: ep, data };
    }
    if (ep === "profile") {
        if (!id?.trim()) throw new Error("ChessRetriever: endpoint=profile requires 'id' (username)");
        const data = await chessFetch<unknown>(`${LICHESS_BASE}/user/${encodeURIComponent(id.trim())}`);
        return { endpoint: ep, data };
    }
    if (ep === "stats") {
        if (!id?.trim() || !perf?.trim()) {
            throw new Error("ChessRetriever: endpoint=stats requires 'id' (username) and 'perf'");
        }
        const data = await chessFetch<unknown>(`${LICHESS_BASE}/user/${encodeURIComponent(id.trim())}/perf/${encodeURIComponent(perf.trim())}`);
        return { endpoint: ep, data };
    }
    if (ep === "tournament") {
        if (!id?.trim()) throw new Error("ChessRetriever: endpoint=tournament requires 'id' (tournament ID)");
        const data = await chessFetch<unknown>(`${LICHESS_BASE}/tournament/${encodeURIComponent(id.trim())}`);
        return { endpoint: ep, data };
    }
    if (ep === "topplayers") {
        const p = perf ?? "bullet";
        const clamped = Math.max(1, Math.min(200, Math.floor(limit)));
        const data = await chessFetch<unknown>(`${LICHESS_BASE}/player/top/${clamped}/${encodeURIComponent(p)}`);
        return { endpoint: ep, data };
    }
    throw new Error(`ChessRetriever: unknown endpoint "${endpoint}" (expected: profile, stats, puzzleDaily, tournament, topPlayers)`);
}
