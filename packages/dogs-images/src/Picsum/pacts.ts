import { createPact } from "@slopdogs/core";

export interface PicsumQuery {
    /** Modus: list (JSON-Metadaten), info (zu einer ID), randomUrl (direkte Bild-URL) — default "list" */
    mode?: string;
    /** Breite fuer randomUrl — default 400 */
    width?: number;
    /** Hoehe fuer randomUrl — default 300 */
    height?: number;
    /** Seed fuer reproduzierbares randomUrl — optional */
    seed?: string;
    /** Bild-ID fuer mode=info — optional */
    id?: string;
    /** Seite (list) — default 1 */
    page?: number;
    /** Limit (list) — default 30 */
    limit?: number;
    /** Graustufen-Modus (randomUrl) — default false */
    grayscale?: boolean;
    /** Blur 1-10 (randomUrl) — optional */
    blur?: number;
}

export const PicsumQueryPact = createPact<PicsumQuery>(
    "PicsumQueryProvider",
    { fromSourceType: "PicsumQuery" }
);
