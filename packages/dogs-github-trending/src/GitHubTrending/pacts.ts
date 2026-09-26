/**
 * =========================================================================
 *  GITHUB TRENDING PACTS — accords with the trending void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query for GitHub trending repositories */
export interface GitHubTrendingQuery {
    /** Programming language filter (e.g. "javascript", "python") */
    language?: string;
    /** Time range: "daily" (default), "weekly", "monthly" */
    since?: string;
}

/** The Pact for GitHub Trending queries */
export const GitHubTrendingQueryPact = createPact<GitHubTrendingQuery>(
    "GitHubTrendingQueryProvider",
    { fromSourceType: "GitHubTrendingQuery" }
);
