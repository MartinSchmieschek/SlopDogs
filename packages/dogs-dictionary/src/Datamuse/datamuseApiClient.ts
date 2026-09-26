import type { DatamuseApiWord, DatamuseResult } from "./interfaces/datamuseTypes";

const DATAMUSE_BASE = "https://api.datamuse.com/words";

const REL_PARAM_MAP: Record<string, string> = {
    rhy: "rel_rhy",
    nry: "rel_nry",
    syn: "rel_syn",
    ant: "rel_ant",
    trg: "rel_trg",
    ml: "ml",
    sl: "sl",
    sp: "sp",
};

export async function getDatamuseWords(
    word: string,
    relation: string = "rhy",
    max: number = 20,
): Promise<DatamuseResult> {
    if (!word || !word.trim()) {
        throw new Error("DatamuseRetriever: 'word' is required");
    }
    const clampedMax = Math.max(1, Math.min(1000, Math.floor(max)));
    const relKey = relation.toLowerCase();
    const param = REL_PARAM_MAP[relKey] ?? "rel_rhy";

    const params = new URLSearchParams({ max: String(clampedMax) });
    params.set(param, word.trim());

    const url = `${DATAMUSE_BASE}?${params.toString()}`;

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
        throw new Error(`datamuse failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as DatamuseApiWord[];
    return { word, relation: relKey, words: data };
}
