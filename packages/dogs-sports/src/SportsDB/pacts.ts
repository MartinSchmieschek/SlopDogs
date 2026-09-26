import { createPact } from "@slopdogs/core";

export interface SportsDbQuery {
    /** Endpoint: searchteams, searchplayers, searchevents, all_leagues, lookupteam, lookupleague, lookupplayer, eventsnext, eventslast, eventsround, eventsseason */
    endpoint?: string;
    /** Suchwert / ID (je nach endpoint) */
    query?: string;
    /** Zweiter Wert (z.B. Saison fuer eventsround/eventsseason oder round fuer eventsround) */
    arg2?: string;
    /** Dritter Wert */
    arg3?: string;
}

export const SportsDbQueryPact = createPact<SportsDbQuery>(
    "SportsDbQueryProvider",
    { fromSourceType: "SportsDbQuery" }
);
