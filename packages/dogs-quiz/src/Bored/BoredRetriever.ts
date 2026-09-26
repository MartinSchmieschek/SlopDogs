import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getBoredActivity } from "./boredApiClient";
import type { BoredResult } from "./interfaces/boredTypes";
import { BoredQueryPact, type BoredQuery } from "./pacts";

export class BoredRetriever extends Dog<BoredResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return BoredRetriever.name;
    }

    get description(): string {
        return "Bored-API: Vorschlaege fuer Aktivitaeten nach Typ, Teilnehmern, Preis.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD71";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BoredQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BoredResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BoredQueryPact, d));
        const query = (queryDog?.collected as BoredQuery | undefined) ?? {};
        return getBoredActivity(query.type, query.participants, query.maxPrice, query.maxAccessibility);
    };
}
