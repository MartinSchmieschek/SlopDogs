import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryCocktail } from "./cocktailApiClient";
import type { RecipeResult } from "../shared/recipeTypes";
import { CocktailQueryPact, type CocktailQuery } from "./pacts";

const COCKTAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class CocktailRetriever extends Dog<RecipeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return CocktailRetriever.name;
    }

    get description(): string {
        return "TheCocktailDB: search/lookup/filter/random (keine Keys).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF79";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    // Welle 10: Modus/Suchwert sind optional -- ohne Mimic faellt der Retriever auf
    // mode="random" und liefert einen zufaelligen Cocktail.
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [CocktailQueryPact];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RecipeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(CocktailQueryPact, d));
        const query = (queryDog?.collected as CocktailQuery | undefined) ?? {};
        const mode = (query.mode ?? "random").toLowerCase();
        const value = query.value ?? "";
        const filterBy = query.filterBy ?? "ingredient";

        // random nicht cachen
        if (mode !== "random" && this.cacheHandler) {
            const key = `cocktail:${mode}:${filterBy}:${value.toLowerCase()}`;
            return this.cacheHandler.getOrFetch(key, COCKTAIL_CACHE_TTL_MS, () =>
                queryCocktail(mode, value, filterBy),
            );
        }
        return queryCocktail(mode, value, filterBy);
    };
}
