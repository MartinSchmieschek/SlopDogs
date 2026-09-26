import type { CatFactApiResponse, CatFactResult } from "./interfaces/catFactTypes";

const CAT_FACT_BASE = "https://catfact.ninja/fact";

export async function getCatFact(maxLength?: number): Promise<CatFactResult> {
    const url = maxLength && maxLength > 0
        ? `${CAT_FACT_BASE}?max_length=${encodeURIComponent(String(Math.floor(maxLength)))}`
        : CAT_FACT_BASE;

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
        throw new Error(`catfact.ninja failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as CatFactApiResponse;
    return { fact: data.fact, length: data.length };
}
