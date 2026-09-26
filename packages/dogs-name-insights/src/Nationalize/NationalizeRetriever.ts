import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getNationalize } from "./nationalizeApiClient";
import type { NationalizeResult } from "./interfaces/nationalizeTypes";
import { NameQueryPact, type NameQuery } from "../shared/pacts";

const NATIONALIZE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class NationalizeRetriever extends Dog<NationalizeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return NationalizeRetriever.name;
    }

    get description(): string {
        return "nationalize.io: Wahrscheinliche Nationalitaeten aus Vorname (top-N Laender mit Wahrscheinlichkeit).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFF3\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NameQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<NationalizeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NameQueryPact, d));
        const query = queryDog?.collected as NameQuery | undefined;
        if (!query?.name) {
            throw new Error("NationalizeRetriever: Missing required query param 'name'");
        }
        const key = `nationalize:${query.name.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, NATIONALIZE_CACHE_TTL_MS, () =>
                getNationalize(query.name),
            );
        }
        return getNationalize(query.name);
    };
}
