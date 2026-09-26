import type { RecipeResult } from "../shared/recipeTypes";

const MEAL_BASE = "https://www.themealdb.com/api/json/v1/1";
const FILTER_PARAMS: Record<string, string> = {
    ingredient: "i",
    category: "c",
    area: "a",
};

async function mealFetch<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`themealdb failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryMeal(
    mode: string = "random",
    value: string = "",
    filterBy: string = "ingredient",
): Promise<RecipeResult> {
    const m = mode.toLowerCase();
    let url: string;
    if (m === "random") {
        url = `${MEAL_BASE}/random.php`;
    } else if (m === "search") {
        if (!value.trim()) throw new Error("MealRetriever: mode=search requires 'value'");
        url = `${MEAL_BASE}/search.php?s=${encodeURIComponent(value.trim())}`;
    } else if (m === "lookup") {
        if (!value.trim()) throw new Error("MealRetriever: mode=lookup requires 'value' (meal ID)");
        url = `${MEAL_BASE}/lookup.php?i=${encodeURIComponent(value.trim())}`;
    } else if (m === "filter") {
        const param = FILTER_PARAMS[filterBy.toLowerCase()];
        if (!param) throw new Error(`MealRetriever: unknown filterBy "${filterBy}" (expected: ingredient, category, area)`);
        if (!value.trim()) throw new Error(`MealRetriever: mode=filter requires 'value'`);
        url = `${MEAL_BASE}/filter.php?${param}=${encodeURIComponent(value.trim())}`;
    } else {
        throw new Error(`MealRetriever: unknown mode "${mode}" (expected: search, lookup, random, filter)`);
    }

    const data = await mealFetch<{ meals?: unknown[] | null }>(url);
    const items = Array.isArray(data.meals) ? data.meals : [];
    return { source: "themealdb", mode: m as RecipeResult["mode"], query: value, count: items.length, items };
}
