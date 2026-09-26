import type { QuranResult } from "./interfaces/quranTypes";

const QURAN_BASE = "https://api.alquran.cloud/v1";

async function quranFetch<T>(url: string): Promise<T> {
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
        throw new Error(`alquran.cloud failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const body = await res.json() as { code?: number; status?: string; data?: unknown };
    if (body.code !== 200) {
        throw new Error(`alquran.cloud error: ${body.status ?? body.code}`);
    }
    return body.data as T;
}

export async function queryQuran(
    mode: string = "ayah",
    reference?: string,
    edition: string = "en.sahih",
): Promise<QuranResult> {
    const m = mode.toLowerCase();
    if (m === "random") {
        // Zufalls-Aya: we pick 1..6236 client-side
        const n = Math.floor(Math.random() * 6236) + 1;
        const data = await quranFetch<unknown>(`${QURAN_BASE}/ayah/${n}/${encodeURIComponent(edition)}`);
        return { mode: m, edition, reference: String(n), data };
    }
    if (!reference?.trim()) {
        throw new Error(`QuranRetriever: mode="${mode}" requires 'reference'`);
    }
    if (m === "ayah") {
        const data = await quranFetch<unknown>(`${QURAN_BASE}/ayah/${encodeURIComponent(reference.trim())}/${encodeURIComponent(edition)}`);
        return { mode: m, edition, reference: reference.trim(), data };
    }
    if (m === "surah") {
        const data = await quranFetch<unknown>(`${QURAN_BASE}/surah/${encodeURIComponent(reference.trim())}/${encodeURIComponent(edition)}`);
        return { mode: m, edition, reference: reference.trim(), data };
    }
    throw new Error(`QuranRetriever: unknown mode "${mode}" (expected: ayah, surah, random)`);
}
