import { createPact } from "@slopdogs/core";

export interface LyricsQuery {
    /** Kuenstler-Name */
    artist: string;
    /** Song-Titel */
    title: string;
}

export const LyricsQueryPact = createPact<LyricsQuery>(
    "LyricsQueryProvider",
    { fromSourceType: "LyricsQuery" }
);
