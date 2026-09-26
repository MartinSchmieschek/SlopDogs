import { createPact } from "@slopdogs/core";

export interface StackExchangeQuery {
    /** Stack-Exchange-Site (stackoverflow, superuser, serverfault, askubuntu, ...) — default "stackoverflow" */
    site?: string;
    /** Endpoint: questions (Top-Fragen), search (Volltext), tags (beliebteste Tags) — default "questions" */
    endpoint?: string;
    /** Suchbegriff (nur fuer endpoint=search) */
    q?: string;
    /** Tag-Filter — komma-separiert */
    tagged?: string;
    /** Sortierung: hot, activity, creation, votes — default "hot" */
    sort?: string;
    /** Anzahl — default 30 */
    pagesize?: number;
    /** Seite — default 1 */
    page?: number;
}

export const StackExchangeQueryPact = createPact<StackExchangeQuery>(
    "StackExchangeQueryProvider",
    { fromSourceType: "StackExchangeQuery" }
);
