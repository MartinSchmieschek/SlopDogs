/**
 * =========================================================================
 *  SPACE PACTS — orbital accords with the cosmic void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Query for space data — optional body name for solar system lookup */
export interface SpaceQuery {
    /** Optional planet/moon name for solar system body lookup */
    body?: string;
}

/** The Pact for Space queries */
export const SpaceQueryPact = createPact<SpaceQuery>(
    "SpaceQueryProvider",
    { fromSourceType: "SpaceQuery" }
);
