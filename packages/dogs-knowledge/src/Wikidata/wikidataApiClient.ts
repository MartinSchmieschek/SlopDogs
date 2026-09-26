import type {
    WikidataResult,
    WikidataSearchHit,
    WikidataEntity,
    WikidataEntityClaim,
    WikidataSparqlResult,
} from "./interfaces/wikidataTypes";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

async function wikiFetch<T>(url: string, accept: string = "application/json"): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                "Accept": accept,
                "User-Agent": "SlopDogs/0.1 (https://github.com/MartinSchmieschek/SlopDogs)",
            },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`wikidata failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

async function searchEntities(term: string, lang: string, limit: number): Promise<WikidataSearchHit[]> {
    const params = new URLSearchParams({
        action: "wbsearchentities",
        search: term,
        language: lang,
        limit: String(Math.max(1, Math.min(50, Math.floor(limit)))),
        format: "json",
        origin: "*",
    });
    const data = await wikiFetch<{ search?: WikidataSearchHit[] }>(`${WIKIDATA_API}?${params.toString()}`);
    return data.search ?? [];
}

function stringifyClaimValue(mainsnak: any): string {
    if (!mainsnak || mainsnak.snaktype !== "value") return String(mainsnak?.snaktype ?? "");
    const dv = mainsnak.datavalue;
    if (!dv) return "";
    const type = dv.type;
    const value = dv.value;
    if (type === "string") return String(value);
    if (type === "wikibase-entityid") return String(value?.id ?? "");
    if (type === "time") return String(value?.time ?? "");
    if (type === "quantity") return String(value?.amount ?? "");
    if (type === "globecoordinate") return `${value?.latitude ?? "?"},${value?.longitude ?? "?"}`;
    if (type === "monolingualtext") return `${value?.text ?? ""}@${value?.language ?? ""}`;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

async function getEntity(id: string, lang: string): Promise<WikidataEntity> {
    const params = new URLSearchParams({
        action: "wbgetentities",
        ids: id,
        languages: lang,
        format: "json",
        origin: "*",
    });
    const data = await wikiFetch<{ entities?: Record<string, any> }>(`${WIKIDATA_API}?${params.toString()}`);
    const ent = data.entities?.[id];
    if (!ent) {
        throw new Error(`wikidata: entity "${id}" not found`);
    }
    const claims: WikidataEntityClaim[] = [];
    const claimsRaw = ent.claims ?? {};
    for (const prop of Object.keys(claimsRaw)) {
        const statements = claimsRaw[prop] ?? [];
        for (const stmt of statements) {
            claims.push({ property: prop, value: stringifyClaimValue(stmt.mainsnak) });
        }
    }
    return {
        id: ent.id,
        label: ent.labels?.[lang]?.value,
        description: ent.descriptions?.[lang]?.value,
        aliases: (ent.aliases?.[lang] ?? []).map((a: any) => a.value),
        claims,
    };
}

async function runSparql(sparql: string): Promise<WikidataSparqlResult> {
    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`;
    const data = await wikiFetch<{ head: { vars: string[] }; results: { bindings: any[] } }>(url);
    return { head: data.head, bindings: data.results.bindings };
}

export async function queryWikidata(
    sparql?: string,
    search?: string,
    entity?: string,
    lang: string = "en",
    limit: number = 10,
): Promise<WikidataResult> {
    if (sparql && sparql.trim()) {
        return { mode: "sparql", query: sparql, lang, sparql: await runSparql(sparql) };
    }
    if (entity && entity.trim()) {
        const id = entity.trim().toUpperCase();
        return { mode: "entity", query: id, lang, entity: await getEntity(id, lang) };
    }
    if (search && search.trim()) {
        return { mode: "search", query: search.trim(), lang, hits: await searchEntities(search.trim(), lang, limit) };
    }
    throw new Error("WikidataRetriever: provide one of 'sparql', 'entity', or 'search'");
}
