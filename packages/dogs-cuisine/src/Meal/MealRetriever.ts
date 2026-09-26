import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { queryMeal } from "./mealApiClient";
import type { RecipeResult } from "../shared/recipeTypes";
import { MealQueryPact, type MealQuery } from "./pacts";

const MEAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class MealRetriever extends Dog<RecipeResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return MealRetriever.name;
    }

    get description(): string {
        return "TheMealDB: search/lookup/filter/random (keine Keys).";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF7D\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [MealQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<RecipeResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(MealQueryPact, d));
        const query = (queryDog?.collected as MealQuery | undefined) ?? {};
        const mode = (query.mode ?? "random").toLowerCase();
        const value = query.value ?? "";
        const filterBy = query.filterBy ?? "ingredient";

        if (mode !== "random" && this.cacheHandler) {
            const key = `meal:${mode}:${filterBy}:${value.toLowerCase()}`;
            return this.cacheHandler.getOrFetch(key, MEAL_CACHE_TTL_MS, () =>
                queryMeal(mode, value, filterBy),
            );
        }
        return queryMeal(mode, value, filterBy);
    };
}
