import type { NationalizeApiResponse, NationalizeResult } from "./interfaces/nationalizeTypes";

const NATIONALIZE_BASE = "https://api.nationalize.io";

export async function getNationalize(name: string): Promise<NationalizeResult> {
    if (!name || !name.trim()) {
        throw new Error("NationalizeRetriever: 'name' is required");
    }
    const url = `${NATIONALIZE_BASE}?name=${encodeURIComponent(name.trim())}`;
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
        throw new Error(`nationalize.io failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as NationalizeApiResponse;
    const countries = [...(data.country ?? [])].sort((a, b) => b.probability - a.probability);
    return {
        name: data.name,
        sampleCount: data.count,
        countries,
        topCountry: countries[0],
    };
}
