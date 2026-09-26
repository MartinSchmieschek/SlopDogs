/**
 * =========================================================================
 *  GITHUB TRENDING TYPES — trending repos surfacing from the void
 * =========================================================================
 */

/** A single trending repository */
export interface TrendingRepo {
    /** Repository name */
    name: string;
    /** Full name (owner/repo) */
    fullName: string;
    /** Repository description, null if none */
    description: string | null;
    /** HTML URL to the repository */
    url: string;
    /** Star count */
    stars: number;
    /** Fork count */
    forks: number;
    /** Primary language, null if undetected */
    language: string | null;
    /** ISO date string when the repo was created */
    createdAt: string;
    /** Owner login name */
    owner: string;
    /** Owner avatar URL */
    ownerAvatar: string;
}

/** Full GitHub trending result */
export interface GitHubTrendingResult {
    /** Language filter applied, null if none */
    language: string | null;
    /** Time range: "daily", "weekly", or "monthly" */
    since: string;
    /** Array of trending repositories */
    repos: TrendingRepo[];
    /** Total count of matching repos from the API */
    totalCount: number;
}
