import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { PopCultureQueryPact, type PopCultureQuery } from "../shared/pacts";
import type { PopCultureResult } from "../shared/types";
import { popCultureFetch } from "../shared/popCultureApiClient";

const HP_BASE = "https://hp-api.onrender.com/api";
const HP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** hp-api hat mehrere Endpunkte und Spezialrouten */
const HP_SIMPLE = new Set(["characters", "spells"]);
const HP_HOUSES = new Set(["gryffindor", "slytherin", "ravenclaw", "hufflepuff"]);
const HP_CHAR_GROUPS = new Set(["students", "staff"]);

export class HarryPotterRetriever extends Dog<PopCultureResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return HarryPotterRetriever.name;
    }

    get description(): string {
        return "HP-API (hp-api.onrender.com): characters, spells, characters/students, characters/staff, characters/house/<name>.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDE84";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PopCultureQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    private buildUrl(resource: string, id?: string): string {
        if (HP_SIMPLE.has(resource)) {
            if (id && id.trim()) return `${HP_BASE}/${resource}/${encodeURIComponent(id.trim())}`;
            return `${HP_BASE}/${resource}`;
        }
        if (HP_CHAR_GROUPS.has(resource)) return `${HP_BASE}/characters/${resource}`;
        if (HP_HOUSES.has(resource)) return `${HP_BASE}/characters/house/${resource}`;
        throw new Error(`HarryPotterRetriever: unknown resource "${resource}" (expected: characters, spells, students, staff, gryffindor, slytherin, ravenclaw, hufflepuff)`);
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PopCultureResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PopCultureQueryPact, d));
        const query = (queryDog?.collected as PopCultureQuery | undefined) ?? {};
        const resource = (query.resource ?? "characters").toLowerCase();
        const url = this.buildUrl(resource, query.id);

        const buildAndFetch = async (): Promise<PopCultureResult> => {
            if (query.id && HP_SIMPLE.has(resource)) {
                const arr = await popCultureFetch<unknown[]>(url);
                const item = Array.isArray(arr) ? arr[0] : arr;
                return { mode: "item", source: "hp-api", resource, id: query.id, item };
            }
            const items = await popCultureFetch<unknown[]>(url);
            const all = Array.isArray(items) ? items : [];
            const search = query.search?.trim().toLowerCase();
            const filtered = search
                ? all.filter(it => JSON.stringify(it ?? "").toLowerCase().includes(search))
                : all;
            return {
                mode: "list",
                source: "hp-api",
                resource,
                count: filtered.length,
                page: 1,
                hasMore: false,
                items: filtered,
            };
        };

        const key = `hp:${resource}:${(query.id ?? "").toLowerCase().trim()}:${(query.search ?? "").toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, HP_CACHE_TTL_MS, buildAndFetch);
        }
        return buildAndFetch();
    };
}
