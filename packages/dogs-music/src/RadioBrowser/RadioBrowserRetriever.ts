import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryRadioBrowser } from "./radioBrowserApiClient";
import type { RadioBrowserResult } from "./interfaces/radioBrowserTypes";
import { RadioBrowserQueryPact, type RadioBrowserQuery } from "./pacts";

const RADIO_CACHE_TTL_MS = 60 * 60 * 1000;

export class RadioBrowserRetriever extends Dog<RadioBrowserResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return RadioBrowserRetriever.name;
    }

    get description(): string {
        return "Radio-Browser: Streams weltweit (search/bycountry/bylanguage/bytag).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDCFB";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RadioBrowserQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RadioBrowserResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(RadioBrowserQueryPact, d));
        const query = (queryDog?.collected as RadioBrowserQuery | undefined) ?? {};
        const mode = (query.mode ?? "search").toLowerCase();
        const value = query.value ?? "";
        const limit = query.limit ?? 30;
        const offset = query.offset ?? 0;
        const order = query.order ?? "clickcount";
        const reverse = query.reverse ?? true;

        const key = `radio:${mode}:${value.toLowerCase()}:${limit}:${offset}:${order}:${reverse}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, RADIO_CACHE_TTL_MS, () =>
                queryRadioBrowser(mode, value, limit, offset, order, reverse),
            );
        }
        return queryRadioBrowser(mode, value, limit, offset, order, reverse);
    };
}
