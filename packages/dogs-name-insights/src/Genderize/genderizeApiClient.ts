import type { GenderizeApiResponse, GenderizeResult } from "./interfaces/genderizeTypes";

const GENDERIZE_BASE = "https://api.genderize.io";

export async function getGenderize(name: string, country?: string): Promise<GenderizeResult> {
    if (!name || !name.trim()) {
        throw new Error("GenderizeRetriever: 'name' is required");
    }
    const params = new URLSearchParams({ name: name.trim() });
    if (country && country.trim()) params.set("country_id", country.trim().toUpperCase());

    const url = `${GENDERIZE_BASE}?${params.toString()}`;
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
        throw new Error(`genderize.io failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as GenderizeApiResponse;
    return {
        name: data.name,
        gender: data.gender,
        probability: data.probability,
        sampleCount: data.count,
        countryCode: data.country_id,
    };
}
