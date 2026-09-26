import { createPact } from "@slopdogs/core";

export interface TriviaQuery {
    /** Anzahl Fragen (1-50) — default 10 */
    amount?: number;
    /** Kategorie-ID (siehe opentdb.com/api_category.php) */
    category?: number;
    /** easy, medium, hard */
    difficulty?: string;
    /** multiple, boolean */
    type?: string;
}

export const TriviaQueryPact = createPact<TriviaQuery>(
    "TriviaQueryProvider",
    { fromSourceType: "TriviaQuery" }
);
