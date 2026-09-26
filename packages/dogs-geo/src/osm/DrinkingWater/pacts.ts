import { createPact } from "@slopdogs/core";

export interface DrinkingWaterQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const DrinkingWaterQueryPact = createPact<DrinkingWaterQuery>(
    "DrinkingWaterQueryProvider",
    { fromSourceType: "DrinkingWaterQuery" }
);
