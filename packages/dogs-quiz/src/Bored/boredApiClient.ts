import type { BoredApiResponse, BoredResult } from "./interfaces/boredTypes";

const BORED_BASE = "https://bored-api.appbrewery.com/random";

export async function getBoredActivity(
    type?: string,
    participants?: number,
    maxPrice?: number,
    maxAccessibility?: number,
): Promise<BoredResult> {
    const params = new URLSearchParams();
    if (type && type.trim()) params.set("type", type.trim());
    if (participants && participants > 0) params.set("participants", String(Math.floor(participants)));
    if (typeof maxPrice === "number") params.set("maxprice", String(maxPrice));
    if (typeof maxAccessibility === "number") params.set("maxaccessibility", String(maxAccessibility));

    const url = params.toString() ? `${BORED_BASE}?${params.toString()}` : BORED_BASE;

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
        throw new Error(`bored-api failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as BoredApiResponse;
    if (data.error) {
        throw new Error(`bored-api error: ${data.error}`);
    }
    return {
        activity: data.activity ?? "",
        type: data.type ?? "",
        participants: data.participants ?? 0,
        price: data.price ?? 0,
        accessibility: data.accessibility ?? 0,
        link: data.link,
        key: data.key,
    };
}
