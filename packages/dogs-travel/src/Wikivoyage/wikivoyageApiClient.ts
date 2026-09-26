import type { WikivoyageResult } from "./interfaces/wikivoyageTypes";

function wikivoyageBase(lang: string): string {
    return `https://${lang}.wikivoyage.org/w/api.php`;
}

async function wvFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.1 (https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`wikivoyage failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function getWikivoyageSnippet(place: string, lang: string = "en"): Promise<WikivoyageResult> {
    if (!place || !place.trim()) {
        throw new Error("WikivoyageRetriever: 'place' is required");
    }
    const params = new URLSearchParams({
        action: "query",
        prop: "extracts|info",
        exintro: "1",
        explaintext: "1",
        inprop: "url",
        redirects: "1",
        titles: place.trim(),
        format: "json",
        origin: "*",
    });
    const data = await wvFetch<any>(`${wikivoyageBase(lang)}?${params.toString()}`);
    const pages = data?.query?.pages ?? {};
    const firstKey = Object.keys(pages)[0];
    const page = firstKey ? pages[firstKey] : undefined;
    return {
        place,
        lang,
        title: page?.title,
        extract: page?.extract,
        pageUrl: page?.fullurl,
        raw: data,
    };
}
