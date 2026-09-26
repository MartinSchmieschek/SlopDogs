import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { WikiSearchQueryPact, type WikiSearchQuery } from "./pacts";

export interface WikiSearchResult {
    title: string;
    extract: string;
    description?: string;
    thumbnail?: {
        source: string;
        width: number;
        height: number;
    };
    url: string;
    lang: string;
    searchResults?: Array<{
        title: string;
        snippet: string;
    }>;
}

interface WikiSummaryResponse {
    title: string;
    extract: string;
    description?: string;
    thumbnail?: { source: string; width: number; height: number };
    content_urls?: { desktop?: { page?: string } };
}

interface WikiSearchResponse {
    query?: {
        search?: Array<{
            title: string;
            snippet: string;
        }>;
    };
}

async function fetchWithTimeout(url: string, signal: AbortSignal): Promise<Response> {
    return fetch(url, { signal });
}

export class WikiSearchRetriever extends Dog<WikiSearchResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WikiSearchRetriever.name;
    }

    get description(): string {
        return "Searches Wikipedia articles by keyword and returns article summaries.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDD0E";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WikiSearchQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WikiSearchResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WikiSearchQueryPact, d));
        const query = (queryDog?.collected as WikiSearchQuery | undefined) ?? ({} as WikiSearchQuery);

        const searchTerm = query.q ?? "";
        if (!searchTerm.trim()) {
            throw new Error("WikiSearchRetriever: Missing required query param (q)");
        }

        const lang = (query.lang ?? "en").toLowerCase();
        const key = `wikisearch:${lang}:${searchTerm.toLowerCase().trim()}`;

        const fetchWiki = async (): Promise<WikiSearchResult> => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 15_000);

            try {
                // First, try direct summary lookup
                const encodedTerm = encodeURIComponent(searchTerm);
                const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodedTerm}`;
                const summaryRes = await fetchWithTimeout(summaryUrl, ctrl.signal);

                if (summaryRes.ok) {
                    const data = await summaryRes.json() as WikiSummaryResponse;
                    return {
                        title: data.title,
                        extract: data.extract,
                        description: data.description,
                        thumbnail: data.thumbnail,
                        url: data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodedTerm}`,
                        lang,
                    };
                }

                // If 404 or other error, fall back to search API
                const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedTerm}&format=json&srlimit=5`;
                const searchRes = await fetchWithTimeout(searchUrl, ctrl.signal);

                if (!searchRes.ok) {
                    const text = await searchRes.text().catch(() => "");
                    throw new Error(
                        `WikiSearchRetriever: HTTP ${searchRes.status} ${searchRes.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                    );
                }

                const searchData = await searchRes.json() as WikiSearchResponse;
                const results = searchData.query?.search ?? [];

                if (results.length === 0) {
                    throw new Error(`WikiSearchRetriever: No results found for "${searchTerm}"`);
                }

                const searchResults = results.map(r => ({
                    title: r.title,
                    snippet: r.snippet,
                }));

                // Fetch summary for the top result
                const topTitle = encodeURIComponent(results[0].title);
                const topSummaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${topTitle}`;
                const topRes = await fetchWithTimeout(topSummaryUrl, ctrl.signal);

                if (topRes.ok) {
                    const topData = await topRes.json() as WikiSummaryResponse;
                    return {
                        title: topData.title,
                        extract: topData.extract,
                        description: topData.description,
                        thumbnail: topData.thumbnail,
                        url: topData.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${topTitle}`,
                        lang,
                        searchResults,
                    };
                }

                // If even the top result summary fails, return search results only
                return {
                    title: results[0].title,
                    extract: results[0].snippet.replace(/<[^>]*>/g, ""),
                    url: `https://${lang}.wikipedia.org/wiki/${topTitle}`,
                    lang,
                    searchResults,
                };
            } finally {
                clearTimeout(timer);
            }
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, fetchWiki);
        }
        return fetchWiki();
    };
}
