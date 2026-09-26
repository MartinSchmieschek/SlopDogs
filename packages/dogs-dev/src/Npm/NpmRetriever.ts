import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryNpm } from "./npmApiClient";
import type { NpmResult } from "./interfaces/npmTypes";
import { NpmQueryPact, type NpmQuery } from "./pacts";

const NPM_CACHE_TTL_MS = 60 * 60 * 1000;

export class NpmRetriever extends Dog<NpmResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return NpmRetriever.name;
    }

    get description(): string {
        return "NPM-Paketinfo und Download-Zahlen (registry.npmjs.org + api.npmjs.org).";
    }

    get icon(): string | undefined {
        return "\uD83E\uDDF1";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NpmQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<NpmResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NpmQueryPact, d));
        const query = queryDog?.collected as NpmQuery | undefined;
        if (!query?.package) {
            throw new Error("NpmRetriever: Missing required query param 'package'");
        }
        const mode = query.mode ?? "both";
        const period = query.period ?? "last-week";
        const key = `npm:${query.package.toLowerCase()}:${mode}:${period}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, NPM_CACHE_TTL_MS, () =>
                queryNpm(query.package, mode, period),
            );
        }
        return queryNpm(query.package, mode, period);
    };
}
