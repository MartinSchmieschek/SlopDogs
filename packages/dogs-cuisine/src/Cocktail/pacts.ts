import { createPact } from "@slopdogs/core";

export interface CocktailQuery {
    /** Modus: search (nach Name), lookup (nach ID), random, filter (nach Zutat/Glas/Alkohol) */
    mode?: string;
    /** Suchwert / ID / Zutat / Glas */
    value?: string;
    /** Filter-Art fuer mode=filter: ingredient, glass, alcoholic, category — default "ingredient" */
    filterBy?: string;
}

export const CocktailQueryPact = createPact<CocktailQuery>(
    "CocktailQueryProvider",
    { fromSourceType: "CocktailQuery" }
);
