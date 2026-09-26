/**
 * =========================================================================
 *  OPEN LIBRARY TYPES — literary echoes from the boundless void
 * =========================================================================
 */

/** A single book result */
export interface BookEntry {
    /** Open Library key (e.g. /works/OL12345W) */
    key: string;
    /** Book title */
    title: string;
    /** Author names */
    authors: string[];
    /** Year of first publication, null if unknown */
    firstPublishYear: number | null;
    /** Cover image URL (medium size), null if unavailable */
    coverUrl: string | null;
    /** Subject tags */
    subjects: string[];
    /** Publisher names */
    publisher: string[];
    /** Language codes */
    languages: string[];
    /** Median page count, null if unknown */
    pages: number | null;
}

/** Full Open Library search result */
export interface OpenLibraryResult {
    /** The original search query */
    query: string;
    /** Total number of results found */
    totalFound: number;
    /** Array of book entries */
    books: BookEntry[];
}
