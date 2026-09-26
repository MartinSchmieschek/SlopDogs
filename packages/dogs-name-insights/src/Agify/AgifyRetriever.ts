import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getAgify } from "./agifyApiClient";
import type { AgifyResult } from "./interfaces/agifyTypes";
import { NameQueryPact, type NameQuery } from "../shared/pacts";

const AGIFY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AgifyRetriever extends Dog<AgifyResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return AgifyRetriever.name;
    }

    get description(): string {
        return "agify.io: Alter aus Vorname schaetzen (optional mit Laendercode fuer bessere Genauigkeit).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDC76";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NameQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<AgifyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NameQueryPact, d));
        const query = queryDog?.collected as NameQuery | undefined;
        if (!query?.name) {
            throw new Error("AgifyRetriever: Missing required query param 'name'");
        }
        const key = `agify:${query.name.toLowerCase().trim()}:${(query.country ?? "").toUpperCase()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, AGIFY_CACHE_TTL_MS, () =>
                getAgify(query.name, query.country),
            );
        }
        return getAgify(query.name, query.country);
    };
}
