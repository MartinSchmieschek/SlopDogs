import type { LyricsApiResponse, LyricsResult } from "./interfaces/lyricsTypes";

const LYRICS_BASE = "https://api.lyrics.ovh/v1";

export async function getLyrics(artist: string, title: string): Promise<LyricsResult> {
    if (!artist || !artist.trim() || !title || !title.trim()) {
        throw new Error("LyricsRetriever: 'artist' and 'title' are required");
    }
    const url = `${LYRICS_BASE}/${encodeURIComponent(artist.trim())}/${encodeURIComponent(title.trim())}`;

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
    if (res.status === 404) {
        throw new Error(`lyrics.ovh: no lyrics found for "${artist} - ${title}"`);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`lyrics.ovh failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as LyricsApiResponse;
    if (data.error) {
        throw new Error(`lyrics.ovh error: ${data.error}`);
    }
    return {
        artist: artist.trim(),
        title: title.trim(),
        lyrics: (data.lyrics ?? "").trim(),
    };
}
