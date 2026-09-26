import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getDogImages } from "./dogCeoApiClient";
import type { DogCeoResult } from "./interfaces/dogCeoTypes";
import { DogCeoQueryPact, type DogCeoQuery } from "./pacts";

export class DogCeoRetriever extends Dog<DogCeoResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DogCeoRetriever.name;
    }

    get description(): string {
        return "dog.ceo: Zufaellige Hundebilder (optional Rasse + Sub-Rasse, 1-50 Stueck).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDC15";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DogCeoQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DogCeoResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DogCeoQueryPact, d));
        const query = (queryDog?.collected as DogCeoQuery | undefined) ?? {};
        return getDogImages(query.breed, query.subBreed, query.count ?? 1);
    };
}
