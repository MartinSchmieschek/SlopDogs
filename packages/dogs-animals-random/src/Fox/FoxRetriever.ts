import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getRandomFox } from "./foxApiClient";
import type { FoxResult } from "./interfaces/foxTypes";
import { FoxQueryPact } from "./pacts";

export class FoxRetriever extends Dog<FoxResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return FoxRetriever.name;
    }

    get description(): string {
        return "Holt ein zufaelliges Fuchs-Bild von randomfox.ca.";
    }

    get icon(): string | undefined {
        return "\uD83E\uDD8A";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [FoxQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<FoxResult> => {
        return getRandomFox();
    };
}
