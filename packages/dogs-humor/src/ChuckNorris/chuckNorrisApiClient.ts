import type { ChuckNorrisApiResponse, ChuckNorrisResult } from "./interfaces/chuckNorrisTypes";

const CHUCK_BASE = "https://api.chucknorris.io/jokes";

export async function getChuckNorris(category?: string): Promise<ChuckNorrisResult> {
    const url = category && category.trim().length > 0
        ? `${CHUCK_BASE}/random?category=${encodeURIComponent(category.trim())}`
        : `${CHUCK_BASE}/random`;

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
        throw new Error(`chucknorris.io failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as ChuckNorrisApiResponse;
    return {
        id: data.id,
        joke: data.value,
        url: data.url,
        categories: data.categories ?? [],
        iconUrl: data.icon_url,
    };
}
