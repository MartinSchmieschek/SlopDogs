import { createPact } from "@slopdogs/core";

export interface NpmQuery {
    /** Paketname (e.g. "react", "@angular/core") */
    package: string;
    /** Modus: meta (package.json), downloads (letzte Woche), or both — default "both" */
    mode?: string;
    /** Zeitraum fuer downloads: last-day, last-week, last-month, last-year — default "last-week" */
    period?: string;
}

export const NpmQueryPact = createPact<NpmQuery>(
    "NpmQueryProvider",
    { fromSourceType: "NpmQuery" }
);
