import type { QuoteResult } from "./interfaces/quoteTypes";

/**
 * quotable.io hat seit 2024 ein abgelaufenes TLS-Zertifikat und wird nicht mehr gewartet.
 * Wir nutzen stattdessen ZenQuotes (https://zenquotes.io/api) — gleiches Prinzip, lebendig.
 *
 * ZenQuotes hat keinen Autor-/Tag-Filter; die entsprechenden Parameter aus QuoteQuery
 * werden clientseitig als Nachfilter angewendet (mit begrenzten Retries).
 */
const ZEN_RANDOM = "https://zenquotes.io/api/random";
const ZEN_BY_AUTHOR = "https://zenquotes.io/api/quotes/author";

interface ZenQuoteEntry {
    q: string;
    a: string;
    h?: string;
}

async function zenFetch(url: string): Promise<ZenQuoteEntry[]> {
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
        throw new Error(`zenquotes failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<ZenQuoteEntry[]>;
}

function matches(entry: ZenQuoteEntry, minLength?: number, maxLength?: number): boolean {
    const len = entry.q.length;
    if (minLength && minLength > 0 && len < minLength) return false;
    if (maxLength && maxLength > 0 && len > maxLength) return false;
    return true;
}

export async function getRandomQuote(
    author?: string,
    _tag?: string,
    minLength?: number,
    maxLength?: number,
): Promise<QuoteResult> {
    if (author && author.trim()) {
        // Author-Filter: ZenQuotes liefert Quotes des Autors (Premium-Feature, oeffentlich
        // oft 429). Wir versuchen den Endpoint und filtern clientseitig.
        const params = new URLSearchParams({ name: author.trim() });
        const list = await zenFetch(`${ZEN_BY_AUTHOR}?${params.toString()}`);
        const pool = list.filter(e => matches(e, minLength, maxLength));
        if (pool.length === 0) {
            throw new Error(`zenquotes: no quote for author="${author}" matching length constraints`);
        }
        const pick = pool[Math.floor(Math.random() * pool.length)];
        return { id: `${pick.a}:${pick.q.slice(0, 40)}`, quote: pick.q, author: pick.a, tags: [], length: pick.q.length };
    }

    // Ohne Author-Filter: random mit bis zu 3 Retries fuer Laengen-Constraint
    for (let i = 0; i < 3; i++) {
        const list = await zenFetch(ZEN_RANDOM);
        const entry = list[0];
        if (entry && matches(entry, minLength, maxLength)) {
            return { id: `${entry.a}:${entry.q.slice(0, 40)}`, quote: entry.q, author: entry.a, tags: [], length: entry.q.length };
        }
    }
    throw new Error("zenquotes: 3 random quotes did not match length constraints");
}
