import type { OpenFdaResult } from "./interfaces/openFdaTypes";

const FDA_BASE = "https://api.fda.gov";
const ENDPOINTS = new Set([
    "drug/event", "drug/label", "drug/enforcement", "drug/ndc",
    "device/enforcement", "device/event", "device/recall",
    "food/enforcement", "food/event",
]);

async function fdaFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
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
        // openFDA antwortet mit 404 bei "no matches" — wir werten das als leeres Ergebnis
        return { results: [] as unknown[] } as unknown as T;
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`openFDA failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryOpenFda(
    endpoint: string = "drug/event",
    search?: string,
    limit: number = 10,
    skip: number = 0,
): Promise<OpenFdaResult> {
    const ep = endpoint.toLowerCase();
    if (!ENDPOINTS.has(ep)) {
        throw new Error(`OpenFdaRetriever: unknown endpoint "${endpoint}" (expected: ${[...ENDPOINTS].join(", ")})`);
    }
    const params = new URLSearchParams({
        limit: String(Math.max(1, Math.min(1000, Math.floor(limit)))),
        skip: String(Math.max(0, Math.floor(skip))),
    });
    if (search && search.trim()) params.set("search", search.trim());

    const data = await fdaFetch<{ meta?: { results?: { total?: number } }; results?: unknown[] }>(
        `${FDA_BASE}/${ep}.json?${params.toString()}`,
    );
    return {
        endpoint: ep,
        total: data.meta?.results?.total,
        results: data.results ?? [],
    };
}
