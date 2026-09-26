import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getWaybackSnapshot } from "./waybackApiClient";
import type { WaybackResult } from "./interfaces/waybackTypes";
import { WaybackQueryPact, type WaybackQuery } from "./pacts";

const WAYBACK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class WaybackRetriever extends Dog<WaybackResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WaybackRetriever.name;
    }

    get description(): string {
        return "Internet Archive Wayback: naechster Snapshot zu URL (optional mit Zeitstempel).";
    }

    get icon(): string | undefined {
        return "\u23F3";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WaybackQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WaybackResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WaybackQueryPact, d));
        const query = queryDog?.collected as WaybackQuery | undefined;
        if (!query?.url) {
            throw new Error("WaybackRetriever: Missing required query param 'url'");
        }
        const key = `wayback:${(query.timestamp ?? "latest")}:${query.url.toLowerCase()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, WAYBACK_CACHE_TTL_MS, () =>
                getWaybackSnapshot(query.url, query.timestamp),
            );
        }
        return getWaybackSnapshot(query.url, query.timestamp);
    };
}
