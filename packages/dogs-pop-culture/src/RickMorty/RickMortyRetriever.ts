import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { PopCultureQueryPact, type PopCultureQuery } from "../shared/pacts";
import type { PopCultureResult } from "../shared/types";
import { popCultureFetch } from "../shared/popCultureApiClient";

const RM_BASE = "https://rickandmortyapi.com/api";
const RM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RM_RESOURCES = new Set(["character", "location", "episode"]);

export class RickMortyRetriever extends Dog<PopCultureResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return RickMortyRetriever.name;
    }

    get description(): string {
        return "Rick & Morty API: character, location, episode.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEF8";
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
        const resource = (query.resource ?? "character").toLowerCase();
        if (!RM_RESOURCES.has(resource)) {
            throw new Error(`RickMortyRetriever: unknown resource "${resource}" (expected: ${[...RM_RESOURCES].join(", ")})`);
        }
        const page = query.page ?? 1;

        const buildAndFetch = async (): Promise<PopCultureResult> => {
            if (query.id && query.id.trim()) {
                const item = await popCultureFetch<unknown>(`${RM_BASE}/${resource}/${encodeURIComponent(query.id.trim())}`);
                return { mode: "item", source: "rickandmorty", resource, id: query.id.trim(), item };
            }
            const params = new URLSearchParams();
            if (query.search && query.search.trim()) params.set("name", query.search.trim());
            if (page > 1) params.set("page", String(Math.floor(page)));
            const url = params.toString() ? `${RM_BASE}/${resource}?${params.toString()}` : `${RM_BASE}/${resource}`;
            const data = await popCultureFetch<{ info: { count: number; next: string | null }; results: unknown[] }>(url);
            return {
                mode: "list",
                source: "rickandmorty",
                resource,
                count: data.info?.count ?? (data.results?.length ?? 0),
                page,
                hasMore: Boolean(data.info?.next),
                items: data.results ?? [],
            };
        };

        const key = `rickandmorty:${resource}:${(query.id ?? "").toLowerCase().trim()}:${(query.search ?? "").toLowerCase().trim()}:${page}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, RM_CACHE_TTL_MS, buildAndFetch);
        }
        return buildAndFetch();
    };
}
