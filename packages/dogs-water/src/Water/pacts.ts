/**
 * =========================================================================
 *  WATER PACTS — maritime accords with the coastal void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS coordinates for marine/water query */
export interface WaterQuery {
    /** Latitude */
    lat: string;
    /** Longitude */
    lng: string;
}

/** The Pact for Water queries */
export const WaterQueryPact = createPact<WaterQuery>(
    "WaterQueryProvider",
    { fromSourceType: "WaterQuery" }
);
