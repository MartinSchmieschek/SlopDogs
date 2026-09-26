/**
 * =========================================================================
 *  RANDOM FACT API CLIENT — trawling the knowledge-void for trivia
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of uselessfacts.jsph.pl —
 *  summoning random fun facts from the abyss. Each call yields
 *  a fresh morsel of trivia, matey.
 * =========================================================================
 */

import type { RandomFactApiResponse, RandomFactResult } from "./interfaces/randomFactTypes";

const USELESS_FACTS_BASE = "https://uselessfacts.jsph.pl/api/v2/facts/random";

/**
 * Fetch a random fun fact from uselessfacts API.
 */
export async function getRandomFact(lang: string = "en"): Promise<RandomFactResult> {
    const url = `${USELESS_FACTS_BASE}?language=${encodeURIComponent(lang)}`;

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
        throw new Error(`uselessfacts API failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as RandomFactApiResponse;

    return {
        fact: data.text,
        source: data.source,
        sourceUrl: data.source_url,
        language: data.language,
        permalink: data.permalink,
    };
}
