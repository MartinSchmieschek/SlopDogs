import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryPicsum } from "./picsumApiClient";
import type { PicsumResult } from "./interfaces/picsumTypes";
import { PicsumQueryPact, type PicsumQuery } from "./pacts";

const PICSUM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class PicsumRetriever extends Dog<PicsumResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return PicsumRetriever.name;
    }

    get description(): string {
        return "picsum.photos: Lorem Picsum — Platzhalterbilder (list/info/randomUrl mit Blur/Grayscale).";
    }

    get icon(): string | undefined {
        return "\uD83D\uDDBC\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PicsumQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PicsumResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PicsumQueryPact, d));
        const query = (queryDog?.collected as PicsumQuery | undefined) ?? {};
        const mode = query.mode ?? "list";
        const width = query.width ?? 400;
        const height = query.height ?? 300;
        const page = query.page ?? 1;
        const limit = query.limit ?? 30;
        const grayscale = query.grayscale ?? false;

        // list + info cachen; randomUrl nicht (soll variieren)
        if ((mode.toLowerCase() === "list" || mode.toLowerCase() === "info") && this.cacheHandler) {
            const key = `picsum:${mode}:${query.id ?? ""}:${page}:${limit}`;
            return this.cacheHandler.getOrFetch(key, PICSUM_CACHE_TTL_MS, () =>
                queryPicsum(mode, width, height, query.seed, query.id, page, limit, grayscale, query.blur),
            );
        }
        return queryPicsum(mode, width, height, query.seed, query.id, page, limit, grayscale, query.blur);
    };
}
