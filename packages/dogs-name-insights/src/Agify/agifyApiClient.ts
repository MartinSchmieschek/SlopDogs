import type { AgifyApiResponse, AgifyResult } from "./interfaces/agifyTypes";

const AGIFY_BASE = "https://api.agify.io";

export async function getAgify(name: string, country?: string): Promise<AgifyResult> {
    if (!name || !name.trim()) {
        throw new Error("AgifyRetriever: 'name' is required");
    }
    const params = new URLSearchParams({ name: name.trim() });
    if (country && country.trim()) params.set("country_id", country.trim().toUpperCase());

    const url = `${AGIFY_BASE}?${params.toString()}`;
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
        throw new Error(`agify.io failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as AgifyApiResponse;
    return { name: data.name, age: data.age, sampleCount: data.count, countryCode: data.country_id };
}
