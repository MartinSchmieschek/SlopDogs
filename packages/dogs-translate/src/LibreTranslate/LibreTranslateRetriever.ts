import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { translateText } from "./libreTranslateApiClient";
import type { LibreTranslateResult } from "./interfaces/libreTranslateTypes";
import { LibreTranslateQueryPact, type LibreTranslateQuery } from "./pacts";

const LT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class LibreTranslateRetriever extends Dog<LibreTranslateResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return LibreTranslateRetriever.name;
    }

    get description(): string {
        return "LibreTranslate: Uebersetzung via Community-Instanzen (Fedilab/Terraprint/Argos); ENV LIBRETRANSLATE_URL override.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDDE3\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [LibreTranslateQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<LibreTranslateResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(LibreTranslateQueryPact, d));
        const query = queryDog?.collected as LibreTranslateQuery | undefined;
        if (!query?.text) {
            throw new Error("LibreTranslateRetriever: Missing required query param 'text'");
        }
        const source = query.source ?? "auto";
        const target = query.target ?? "en";
        const key = `libretranslate:${source}->${target}:${query.text.toLowerCase().trim()}`;
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, LT_CACHE_TTL_MS, () =>
                translateText(query.text, source, target),
            );
        }
        return translateText(query.text, source, target);
    };
}
