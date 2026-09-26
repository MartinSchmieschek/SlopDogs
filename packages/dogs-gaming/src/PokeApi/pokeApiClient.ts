import type { PokeApiResult } from "./interfaces/pokeTypes";

const POKE_BASE = "https://pokeapi.co/api/v2";
const ENDPOINTS = new Set([
    "pokemon", "pokemon-species", "ability", "type", "move",
    "generation", "nature", "berry", "item", "location",
    "region", "machine", "evolution-chain", "pokemon-color", "pokemon-habitat",
]);

async function pokeFetch<T>(url: string): Promise<T> {
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
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`pokeapi.co failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryPokeApi(
    endpoint: string = "pokemon",
    idOrName?: string,
    list: boolean = false,
    limit: number = 20,
    offset: number = 0,
): Promise<PokeApiResult> {
    const ep = endpoint.toLowerCase();
    if (!ENDPOINTS.has(ep)) {
        throw new Error(`PokeApiRetriever: unknown endpoint "${endpoint}" (expected: ${[...ENDPOINTS].join(", ")})`);
    }

    if (idOrName && idOrName.trim()) {
        const data = await pokeFetch<unknown>(`${POKE_BASE}/${ep}/${encodeURIComponent(idOrName.trim().toLowerCase())}`);
        return { endpoint: ep, mode: "item", query: idOrName.trim(), data };
    }

    if (list) {
        const l = Math.max(1, Math.min(1200, Math.floor(limit)));
        const o = Math.max(0, Math.floor(offset));
        const data = await pokeFetch<unknown>(`${POKE_BASE}/${ep}?limit=${l}&offset=${o}`);
        return { endpoint: ep, mode: "list", query: `limit=${l}&offset=${o}`, data };
    }

    throw new Error("PokeApiRetriever: either 'idOrName' or 'list=true' is required");
}
