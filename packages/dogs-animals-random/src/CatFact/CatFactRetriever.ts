import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getCatFact } from "./catFactApiClient";
import type { CatFactResult } from "./interfaces/catFactTypes";
import { CatFactQueryPact, type CatFactQuery } from "./pacts";

export class CatFactRetriever extends Dog<CatFactResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return CatFactRetriever.name;
    }

    get description(): string {
        return "Holt einen zufaelligen Katzen-Fakt von catfact.ninja.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDC31";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    // Welle 10: maxLength ist optional -- ohne Mimic kommt einfach der naechste Random-Fact.
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [CatFactQueryPact];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<CatFactResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(CatFactQueryPact, d));
        const query = (queryDog?.collected as CatFactQuery | undefined) ?? ({} as CatFactQuery);
        return getCatFact(query.maxLength);
    };
}
