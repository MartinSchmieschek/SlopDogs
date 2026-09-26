import { createPact } from "@slopdogs/core";

export interface LemmyQuery {
    /** Fediverse-Instanz (z.B. "lemmy.world", "beehaw.org") — default "lemmy.world" */
    instance?: string;
    /** Modus: postList (Posts einer Community/Instanz), community (Community-Info),
     *  search (Volltextsuche), site (Instanz-Metadaten) — default "postList" */
    mode?: string;
    /** Community-Name (mit @ fuer fremde Instanzen, z.B. "technology@lemmy.world")
     *  — fuer postList und community */
    community?: string;
    /** Suchstring (fuer search) */
    q?: string;
    /** Sort: Active, Hot, New, Old, TopDay, TopWeek, TopMonth, TopYear, TopAll — default "Hot" */
    sort?: string;
    /** Typ: All, Local, Subscribed — default "Local" */
    type?: string;
    /** Limit — default 10, max 50 */
    limit?: number;
    /** Seite — default 1 */
    page?: number;
}

export const LemmyQueryPact = createPact<LemmyQuery>(
    "LemmyQueryProvider",
    { fromSourceType: "LemmyQuery" }
);
