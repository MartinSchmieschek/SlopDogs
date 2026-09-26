import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { PopCultureQueryPact, type PopCultureQuery } from "../shared/pacts";
import type { PopCultureResult } from "../shared/types";
import { popCultureFetch } from "../shared/popCultureApiClient";

const GHIBLI_BASE = "https://ghibliapi.vercel.app";
const GHIBLI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GHIBLI_RESOURCES = new Set(["films", "people", "locations", "species", "vehicles"]);

export class GhibliRetriever extends Dog<PopCultureResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GhibliRetriever.name;
    }

    get description(): string {
        return "Studio Ghibli API: films, people, locations, species, vehicles.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFAC";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PopCultureQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PopCultureResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PopCultureQueryPact, d));
        const query = (queryDog?.collected as PopCultureQuery | undefined) ?? {};
        const resource = (query.resource ?? "films").toLowerCase();
        if (!GHIBLI_RESOURCES.has(resource)) {
            throw new Error(`GhibliRetriever: unknown resource "${resource}" (expected: ${[...GHIBLI_RESOURCES].join(", ")})`);
        }

        const buildAndFetch = async (): Promise<PopCultureResult> => {
            if (query.id && query.id.trim()) {
                const item = await popCultureFetch<unknown>(`${GHIBLI_BASE}/${resource}/${encodeURIComponent(query.id.trim())}`);
                return { mode: "item", source: "ghibli", resource, id: query.id.trim(), item };
            }
            const items = await popCultureFetch<unknown[]>(`${GHIBLI_BASE}/${resource}`);
            const all = Array.isArray(items) ? items : [];
            const search = query.search?.trim().toLowerCase();
            const filtered = search
                ? all.filter(it => JSON.stringify(it ?? "").toLowerCase().includes(search))
                : all;
            return {
                mode: "list",
                source: "ghibli",
                resource,
                count: filtered.length,
                page: 1,
                hasMore: false,
                items: filtered,
            };
        };

        const key = `ghibli:${resource}:${(query.id ?? "").toLowerCase().trim()}:${(query.search ?? "").toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GHIBLI_CACHE_TTL_MS, buildAndFetch);
        }
        return buildAndFetch();
    };
}
