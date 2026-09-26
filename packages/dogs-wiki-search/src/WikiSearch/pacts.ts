import { createPact } from "@slopdogs/core";

export interface WikiSearchQuery {
    /** Search term */
    q: string;
    /** Wikipedia language edition (e.g. "en", "de"). Defaults to "en". */
    lang?: string;
}

export const WikiSearchQueryPact = createPact<WikiSearchQuery>(
    "WikiSearchQueryProvider",
    { fromSourceType: "WikiSearchQuery" }
);
