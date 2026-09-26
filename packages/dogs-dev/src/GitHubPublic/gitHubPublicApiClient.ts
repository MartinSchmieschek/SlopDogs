import type { GitHubPublicResult } from "./interfaces/gitHubPublicTypes";

const GH_BASE = "https://api.github.com";
const SEARCH_TYPES = new Set(["repositories", "users", "issues"]);

async function ghFetch(url: string): Promise<{ data: unknown; rateLimitRemaining?: number }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`github failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    const remaining = res.headers.get("x-ratelimit-remaining");
    const data = await res.json() as unknown;
    return { data, rateLimitRemaining: remaining ? Number(remaining) : undefined };
}

export async function queryGitHubPublic(
    mode: string = "repo",
    login?: string,
    repo?: string,
    q?: string,
    searchType: string = "repositories",
    sort: string = "stars",
    page: number = 1,
    perPage: number = 30,
): Promise<GitHubPublicResult> {
    const m = mode.toLowerCase();
    const perPageClamped = Math.max(1, Math.min(100, Math.floor(perPage)));
    const pageClamped = Math.max(1, Math.floor(page));

    let url: string;
    if (m === "user") {
        if (!login?.trim()) throw new Error("GitHubPublicRetriever: mode=user requires 'login'");
        url = `${GH_BASE}/users/${encodeURIComponent(login.trim())}`;
    } else if (m === "repo") {
        if (!repo?.trim() || !repo.includes("/")) {
            throw new Error("GitHubPublicRetriever: mode=repo requires 'repo' in owner/repo format");
        }
        const [owner, name] = repo.split("/").map(s => s.trim());
        url = `${GH_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    } else if (m === "userrepos") {
        if (!login?.trim()) throw new Error("GitHubPublicRetriever: mode=userRepos requires 'login'");
        const p = new URLSearchParams({
            sort: sort === "stars" ? "updated" : sort,
            per_page: String(perPageClamped),
            page: String(pageClamped),
        });
        url = `${GH_BASE}/users/${encodeURIComponent(login.trim())}/repos?${p.toString()}`;
    } else if (m === "orgrepos") {
        if (!login?.trim()) throw new Error("GitHubPublicRetriever: mode=orgRepos requires 'login'");
        const p = new URLSearchParams({
            per_page: String(perPageClamped),
            page: String(pageClamped),
        });
        url = `${GH_BASE}/orgs/${encodeURIComponent(login.trim())}/repos?${p.toString()}`;
    } else if (m === "search") {
        if (!q?.trim()) throw new Error("GitHubPublicRetriever: mode=search requires 'q'");
        const st = searchType.toLowerCase();
        if (!SEARCH_TYPES.has(st)) {
            throw new Error(`GitHubPublicRetriever: unknown searchType "${searchType}" (expected: ${[...SEARCH_TYPES].join(", ")})`);
        }
        const p = new URLSearchParams({
            q: q.trim(),
            sort,
            order: "desc",
            per_page: String(perPageClamped),
            page: String(pageClamped),
        });
        url = `${GH_BASE}/search/${st}?${p.toString()}`;
    } else {
        throw new Error(`GitHubPublicRetriever: unknown mode "${mode}" (expected: user, repo, userRepos, orgRepos, search)`);
    }

    const { data, rateLimitRemaining } = await ghFetch(url);
    return { mode: m, rateLimitRemaining, data };
}
