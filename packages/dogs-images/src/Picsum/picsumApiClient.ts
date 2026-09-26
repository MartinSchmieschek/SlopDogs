import type { PicsumImageInfo, PicsumResult } from "./interfaces/picsumTypes";

const PICSUM_BASE = "https://picsum.photos";

async function picsumFetch<T>(url: string): Promise<T> {
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
        throw new Error(`picsum.photos failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryPicsum(
    mode: string = "list",
    width: number = 400,
    height: number = 300,
    seed?: string,
    id?: string,
    page: number = 1,
    limit: number = 30,
    grayscale: boolean = false,
    blur?: number,
): Promise<PicsumResult> {
    const m = mode.toLowerCase();

    if (m === "randomurl") {
        const modifiers: string[] = [];
        if (grayscale) modifiers.push("grayscale");
        if (blur && blur >= 1 && blur <= 10) modifiers.push(`blur=${Math.floor(blur)}`);
        const q = modifiers.length ? `?${modifiers.join("&").replace(/^grayscale/, "grayscale")}` : "";
        const base = seed && seed.trim()
            ? `${PICSUM_BASE}/seed/${encodeURIComponent(seed.trim())}/${Math.floor(width)}/${Math.floor(height)}`
            : `${PICSUM_BASE}/${Math.floor(width)}/${Math.floor(height)}`;
        return { mode: m, url: base + q };
    }

    if (m === "info") {
        if (!id || !id.trim()) throw new Error("PicsumRetriever: mode=info requires 'id'");
        const data = await picsumFetch<PicsumImageInfo>(`${PICSUM_BASE}/id/${encodeURIComponent(id.trim())}/info`);
        return { mode: m, items: [data] };
    }

    if (m === "list") {
        const p = Math.max(1, Math.floor(page));
        const l = Math.max(1, Math.min(100, Math.floor(limit)));
        const data = await picsumFetch<PicsumImageInfo[]>(`${PICSUM_BASE}/v2/list?page=${p}&limit=${l}`);
        return { mode: m, items: data };
    }

    throw new Error(`PicsumRetriever: unknown mode "${mode}" (expected: list, info, randomUrl)`);
}
