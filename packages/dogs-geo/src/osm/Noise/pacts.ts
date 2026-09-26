import { createPact } from "@slopdogs/core";

export interface NoiseQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const NoiseQueryPact = createPact<NoiseQuery>(
    "NoiseQueryProvider",
    { fromSourceType: "NoiseQuery" }
);
