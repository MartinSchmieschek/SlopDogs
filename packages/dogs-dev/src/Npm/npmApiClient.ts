import type { NpmResult, NpmDownloads } from "./interfaces/npmTypes";

const REGISTRY_BASE = "https://registry.npmjs.org";
const DOWNLOADS_BASE = "https://api.npmjs.org/downloads/point";

const PERIODS = new Set(["last-day", "last-week", "last-month", "last-year"]);

async function npmFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`npm fetch failed (${url}): ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

function encodePackage(name: string): string {
    return name.startsWith("@")
        ? `@${encodeURIComponent(name.slice(1))}`
        : encodeURIComponent(name);
}

export async function queryNpm(
    pkg: string,
    mode: string = "both",
    period: string = "last-week",
): Promise<NpmResult> {
    if (!pkg || !pkg.trim()) {
        throw new Error("NpmRetriever: 'package' is required");
    }
    const m = mode.toLowerCase();
    const p = period.toLowerCase();
    if (!PERIODS.has(p)) {
        throw new Error(`NpmRetriever: invalid period "${period}" (expected: ${[...PERIODS].join(", ")})`);
    }
    const encoded = encodePackage(pkg.trim());

    const result: NpmResult = { package: pkg.trim(), mode: m };

    if (m === "meta" || m === "both") {
        const raw = await npmFetch<any>(`${REGISTRY_BASE}/${encoded}`);
        const latest = raw["dist-tags"]?.latest;
        result.meta = {
            name: raw.name,
            description: raw.description,
            license: raw.license,
            homepage: raw.homepage,
            repository: typeof raw.repository === "string" ? raw.repository : raw.repository?.url,
            latest,
            versions: raw.versions ? Object.keys(raw.versions) : undefined,
            maintainers: raw.maintainers,
            time: raw.time,
        };
    }
    if (m === "downloads" || m === "both") {
        const dl = await npmFetch<NpmDownloads>(`${DOWNLOADS_BASE}/${p}/${encoded}`);
        result.downloads = dl;
    }

    return result;
}
