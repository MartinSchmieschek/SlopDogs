/**
 * =========================================================================
 *  IP GEO PACTS — eldritch accords with the network-void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** Optionale IP-Adresse fuer die Geolocation-Abfrage */
export interface IPGeoQuery {
    /** IP-Adresse — leer lassen fuer automatische Erkennung */
    ip?: string;
}

/** Der Pact fuer IPGeo-Queries */
export const IPGeoQueryPact = createPact<IPGeoQuery>(
    "IPGeoQueryProvider",
    { fromSourceType: "IPGeoQuery" }
);
