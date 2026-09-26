import { createPact } from "@slopdogs/core";

/** Abfrage fuer chucknorris.io */
export interface ChuckNorrisQuery {
    /** Kategorie (animal, career, celebrity, dev, ...) — optional */
    category?: string;
}

export const ChuckNorrisQueryPact = createPact<ChuckNorrisQuery>(
    "ChuckNorrisQueryProvider",
    { fromSourceType: "ChuckNorrisQuery" }
);
