import type { GutenbergApiBook, GutenbergApiResponse, GutenbergBook, GutenbergResult } from "./interfaces/gutenbergTypes";

const GUTENDEX_BASE = "https://gutendex.com/books";

function pickTextUrl(formats: Record<string, string>): string | undefined {
    const preferred = [
        "text/plain; charset=utf-8",
        "text/plain; charset=us-ascii",
        "text/plain",
        "text/html; charset=utf-8",
        "text/html",
        "application/epub+zip",
    ];
    for (const mime of preferred) {
        if (formats[mime]) return formats[mime];
    }
    const first = Object.values(formats)[0];
    return first;
}

function mapBook(b: GutenbergApiBook): GutenbergBook {
    const formats = b.formats ?? {};
    return {
        id: b.id,
        title: b.title,
        authors: (b.authors ?? []).map(a => a.name),
        languages: b.languages ?? [],
        subjects: b.subjects ?? [],
        downloadCount: b.download_count ?? 0,
        textUrl: pickTextUrl(formats),
        formats,
    };
}

export async function searchGutenberg(
    search?: string,
    language?: string,
    topic?: string,
    page: number = 1,
): Promise<GutenbergResult> {
    const params = new URLSearchParams();
    if (search && search.trim()) params.set("search", search.trim());
    if (language && language.trim()) params.set("languages", language.trim());
    if (topic && topic.trim()) params.set("topic", topic.trim());
    if (page > 1) params.set("page", String(Math.floor(page)));

    const url = params.toString() ? `${GUTENDEX_BASE}?${params.toString()}` : GUTENDEX_BASE;

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
        throw new Error(`gutendex failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const data = await res.json() as GutenbergApiResponse;
    return {
        count: data.count,
        page,
        hasMore: Boolean(data.next),
        books: data.results.map(mapBook),
    };
}
