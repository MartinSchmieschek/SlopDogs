import { createPact } from "@slopdogs/core";

export interface QuranQuery {
    /** Modus: ayah (einzelner Vers), surah (ganze Sure), random (zufaelliger Vers) — default "ayah" */
    mode?: string;
    /** Referenz — "2:255" fuer ayah oder "1" fuer surah */
    reference?: string;
    /** Edition: "quran-uthmani" (Arabisch), "en.sahih" (Englisch), "de.bubenheim" (Deutsch), ... — default "en.sahih" */
    edition?: string;
}

export const QuranQueryPact = createPact<QuranQuery>(
    "QuranQueryProvider",
    { fromSourceType: "QuranQuery" }
);
