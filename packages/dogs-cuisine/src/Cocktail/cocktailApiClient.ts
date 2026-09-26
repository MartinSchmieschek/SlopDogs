import type { RecipeResult } from "../shared/recipeTypes";

const COCKTAIL_BASE = "https://www.thecocktaildb.com/api/json/v1/1";
const FILTER_PARAMS: Record<string, string> = {
    ingredient: "i",
    glass: "g",
    alcoholic: "a",
    category: "c",
};

async function cocktailFetch<T>(url: string): Promise<T> {
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
        throw new Error(`thecocktaildb failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<T>;
}

export async function queryCocktail(
    mode: string = "random",
    value: string = "",
    filterBy: string = "ingredient",
): Promise<RecipeResult> {
    const m = mode.toLowerCase();
    let url: string;
    if (m === "random") {
        url = `${COCKTAIL_BASE}/random.php`;
    } else if (m === "search") {
        if (!value.trim()) throw new Error("CocktailRetriever: mode=search requires 'value'");
        url = `${COCKTAIL_BASE}/search.php?s=${encodeURIComponent(value.trim())}`;
    } else if (m === "lookup") {
        if (!value.trim()) throw new Error("CocktailRetriever: mode=lookup requires 'value' (drink ID)");
        url = `${COCKTAIL_BASE}/lookup.php?i=${encodeURIComponent(value.trim())}`;
    } else if (m === "filter") {
        const param = FILTER_PARAMS[filterBy.toLowerCase()];
        if (!param) throw new Error(`CocktailRetriever: unknown filterBy "${filterBy}" (expected: ingredient, glass, alcoholic, category)`);
        if (!value.trim()) throw new Error(`CocktailRetriever: mode=filter requires 'value'`);
        url = `${COCKTAIL_BASE}/filter.php?${param}=${encodeURIComponent(value.trim())}`;
    } else {
        throw new Error(`CocktailRetriever: unknown mode "${mode}" (expected: search, lookup, random, filter)`);
    }

    const data = await cocktailFetch<{ drinks?: unknown[] | null }>(url);
    const items = Array.isArray(data.drinks) ? data.drinks : [];
    return { source: "thecocktaildb", mode: m as RecipeResult["mode"], query: value, count: items.length, items };
}
