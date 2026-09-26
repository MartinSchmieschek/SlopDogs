import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getNasaApod } from "./nasaApodApiClient";
import type { NasaApodResult } from "./interfaces/nasaApodTypes";
import { NasaApodQueryPact, type NasaApodQuery } from "./pacts";

const APOD_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class NasaApodRetriever extends Dog<NasaApodResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return NasaApodRetriever.name;
    }

    get description(): string {
        return "NASA Astronomy Picture of the Day (APOD) — nutzt DEMO_KEY oder NASA_API_KEY.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF0C";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NasaApodQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<NasaApodResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NasaApodQueryPact, d));
        const query = (queryDog?.collected as NasaApodQuery | undefined) ?? {};
        const hd = query.hd ?? false;
        const key = `nasa-apod:${query.date ?? "today"}:${hd}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, APOD_CACHE_TTL_MS, () =>
                getNasaApod(query.date, hd),
            );
        }
        return getNasaApod(query.date, hd);
    };
}
