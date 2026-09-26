import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryDisease } from "./diseaseApiClient";
import type { DiseaseResult } from "./interfaces/diseaseTypes";
import { DiseaseQueryPact, type DiseaseQuery } from "./pacts";

const DISEASE_CACHE_TTL_MS = 15 * 60 * 1000;

export class DiseaseRetriever extends Dog<DiseaseResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DiseaseRetriever.name;
    }

    get description(): string {
        return "disease.sh: weltweite Zahlen zu COVID-19, Influenza, Ebola (all, countries, country).";
    }

    get icon(): string | undefined {
        return "\uD83E\uDDA0";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DiseaseQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DiseaseResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DiseaseQueryPact, d));
        const query = (queryDog?.collected as DiseaseQuery | undefined) ?? {};
        const disease = query.disease ?? "covid-19";
        const scope = query.scope ?? "all";
        const key = `disease:${disease}:${scope}:${(query.country ?? "").toLowerCase()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, DISEASE_CACHE_TTL_MS, () =>
                queryDisease(disease, scope, query.country),
            );
        }
        return queryDisease(disease, scope, query.country);
    };
}
