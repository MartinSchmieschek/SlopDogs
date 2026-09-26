import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRandomDuck } from "./duckApiClient";
import type { DuckResult } from "./interfaces/duckTypes";
import { DuckQueryPact } from "./pacts";

export class DuckRetriever extends Dog<DuckResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DuckRetriever.name;
    }

    get description(): string {
        return "Holt ein zufaelliges Enten-Bild/GIF von random-d.uk.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD86";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DuckQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<DuckResult> => {
        return getRandomDuck();
    };
}
