import { createPact } from "@slopdogs/core";

export interface AstronomyQuery {
    lat: string;
    lng: string;
    date?: string;
}

export const AstronomyQueryPact = createPact<AstronomyQuery>(
    "AstronomyQueryProvider",
    { fromSourceType: "AstronomyQuery" }
);
