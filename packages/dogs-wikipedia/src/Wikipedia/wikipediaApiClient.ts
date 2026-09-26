/**
 * =========================================================================
 *  WIKIPEDIA API CLIENT — summoning knowledge from the encyclopaedic void
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the Wikipedia MediaWiki API.
 *  Two calls chained: geosearch finds articles near GPS coordinates,
 *  then extracts + pageimages fetches summaries and thumbnails.
 *
 *  No API key required — the encyclopaedia grants passage freely, matey.
 * =========================================================================
 */

import type { WikiArticle, WikiNearbyResult } from "./interfaces/wikipediaTypes";

/**
 * Fetch Wikipedia articles near given GPS coordinates.
 * First queries geosearch for nearby pages, then fetches extracts + thumbnails.
 */
export async function getWikiNearby(
    lat: number,
    lng: number,
    radius: number = 500,
    limit: number = 10,
    lang: string = "de"
): Promise<WikiNearbyResult> {
    const clampedRadius = Math.min(Math.max(radius, 10), 10000);
    const clampedLimit = Math.min(Math.max(limit, 1), 50);
    const wikiBase = `https://${lang}.wikipedia.org/w/api.php`;

    // Step 1: Geosearch — find nearby pages
    const geoUrl = `${wikiBase}?action=query&list=geosearch&gsradius=${clampedRadius}&gscoord=${lat}|${lng}&gslimit=${clampedLimit}&format=json`;

    const geoRes = await fetchJson(geoUrl);
    const geoResults: any[] = geoRes?.query?.geosearch ?? [];

    if (geoResults.length === 0) {
        return {
            articles: [],
            articleCount: 0,
            searchLocation: { lat, lng },
            radius: clampedRadius,
            language: lang,
        };
    }

    // Step 2: Fetch extracts + thumbnails for all found pages
    const pageIds = geoResults.map((r: any) => r.pageid).join("|");
    const detailUrl = `${wikiBase}?action=query&pageids=${pageIds}&prop=extracts|pageimages&exintro=1&explaintext=1&exsentences=2&piprop=thumbnail&pithumbsize=300&format=json`;

    const detailRes = await fetchJson(detailUrl);
    const pages = detailRes?.query?.pages ?? {};

    // Merge geosearch results with detail data
    const articles: WikiArticle[] = geoResults.map((geo: any) => {
        const page = pages[String(geo.pageid)] ?? {};

        return {
            pageId: geo.pageid,
            title: geo.title,
            lat: geo.lat,
            lng: geo.lon,
            distance: geo.dist,
            extract: page.extract ?? "",
            thumbnailUrl: page.thumbnail?.source ?? null,
            articleUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(geo.title.replace(/ /g, "_"))}`,
        };
    });

    return {
        articles,
        articleCount: articles.length,
        searchLocation: { lat, lng },
        radius: clampedRadius,
        language: lang,
    };
}

/** Helper: fetch JSON with timeout and User-Agent */
async function fetchJson(url: string): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/json",
                "User-Agent": "SlopDogs/0.1 (https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`Wikipedia API failed: ${res.status} ${res.statusText}`);
    }

    return await res.json() as any;
}
