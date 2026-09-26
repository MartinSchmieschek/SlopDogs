import { createPact } from "@slopdogs/core";

export interface ParkingQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const ParkingQueryPact = createPact<ParkingQuery>(
    "ParkingQueryProvider",
    { fromSourceType: "ParkingQuery" }
);
