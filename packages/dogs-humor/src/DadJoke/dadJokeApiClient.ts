import type { DadJokeApiResponse, DadJokeSearchApiResponse, DadJokeResult } from "./interfaces/dadJokeTypes";

const DAD_JOKE_BASE = "https://icanhazdadjoke.com";

async function dadJokeFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.1 (https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`icanhazdadjoke failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function getDadJoke(term?: string): Promise<DadJokeResult> {
    if (term && term.trim().length > 0) {
        const data = await dadJokeFetch<DadJokeSearchApiResponse>(
            `${DAD_JOKE_BASE}/search?term=${encodeURIComponent(term)}&limit=30`,
        );
        const results = data.results ?? [];
        if (results.length === 0) {
            throw new Error(`icanhazdadjoke: no jokes found for term="${term}"`);
        }
        const pick = results[Math.floor(Math.random() * results.length)];
        return { id: pick.id, joke: pick.joke, searchTerm: term };
    }
    const data = await dadJokeFetch<DadJokeApiResponse>(DAD_JOKE_BASE);
    return { id: data.id, joke: data.joke };
}
