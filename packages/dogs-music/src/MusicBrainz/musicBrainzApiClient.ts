import type { MusicBrainzResult } from "./interfaces/musicBrainzTypes";

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_ENTITIES = new Set(["artist", "release", "recording", "release-group", "work", "label"]);

async function mbFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
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
        throw new Error(`musicbrainz failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryMusicBrainz(
    entity: string = "artist",
    mbid?: string,
    search?: string,
    limit: number = 10,
    offset: number = 0,
): Promise<MusicBrainzResult> {
    const ent = entity.toLowerCase();
    if (!MB_ENTITIES.has(ent)) {
        throw new Error(`MusicBrainzRetriever: unknown entity "${entity}" (expected: ${[...MB_ENTITIES].join(", ")})`);
    }
    if (mbid && mbid.trim()) {
        const data = await mbFetch<unknown>(`${MB_BASE}/${ent}/${encodeURIComponent(mbid.trim())}?fmt=json`);
        return { mode: "lookup", entity: ent, data };
    }
    if (!search || !search.trim()) {
        throw new Error("MusicBrainzRetriever: either 'mbid' or 'search' is required");
    }
    const params = new URLSearchParams({
        query: search.trim(),
        fmt: "json",
        limit: String(Math.max(1, Math.min(100, Math.floor(limit)))),
        offset: String(Math.max(0, Math.floor(offset))),
    });
    const data = await mbFetch<unknown>(`${MB_BASE}/${ent}?${params.toString()}`);
    return { mode: "search", entity: ent, data };
}
