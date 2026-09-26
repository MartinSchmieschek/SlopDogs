import { createPact } from "@slopdogs/core";

export interface DiseaseQuery {
    /** Krankheit: covid-19, influenza, ebola — default "covid-19" */
    disease?: string;
    /** Scope: all (weltweit), countries (Liste aller Laender), country (einzeln) — default "all" */
    scope?: string;
    /** Land (ISO2/ISO3 oder Name) — nur bei scope="country" */
    country?: string;
}

export const DiseaseQueryPact = createPact<DiseaseQuery>(
    "DiseaseQueryProvider",
    { fromSourceType: "DiseaseQuery" }
);
