import { createPact } from "@slopdogs/core";

export interface GitHubPublicQuery {
    /** Modus: user, repo, orgRepos, userRepos, search — default "repo" */
    mode?: string;
    /** Login (user/org) — fuer user, userRepos, orgRepos */
    login?: string;
    /** owner/repo — fuer repo */
    repo?: string;
    /** Suchstring (Qualifier wie "lang:typescript stars:>1000" moeglich) — fuer search */
    q?: string;
    /** Suchtyp: repositories, users, issues — default "repositories" (nur mode=search) */
    searchType?: string;
    /** Sort: stars, forks, updated, help-wanted-issues — default "stars" */
    sort?: string;
    /** Seite — default 1 */
    page?: number;
    /** Per-Page — default 30 (max 100) */
    perPage?: number;
}

export const GitHubPublicQueryPact = createPact<GitHubPublicQuery>(
    "GitHubPublicQueryProvider",
    { fromSourceType: "GitHubPublicQuery" }
);
