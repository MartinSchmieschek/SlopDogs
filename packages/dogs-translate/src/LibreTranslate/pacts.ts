import { createPact } from "@slopdogs/core";

export interface LibreTranslateQuery {
    /** Zu uebersetzender Text */
    text: string;
    /** Quellsprache (ISO-2, z.B. "en", "de") oder "auto" — default "auto" */
    source?: string;
    /** Zielsprache (ISO-2) — default "en" */
    target?: string;
}

export const LibreTranslateQueryPact = createPact<LibreTranslateQuery>(
    "LibreTranslateQueryProvider",
    { fromSourceType: "LibreTranslateQuery" }
);
