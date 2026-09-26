import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getGenderize } from "./genderizeApiClient";
import type { GenderizeResult } from "./interfaces/genderizeTypes";
import { NameQueryPact, type NameQuery } from "../shared/pacts";

const GENDERIZE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class GenderizeRetriever extends Dog<GenderizeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GenderizeRetriever.name;
    }

    get description(): string {
        return "genderize.io: Geschlechts-Vorhersage aus Vorname mit Wahrscheinlichkeit.";
    }

    get icon(): string | undefined {
        return "\u26A7\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NameQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GenderizeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NameQueryPact, d));
        const query = queryDog?.collected as NameQuery | undefined;
        if (!query?.name) {
            throw new Error("GenderizeRetriever: Missing required query param 'name'");
        }
        const key = `genderize:${query.name.toLowerCase().trim()}:${(query.country ?? "").toUpperCase()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GENDERIZE_CACHE_TTL_MS, () =>
                getGenderize(query.name, query.country),
            );
        }
        return getGenderize(query.name, query.country);
    };
}
