import type { DuckApiResponse, DuckResult } from "./interfaces/duckTypes";

const DUCK_BASE = "https://random-d.uk/api/v2/random";

export async function getRandomDuck(): Promise<DuckResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
        res = await fetch(DUCK_BASE, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`random-d.uk failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as DuckApiResponse;
    const url = data.url;
    const lower = url.toLowerCase();
    const mediaType: DuckResult["mediaType"] = lower.endsWith(".gif")
        ? "gif"
        : lower.endsWith(".mp4") || lower.endsWith(".webm")
            ? "video"
            : "image";
    return { mediaUrl: url, mediaType };
}
