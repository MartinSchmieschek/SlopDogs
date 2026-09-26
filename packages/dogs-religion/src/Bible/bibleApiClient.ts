import type { BibleApiResponse, BibleResult } from "./interfaces/bibleTypes";

const BIBLE_BASE = "https://bible-api.com";

export async function getBibleReference(reference: string, translation: string = "web"): Promise<BibleResult> {
    if (!reference || !reference.trim()) {
        throw new Error("BibleRetriever: 'reference' is required");
    }
    const url = `${BIBLE_BASE}/${encodeURIComponent(reference.trim())}?translation=${encodeURIComponent(translation.trim())}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
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
        throw new Error(`bible-api failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as BibleApiResponse;
    if (data.error) {
        throw new Error(`bible-api error: ${data.error}`);
    }
    return {
        reference: data.reference ?? reference,
        translationId: data.translation_id ?? translation,
        translationName: data.translation_name,
        text: (data.text ?? "").trim(),
        verses: data.verses ?? [],
    };
}
