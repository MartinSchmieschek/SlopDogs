/**
 * =========================================================================
 *  NEWS TYPES — tidings dredged from the regional void
 * =========================================================================
 */

/** A single news item parsed from an RSS feed */
export interface NewsItem {
    /** Headline of the news item */
    title: string;
    /** URL to the full article */
    link: string;
    /** Short description or summary (HTML stripped) */
    description: string;
    /** Publication date (ISO string or raw from feed) */
    pubDate: string;
    /** Name of the RSS feed source */
    source: string;
    /** Category tag if available in the feed */
    category: string | null;
    /** Image URL if an enclosure or media element was found */
    imageUrl: string | null;
}

/** The full yield of the RegionalNewsRetriever */
export interface RegionalNewsResult {
    /** News items found */
    items: NewsItem[];
    /** Total number of items returned */
    totalItems: number;
    /** The feed URLs that were fetched */
    feedUrls: string[];
    /** The search/location term used (null if only custom feeds) */
    query: string | null;
}
