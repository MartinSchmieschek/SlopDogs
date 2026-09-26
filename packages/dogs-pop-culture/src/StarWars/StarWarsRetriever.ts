import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { PopCultureQueryPact, type PopCultureQuery } from "../shared/pacts";
import type { PopCultureResult } from "../shared/types";
import { popCultureFetch } from "../shared/popCultureApiClient";

const SW_BASE = "https://swapi.dev/api";
const SW_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SW_RESOURCES = new Set(["people", "films", "planets", "species", "vehicles", "starships"]);

export class StarWarsRetriever extends Dog<PopCultureResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return StarWarsRetriever.name;
    }

    get description(): string {
        return "SWAPI (swapi.dev): people, films, planets, species, vehicles, starships.";
    }

    get icon(): string | undefined {
        return "\u2B50";
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
        const resource = (query.resource ?? "people").toLowerCase();
        if (!SW_RESOURCES.has(resource)) {
            throw new Error(`StarWarsRetriever: unknown resource "${resource}" (expected: ${[...SW_RESOURCES].join(", ")})`);
        }
        const page = query.page ?? 1;

        const buildAndFetch = async (): Promise<PopCultureResult> => {
            if (query.id && query.id.trim()) {
                const item = await popCultureFetch<unknown>(`${SW_BASE}/${resource}/${encodeURIComponent(query.id.trim())}/`);
                return { mode: "item", source: "swapi", resource, id: query.id.trim(), item };
            }
            const params = new URLSearchParams();
            if (query.search && query.search.trim()) params.set("search", query.search.trim());
            if (page > 1) params.set("page", String(Math.floor(page)));
            const url = params.toString() ? `${SW_BASE}/${resource}/?${params.toString()}` : `${SW_BASE}/${resource}/`;
            const data = await popCultureFetch<{ count: number; next: string | null; results: unknown[] }>(url);
            return {
                mode: "list",
                source: "swapi",
                resource,
                count: data.count,
                page,
                hasMore: Boolean(data.next),
                items: data.results,
            };
        };

        const key = `swapi:${resource}:${(query.id ?? "").toLowerCase().trim()}:${(query.search ?? "").toLowerCase().trim()}:${page}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, SW_CACHE_TTL_MS, buildAndFetch);
        }
        return buildAndFetch();
    };
}
