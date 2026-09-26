import type { WaybackApiResponse, WaybackResult } from "./interfaces/waybackTypes";

const WAYBACK_BASE = "https://archive.org/wayback/available";

export async function getWaybackSnapshot(url: string, timestamp?: string): Promise<WaybackResult> {
    if (!url || !url.trim()) {
        throw new Error("WaybackRetriever: 'url' is required");
    }
    const params = new URLSearchParams({ url: url.trim() });
    if (timestamp && timestamp.trim()) params.set("timestamp", timestamp.trim());

    const full = `${WAYBACK_BASE}?${params.toString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(full, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`wayback failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as WaybackApiResponse;
    const closest = data.archived_snapshots?.closest;
    return {
        url: data.url ?? url,
        requestedTimestamp: timestamp,
        found: Boolean(closest?.available && closest.url),
        snapshot: closest,
    };
}
