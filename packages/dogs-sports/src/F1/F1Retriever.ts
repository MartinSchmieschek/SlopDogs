import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getF1 } from "./f1ApiClient";
import type { F1Result } from "./interfaces/f1Types";
import { F1QueryPact, type F1Query } from "./pacts";

const F1_CACHE_TTL_MS = 60 * 60 * 1000;

export class F1Retriever extends Dog<F1Result> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return F1Retriever.name;
    }

    get description(): string {
        return "F1 (Jolpi/Ergast-Mirror): Saisons, Rennen, Ergebnisse, Qualifying, Standings.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFCE\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [F1QueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<F1Result> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(F1QueryPact, d));
        const query = (queryDog?.collected as F1Query | undefined) ?? {};
        const s = query.season ?? "current";
        const resource = query.resource ?? "races";
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const key = `f1:${s}:${query.round ?? ""}:${resource}:${limit}:${offset}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, F1_CACHE_TTL_MS, () =>
                getF1(s, query.round, resource, limit, offset),
            );
        }
        return getF1(s, query.round, resource, limit, offset);
    };
}
