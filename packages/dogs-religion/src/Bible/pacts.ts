import { createPact } from "@slopdogs/core";

export interface BibleQuery {
    /** Referenz im bible-api-Format: "John 3:16" oder "john 3:16-17" */
    reference: string;
    /** Uebersetzungs-Kuerzel (kjv, web, bbe, oeb-cw, ...) — default "web" */
    translation?: string;
}

export const BibleQueryPact = createPact<BibleQuery>(
    "BibleQueryProvider",
    { fromSourceType: "BibleQuery" }
);
