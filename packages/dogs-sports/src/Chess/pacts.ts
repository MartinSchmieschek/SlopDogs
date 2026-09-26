import { createPact } from "@slopdogs/core";

export interface ChessQuery {
    /** Endpoint: profile, stats, puzzleDaily, tournament, topPlayers — default "profile" */
    endpoint?: string;
    /** Lichess-Username (profile/stats) oder Tournament-ID (tournament) */
    id?: string;
    /** Perf-Typ fuer topPlayers (bullet, blitz, rapid, classical, ...) — oder fuer stats */
    perf?: string;
    /** Limit fuer topPlayers — default 20 */
    limit?: number;
}

export const ChessQueryPact = createPact<ChessQuery>(
    "ChessQueryProvider",
    { fromSourceType: "ChessQuery" }
);
