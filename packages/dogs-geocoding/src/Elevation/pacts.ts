import { createPact } from "@slopdogs/core";

export interface ElevationQuery {
    /** Comma-separated latitudes or single lat */
    lat: string;
    /** Comma-separated longitudes or single lng */
    lng: string;
}

export interface ElevationPoint {
    lat: number;
    lng: number;
    elevation: number;
}

export interface ElevationResult {
    points: ElevationPoint[];
}

export const ElevationQueryPact = createPact<ElevationQuery>(
    "ElevationQueryProvider",
    { fromSourceType: "ElevationQuery" }
);
