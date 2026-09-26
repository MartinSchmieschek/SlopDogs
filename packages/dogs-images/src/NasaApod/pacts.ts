import { createPact } from "@slopdogs/core";

export interface NasaApodQuery {
    /** Datum YYYY-MM-DD (default: heute) */
    date?: string;
    /** HD-Bild verwenden — default false */
    hd?: boolean;
}

export const NasaApodQueryPact = createPact<NasaApodQuery>(
    "NasaApodQueryProvider",
    { fromSourceType: "NasaApodQuery" }
);
