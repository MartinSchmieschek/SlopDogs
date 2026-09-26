export interface GutenbergAuthor {
    name: string;
    birth_year?: number | null;
    death_year?: number | null;
}

export interface GutenbergApiBook {
    id: number;
    title: string;
    authors: GutenbergAuthor[];
    subjects?: string[];
    bookshelves?: string[];
    languages?: string[];
    copyright?: boolean | null;
    media_type?: string;
    formats?: Record<string, string>;
    download_count?: number;
}

export interface GutenbergApiResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: GutenbergApiBook[];
}

export interface GutenbergBook {
    id: number;
    title: string;
    authors: string[];
    languages: string[];
    subjects: string[];
    downloadCount: number;
    /** Bevorzugter Volltext-Link (text/plain, sonst html, sonst erster Format-Link) */
    textUrl?: string;
    /** Alle Formate roh, fuer Sonderfaelle */
    formats: Record<string, string>;
}

export interface GutenbergResult {
    count: number;
    page: number;
    hasMore: boolean;
    books: GutenbergBook[];
}
