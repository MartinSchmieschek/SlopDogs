import { createPact } from "@slopdogs/core";

export interface HackerNewsQuery {
    /** Endpoint: top, new, best, ask, show, job — oder "item" fuer Einzeleintrag, "user" fuer Profil */
    endpoint?: string;
    /** Bei endpoint=item: die Item-ID; bei endpoint=user: Username */
    id?: string;
    /** Max. Anzahl Items fuer Story-Listen — default 20, max 500 */
    limit?: number;
    /** Fuer Listen: sollen die IDs zu vollen Items aufgeloest werden? Default true */
    hydrate?: boolean;
}

export const HackerNewsQueryPact = createPact<HackerNewsQuery>(
    "HackerNewsQueryProvider",
    { fromSourceType: "HackerNewsQuery" }
);
