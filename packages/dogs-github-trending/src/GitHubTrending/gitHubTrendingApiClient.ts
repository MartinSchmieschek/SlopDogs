/**
 * =========================================================================
 *  GITHUB TRENDING API CLIENT — surfacing trending repos from the void
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the GitHub Search API,
 *  fetching trending repositories sorted by stars. No auth required
 *  for basic use, but rate limited to 10 req/min.
 *
 *  Endpoint: https://api.github.com/search/repositories
 * =========================================================================
 */

import type { TrendingRepo, GitHubTrendingResult } from "./interfaces/gitHubTrendingTypes";

const SEARCH_API_BASE = "https://api.github.com/search/repositories";

interface GitHubSearchItem {
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    created_at: string;
    owner: {
        login: string;
        avatar_url: string;
    };
}

interface GitHubSearchResponse {
    total_count: number;
    items: GitHubSearchItem[];
}

/**
 * Calculate the cutoff date based on the "since" parameter.
 */
function getCutoffDate(since: string): string {
    const now = new Date();
    let daysAgo: number;

    switch (since) {
        case "weekly":
            daysAgo = 7;
            break;
        case "monthly":
            daysAgo = 30;
            break;
        case "daily":
        default:
            daysAgo = 1;
            break;
    }

    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return cutoff.toISOString().split("T")[0];
}

/**
 * Fetch trending GitHub repositories.
 */
export async function getTrending(language?: string, since: string = "daily"): Promise<GitHubTrendingResult> {
    const date = getCutoffDate(since);

    let qParam = `created:>${date}`;
    if (language) {
        qParam += `+language:${encodeURIComponent(language)}`;
    }

    const url = `${SEARCH_API_BASE}?q=${qParam}&sort=stars&order=desc&per_page=20`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SlopDogs",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GitHub search API failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const data = await res.json() as GitHubSearchResponse;

    const repos: TrendingRepo[] = data.items.map(item => ({
        name: item.name,
        fullName: item.full_name,
        description: item.description,
        url: item.html_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language,
        createdAt: item.created_at,
        owner: item.owner.login,
        ownerAvatar: item.owner.avatar_url,
    }));

    return {
        language: language ?? null,
        since,
        repos,
        totalCount: data.total_count,
    };
}
