import { createPact } from "@slopdogs/core";

export interface WaybackQuery {
    /** Ziel-URL */
    url: string;
    /** Zeitstempel fuer gewuenschte Version (YYYYMMDDhhmmss-Praefix, z.B. "20050101") — optional, sonst neueste */
    timestamp?: string;
}

export const WaybackQueryPact = createPact<WaybackQuery>(
    "WaybackQueryProvider",
    { fromSourceType: "WaybackQuery" }
);
