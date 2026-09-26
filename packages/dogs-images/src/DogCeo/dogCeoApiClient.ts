import type { DogCeoResult } from "./interfaces/dogCeoTypes";

const DOGCEO_BASE = "https://dog.ceo/api";

async function dogCeoFetch<T>(url: string): Promise<T> {
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
        throw new Error(`dog.ceo failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function getDogImages(breed?: string, subBreed?: string, count: number = 1): Promise<DogCeoResult> {
    const n = Math.max(1, Math.min(50, Math.floor(count)));

    let url: string;
    if (breed && breed.trim()) {
        const b = encodeURIComponent(breed.trim().toLowerCase());
        if (subBreed && subBreed.trim()) {
            const sb = encodeURIComponent(subBreed.trim().toLowerCase());
            url = n === 1
                ? `${DOGCEO_BASE}/breed/${b}/${sb}/images/random`
                : `${DOGCEO_BASE}/breed/${b}/${sb}/images/random/${n}`;
        } else {
            url = n === 1
                ? `${DOGCEO_BASE}/breed/${b}/images/random`
                : `${DOGCEO_BASE}/breed/${b}/images/random/${n}`;
        }
    } else {
        url = n === 1
            ? `${DOGCEO_BASE}/breeds/image/random`
            : `${DOGCEO_BASE}/breeds/image/random/${n}`;
    }

    const data = await dogCeoFetch<{ status: string; message: string | string[] }>(url);
    if (data.status !== "success") {
        throw new Error(`dog.ceo returned status="${data.status}"`);
    }
    const images = Array.isArray(data.message) ? data.message : [data.message];
    return { breed: breed?.trim().toLowerCase(), subBreed: subBreed?.trim().toLowerCase(), count: images.length, images };
}
