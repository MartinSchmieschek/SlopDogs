import { createPact } from "@slopdogs/core";

export interface TvMazeQuery {
    /** Modus: search (Serien suchen), singleSearch (erster Treffer), show (nach ID),
     *  episodes (Episodenliste einer Serie), cast (Cast einer Serie), schedule (Sendeplan) */
    mode?: string;
    /** Suchstring (search/singleSearch/schedule-country), Show-ID (show/episodes/cast), oder ISO-Datum fuer schedule */
    value?: string;
    /** Zweiter Parameter: fuer schedule = YYYY-MM-DD (default heute) */
    date?: string;
    /** Embed-Parameter fuer show-Modus: "cast", "seasons", "episodes", "crew" */
    embed?: string;
}

export const TvMazeQueryPact = createPact<TvMazeQuery>(
    "TvMazeQueryProvider",
    { fromSourceType: "TvMazeQuery" }
);
