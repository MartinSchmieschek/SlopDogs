import type { RadioBrowserResult, RadioBrowserStation } from "./interfaces/radioBrowserTypes";

/** Mirror — Radio-Browser bietet mehrere, wir nutzen all.api.radio-browser.info als DNS-Round-Robin */
const RADIO_BASE = "https://all.api.radio-browser.info/json";
const MODES = new Set(["search", "bycountry", "bylanguage", "bytag"]);

async function radioFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`radio-browser failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryRadioBrowser(
    mode: string = "search",
    value: string = "",
    limit: number = 30,
    offset: number = 0,
    order: string = "clickcount",
    reverse: boolean = true,
): Promise<RadioBrowserResult> {
    const m = mode.toLowerCase();
    if (!MODES.has(m)) {
        throw new Error(`RadioBrowserRetriever: unknown mode "${mode}" (expected: ${[...MODES].join(", ")})`);
    }
    const params = new URLSearchParams({
        limit: String(Math.max(1, Math.min(500, Math.floor(limit)))),
        offset: String(Math.max(0, Math.floor(offset))),
        order,
        reverse: String(Boolean(reverse)),
        hidebroken: "true",
    });

    let path: string;
    if (m === "search") {
        if (value && value.trim()) params.set("name", value.trim());
        path = "stations/search";
    } else {
        if (!value || !value.trim()) {
            throw new Error(`RadioBrowserRetriever: mode "${m}" requires 'value'`);
        }
        path = `stations/${m}/${encodeURIComponent(value.trim())}`;
    }

    const stations = await radioFetch<RadioBrowserStation[]>(`${RADIO_BASE}/${path}?${params.toString()}`);
    return {
        mode: m,
        query: value,
        count: stations.length,
        stations,
    };
}
