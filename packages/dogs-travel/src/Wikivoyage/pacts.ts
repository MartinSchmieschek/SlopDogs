import { createPact } from "@slopdogs/core";

export interface WikivoyageQuery {
    /** Ziel/Reiseort (Seitentitel) */
    place: string;
    /** Sprache (en, de, fr, ...) — default "en" */
    lang?: string;
}

export const WikivoyageQueryPact = createPact<WikivoyageQuery>(
    "WikivoyageQueryProvider",
    { fromSourceType: "WikivoyageQuery" }
);
