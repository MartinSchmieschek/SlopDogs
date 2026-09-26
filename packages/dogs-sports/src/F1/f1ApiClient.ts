import type { F1Result } from "./interfaces/f1Types";

/** Ergast ist offiziell eingestellt; Jolpi betreibt den Kompatibilitaets-Mirror */
const F1_BASE = "https://api.jolpi.ca/ergast/f1";

const F1_RESOURCES = new Set([
    "races", "results", "qualifying", "driverStandings", "constructorStandings",
    "drivers", "constructors", "status", "laps", "pitstops", "sprint",
]);

async function f1Fetch<T>(url: string): Promise<T> {
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
        throw new Error(`f1 api failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function getF1(
    season: string = "current",
    round?: string,
    resource: string = "races",
    limit: number = 30,
    offset: number = 0,
): Promise<F1Result> {
    const res = resource.toLowerCase();
    const isKnown = F1_RESOURCES.has(resource) || F1_RESOURCES.has(res);
    if (!isKnown) {
        throw new Error(`F1Retriever: unknown resource "${resource}" (expected: ${[...F1_RESOURCES].join(", ")})`);
    }

    const parts = [String(season)];
    if (round && round.trim()) parts.push(String(round).trim());
    parts.push(resource);

    const params = new URLSearchParams({
        limit: String(Math.max(1, Math.min(1000, Math.floor(limit)))),
        offset: String(Math.max(0, Math.floor(offset))),
    });
    const url = `${F1_BASE}/${parts.join("/")}.json?${params.toString()}`;
    const data = await f1Fetch<any>(url);
    const total = Number(data?.MRData?.total ?? 0);
    return {
        season,
        round,
        resource,
        total,
        data: data?.MRData ?? data,
    };
}
