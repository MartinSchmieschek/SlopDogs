import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryQuran } from "./quranApiClient";
import type { QuranResult } from "./interfaces/quranTypes";
import { QuranQueryPact, type QuranQuery } from "./pacts";

const QURAN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class QuranRetriever extends Dog<QuranResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return QuranRetriever.name;
    }

    get description(): string {
        return "Quran via alquran.cloud: ayah, surah, random (Editionen: en.sahih, de.bubenheim, quran-uthmani, ...).";
    }

    get icon(): string | undefined {
        return "\u262A\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [QuranQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<QuranResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(QuranQueryPact, d));
        const query = (queryDog?.collected as QuranQuery | undefined) ?? {};
        const mode = (query.mode ?? "ayah").toLowerCase();
        const edition = query.edition ?? "en.sahih";
        // random nicht cachen — sonst immer gleicher Vers
        if (mode !== "random" && this.cacheHandler) {
            const key = `quran:${mode}:${edition}:${(query.reference ?? "").trim()}`;
            return this.cacheHandler.getOrFetch(key, QURAN_CACHE_TTL_MS, () =>
                queryQuran(mode, query.reference, edition),
            );
        }
        return queryQuran(mode, query.reference, edition);
    };
}
