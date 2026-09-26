/**
 * =========================================================================
 *  NEWS API CLIENT — reading the regional void through RSS feeds
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of RSS — that ancient XML
 *  protocol through which the mortal press broadcasts its tidings.
 *  No API key required — the news flows freely like the tides, matey.
 *
 *  Default: Google News RSS with geo-query and 7-day filter.
 *  Custom feeds may also be plundered alongside.
 * =========================================================================
 */

import type { NewsItem, RegionalNewsResult } from "./interfaces/newsTypes";

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ').trim();
}

/** Extract text content between XML tags */
function extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return (match?.[1] ?? match?.[2] ?? '').trim();
}

/** Extract an image URL from enclosure or media:content elements */
function extractImageUrl(itemXml: string): string | null {
    // Try <enclosure url="...">
    const enclosure = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
    if (enclosure?.[1]) return enclosure[1];

    // Try <media:content url="...">
    const media = itemXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
    if (media?.[1]) return media[1];

    // Try <media:thumbnail url="...">
    const thumb = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i);
    if (thumb?.[1]) return thumb[1];

    return null;
}

/**
 * Fetch and parse a single RSS feed into NewsItem array.
 */
export async function fetchRssItems(feedUrl: string, sourceName: string): Promise<NewsItem[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(feedUrl, {
            headers: {
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`RSS fetch failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const xml = await res.text();

    // Split into <item> blocks
    const itemBlocks = xml.split(/<item[\s>]/i).slice(1);

    return itemBlocks.map(block => {
        const itemXml = block.split(/<\/item>/i)[0] ?? block;

        return {
            title: stripHtml(extractTag(itemXml, 'title')),
            link: extractTag(itemXml, 'link'),
            description: stripHtml(extractTag(itemXml, 'description')).slice(0, 500),
            pubDate: extractTag(itemXml, 'pubDate'),
            source: sourceName,
            category: extractTag(itemXml, 'category') || null,
            imageUrl: extractImageUrl(itemXml),
        };
    }).filter(item => item.title.length > 0);
}

/**
 * Build a RegionalNewsResult from a query string and optional custom feeds.
 */
export async function getRegionalNews(
    query: string,
    customFeedUrls: string | undefined,
    limit: number = 20
): Promise<RegionalNewsResult> {
    const feedUrls: string[] = [];
    const allItems: NewsItem[] = [];

    // Google News RSS with geo-query
    const googleUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:7d&hl=de&gl=DE&ceid=DE:de`;
    feedUrls.push(googleUrl);

    // Custom feeds if provided
    if (customFeedUrls) {
        const urls = customFeedUrls.split(',').map(u => u.trim()).filter(Boolean);
        feedUrls.push(...urls);
    }

    // Fetch all feeds in parallel
    const results = await Promise.allSettled(
        feedUrls.map(async (url, i) => {
            const sourceName = i === 0 ? `Google News (${query})` : new URL(url).hostname;
            return fetchRssItems(url, sourceName);
        })
    );

    for (const result of results) {
        if (result.status === 'fulfilled') {
            allItems.push(...result.value);
        } else {
            console.warn(`[RegionalNewsRetriever] Feed fetch failed: ${result.reason}`);
        }
    }

    // Sort by pubDate descending, then limit
    allItems.sort((a, b) => {
        const da = new Date(a.pubDate).getTime() || 0;
        const db = new Date(b.pubDate).getTime() || 0;
        return db - da;
    });

    const limited = allItems.slice(0, limit);

    return {
        items: limited,
        totalItems: limited.length,
        feedUrls,
        query,
    };
}
