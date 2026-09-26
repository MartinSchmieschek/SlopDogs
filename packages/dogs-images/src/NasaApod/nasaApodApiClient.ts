import type { NasaApodApiResponse, NasaApodResult } from "./interfaces/nasaApodTypes";

const APOD_BASE = "https://api.nasa.gov/planetary/apod";

/**
 * DEMO_KEY hat 30 Anfragen/Stunde, 50/Tag. Fuer mehr:
 * NASA_API_KEY via ENV setzen (kostenlos auf api.nasa.gov).
 */
function nasaKey(): string {
    return process.env.NASA_API_KEY?.trim() || "DEMO_KEY";
}

export async function getNasaApod(date?: string, hd: boolean = false): Promise<NasaApodResult> {
    const params = new URLSearchParams({ api_key: nasaKey() });
    if (date && date.trim()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
            throw new Error(`NasaApodRetriever: invalid date "${date}" (expected YYYY-MM-DD)`);
        }
        params.set("date", date.trim());
    }
    if (hd) params.set("hd", "true");

    const controller = new AbortController();
    // DEMO_KEY ist stark gedrosselt — 45s Timeout gibt dem Service Luft.
    const timer = setTimeout(() => controller.abort(), 45000);
    let res: Response;
    try {
        res = await fetch(`${APOD_BASE}?${params.toString()}`, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`NASA APOD failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as NasaApodApiResponse;
    return {
        date: data.date,
        title: data.title,
        explanation: data.explanation,
        mediaType: data.media_type,
        url: data.url,
        hdUrl: data.hdurl,
        copyright: data.copyright,
    };
}
