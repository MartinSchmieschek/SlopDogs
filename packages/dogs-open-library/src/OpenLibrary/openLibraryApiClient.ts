/**
 * =========================================================================
 *  OPEN LIBRARY API CLIENT — reading the literary void
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Open Library Search API,
 *  fetching books from the boundless shelves of the void.
 *
 *  Endpoint: https://openlibrary.org/search.json
 * =========================================================================
 */

import type { BookEntry, OpenLibraryResult } from "./interfaces/openLibraryTypes";

const SEARCH_API_BASE = "https://openlibrary.org/search.json";
const COVER_BASE = "https://covers.openlibrary.org/b/id";

interface OpenLibraryDoc {
    key: string;
    title: string;
    author_name?: string[];
    first_publish_year?: number;
    cover_i?: number;
    subject?: string[];
    publisher?: string[];
    language?: string[];
    number_of_pages_median?: number;
}

interface OpenLibrarySearchResponse {
    numFound: number;
    docs: OpenLibraryDoc[];
}

/**
 * Search Open Library for books matching the given query.
 */
export async function searchOpenLibrary(query: string, limit: string = "10"): Promise<OpenLibraryResult> {
    const params = new URLSearchParams({
        q: query,
        limit,
        fields: "key,title,author_name,first_publish_year,cover_i,subject,publisher,language,number_of_pages_median",
    });

    const url = `${SEARCH_API_BASE}?${params.toString()}`;

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
        throw new Error(`Open Library search failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as OpenLibrarySearchResponse;

    const books: BookEntry[] = data.docs.map(doc => ({
        key: doc.key,
        title: doc.title,
        authors: doc.author_name ?? [],
        firstPublishYear: doc.first_publish_year ?? null,
        coverUrl: doc.cover_i ? `${COVER_BASE}/${doc.cover_i}-M.jpg` : null,
        subjects: doc.subject ?? [],
        publisher: doc.publisher ?? [],
        languages: doc.language ?? [],
        pages: doc.number_of_pages_median ?? null,
    }));

    return {
        query,
        totalFound: data.numFound,
        books,
    };
}
