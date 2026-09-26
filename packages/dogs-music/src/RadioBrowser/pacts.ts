import { createPact } from "@slopdogs/core";

export interface RadioBrowserQuery {
    /** Mode: search (Freitext), bycountry, bylanguage, bytag — default "search" */
    mode?: string;
    /** Suchbegriff / Land / Sprache / Tag (je nach mode) */
    value?: string;
    /** Max. Ergebnisse — default 30 */
    limit?: number;
    /** Offset — default 0 */
    offset?: number;
    /** Sortier-Kriterium (z.B. clickcount, votes, name) — default "clickcount" */
    order?: string;
    /** Absteigend — default true */
    reverse?: boolean;
}

export const RadioBrowserQueryPact = createPact<RadioBrowserQuery>(
    "RadioBrowserQueryProvider",
    { fromSourceType: "RadioBrowserQuery" }
);
