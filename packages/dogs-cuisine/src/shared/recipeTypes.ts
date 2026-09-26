/** Gemeinsames Result-Envelope fuer Cocktail- und Meal-Hunde */
export interface RecipeResult {
    source: "thecocktaildb" | "themealdb";
    mode: "search" | "lookup" | "random" | "filter";
    query: string;
    count: number;
    items: unknown[];
}
