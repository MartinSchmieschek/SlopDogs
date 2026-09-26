import type { JokeApiResponse, JokeResult } from "./interfaces/jokeTypes";

const JOKE_API_BASE = "https://v2.jokeapi.dev/joke";

export async function getJoke(
    category: string = "Any",
    lang: string = "en",
    blacklist?: string,
    type?: string,
): Promise<JokeResult> {
    const params = new URLSearchParams({ lang });
    if (blacklist) params.set("blacklistFlags", blacklist);
    if (type === "single" || type === "twopart") params.set("type", type);

    const url = `${JOKE_API_BASE}/${encodeURIComponent(category)}?${params.toString()}`;

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
        throw new Error(`JokeAPI failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as JokeApiResponse;

    if (data.error) {
        throw new Error(`JokeAPI returned error payload for category="${category}"`);
    }

    const jokeType = (data.type === "twopart" ? "twopart" : "single") as JokeResult["type"];
    const jokeText = jokeType === "twopart"
        ? `${data.setup ?? ""} — ${data.delivery ?? ""}`
        : (data.joke ?? "");

    return {
        category: data.category ?? category,
        type: jokeType,
        joke: jokeText,
        setup: data.setup,
        delivery: data.delivery,
        language: data.lang ?? lang,
        id: data.id,
        flags: data.flags,
    };
}
