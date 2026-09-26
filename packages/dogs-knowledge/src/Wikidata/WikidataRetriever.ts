import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryWikidata } from "./wikidataApiClient";
import type { WikidataResult } from "./interfaces/wikidataTypes";
import { WikidataQueryPact, type WikidataQuery } from "./pacts";

const WIKIDATA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class WikidataRetriever extends Dog<WikidataResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WikidataRetriever.name;
    }

    get description(): string {
        return "Wikidata: SPARQL, Entity-Lookup (Q-ID) oder Labelsuche.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDDE0";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WikidataQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WikidataResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WikidataQueryPact, d));
        const query = (queryDog?.collected as WikidataQuery | undefined) ?? ({} as WikidataQuery);
        const lang = query.lang ?? "en";
        const limit = query.limit ?? 10;

        const mode = query.sparql ? "sparql" : query.entity ? "entity" : "search";
        const keyPayload = mode === "sparql"
            ? `sparql:${query.sparql}`
            : mode === "entity"
                ? `entity:${(query.entity ?? "").toUpperCase()}`
                : `search:${(query.search ?? "").toLowerCase()}:${limit}`;
        const key = `wikidata:${lang}:${keyPayload}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, WIKIDATA_CACHE_TTL_MS, () =>
                queryWikidata(query.sparql, query.search, query.entity, lang, limit),
            );
        }
        return queryWikidata(query.sparql, query.search, query.entity, lang, limit);
    };
}
