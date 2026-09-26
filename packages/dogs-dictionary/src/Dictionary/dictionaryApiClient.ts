import type { DictionaryApiEntry, DictionaryResult } from "./interfaces/dictionaryTypes";

const DICT_API_BASE = "https://api.dictionaryapi.dev/api/v2/entries";

export async function getDictionaryEntry(word: string, lang: string = "en"): Promise<DictionaryResult> {
    if (!word || !word.trim()) {
        throw new Error("DictionaryRetriever: 'word' is required");
    }
    const url = `${DICT_API_BASE}/${encodeURIComponent(lang)}/${encodeURIComponent(word.trim())}`;

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

    if (res.status === 404) {
        throw new Error(`dictionaryapi.dev: no entry for "${word}" (lang=${lang})`);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`dictionaryapi.dev failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const entries = await res.json() as DictionaryApiEntry[];
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error(`dictionaryapi.dev: empty response for "${word}"`);
    }

    const first = entries[0];
    const phoneticsWithAudio = (first.phonetics ?? []).find(p => p.audio && p.audio.length > 0);

    const synonyms = new Set<string>();
    const antonyms = new Set<string>();
    for (const entry of entries) {
        (entry.meanings ?? []).forEach(m => {
            (m.synonyms ?? []).forEach(s => synonyms.add(s));
            (m.antonyms ?? []).forEach(s => antonyms.add(s));
            (m.definitions ?? []).forEach(d => {
                (d.synonyms ?? []).forEach(s => synonyms.add(s));
                (d.antonyms ?? []).forEach(s => antonyms.add(s));
            });
        });
    }

    return {
        word: first.word,
        phonetic: first.phonetic ?? phoneticsWithAudio?.text,
        audioUrl: phoneticsWithAudio?.audio,
        meanings: entries.flatMap(e => e.meanings ?? []),
        synonyms: [...synonyms],
        antonyms: [...antonyms],
        sourceUrls: entries.flatMap(e => e.sourceUrls ?? []),
    };
}
