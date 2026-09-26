import type { SportsDbResult } from "./interfaces/sportsDbTypes";

/** Public-Test-Key "3" — fuer produktive Nutzung regulaeren Key eintragen */
const SDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

type EndpointSpec =
    | { style: "query"; path: string; param: string }
    | { style: "idPath"; path: string; param: string }
    | { style: "multiArg"; build: (q: string, a2?: string, a3?: string) => string };

const ENDPOINTS: Record<string, EndpointSpec> = {
    searchteams: { style: "query", path: "searchteams.php", param: "t" },
    searchplayers: { style: "query", path: "searchplayers.php", param: "p" },
    searchevents: { style: "query", path: "searchevents.php", param: "e" },
    all_leagues: { style: "query", path: "all_leagues.php", param: "" },
    lookupteam: { style: "query", path: "lookupteam.php", param: "id" },
    lookupleague: { style: "query", path: "lookupleague.php", param: "id" },
    lookupplayer: { style: "query", path: "lookupplayer.php", param: "id" },
    eventsnext: { style: "query", path: "eventsnext.php", param: "id" },
    eventslast: { style: "query", path: "eventslast.php", param: "id" },
    eventsround: {
        style: "multiArg",
        build: (league, season, round) => {
            const p = new URLSearchParams({ id: league });
            if (season) p.set("s", season);
            if (round) p.set("r", round);
            return `eventsround.php?${p.toString()}`;
        },
    },
    eventsseason: {
        style: "multiArg",
        build: (league, season) => {
            const p = new URLSearchParams({ id: league });
            if (season) p.set("s", season);
            return `eventsseason.php?${p.toString()}`;
        },
    },
};

async function sdbFetch<T>(url: string): Promise<T> {
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
        throw new Error(`thesportsdb failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function querySportsDb(
    endpoint: string = "searchteams",
    query: string = "",
    arg2?: string,
    arg3?: string,
): Promise<SportsDbResult> {
    const ep = endpoint.toLowerCase();
    const spec = ENDPOINTS[ep];
    if (!spec) {
        throw new Error(`SportsDBRetriever: unknown endpoint "${endpoint}" (expected: ${Object.keys(ENDPOINTS).join(", ")})`);
    }

    let pathAndQuery: string;
    if (spec.style === "multiArg") {
        pathAndQuery = spec.build(query, arg2, arg3);
    } else if (spec.param) {
        const params = new URLSearchParams();
        if (query.trim()) params.set(spec.param, query.trim());
        pathAndQuery = `${spec.path}?${params.toString()}`;
    } else {
        pathAndQuery = spec.path;
    }

    const data = await sdbFetch<unknown>(`${SDB_BASE}/${pathAndQuery}`);
    return { endpoint: ep, data };
}
