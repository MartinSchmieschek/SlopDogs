import { createPact } from "@slopdogs/core";

export interface MealQuery {
    /** Modus: search, lookup, random, filter */
    mode?: string;
    /** Suchwert / ID / Zutat */
    value?: string;
    /** Filter-Art: ingredient, category, area — default "ingredient" */
    filterBy?: string;
}

export const MealQueryPact = createPact<MealQuery>(
    "MealQueryProvider",
    { fromSourceType: "MealQuery" }
);
