import { createPact } from "@slopdogs/core";

export interface F1Query {
    /** Saison: 4-stellig oder "current" — default "current" */
    season?: string;
    /** Round: Nummer oder "last" — optional */
    round?: string;
    /** Ressource: races, results, qualifying, driverStandings, constructorStandings, drivers, constructors — default "races" */
    resource?: string;
    /** Max. Ergebnisse — default 30 */
    limit?: number;
    /** Offset — default 0 */
    offset?: number;
}

export const F1QueryPact = createPact<F1Query>(
    "F1QueryProvider",
    { fromSourceType: "F1Query" }
);
