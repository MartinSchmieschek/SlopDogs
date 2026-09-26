/**
 * =========================================================================
 *  GEO-PACTS — eldritch contracts fuer Geo-Koordinaten
 * =========================================================================
 *
 *  Diese Pacts ersetzen die zerstreuten Hund-spezifischen
 *  Lat/Lng-Pacts. Jeder Geo-Hund verlangt einen dieser drei
 *  als required parent.
 *
 *  Mimics fuellen die Pacts: aus QueryRetriever, aus Body, aus
 *  einem anderen Hund — woher auch immer der Punkt stammen mag.
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";
import type { GeoPoint, GeoArea, GeoRoute } from "./types";

/** Pact fuer einen Geo-Punkt — Hunde, die nur Lat/Lng brauchen (Wetter, Sun, AirQuality, ...) */
export const GeoPointPact = createPact<GeoPoint>(
    "GeoPointProvider",
    { fromSourceType: "GeoPoint" }
);

/** Pact fuer eine Geo-Flaeche — Hunde, die Punkt + Radius brauchen (OSM, Wikipedia, Birds, ...) */
export const GeoAreaPact = createPact<GeoArea>(
    "GeoAreaProvider",
    { fromSourceType: "GeoArea" }
);

/** Pact fuer eine Geo-Route — Hunde, die Start/End/Waypoints brauchen (Bloodhound Routing) */
export const GeoRoutePact = createPact<GeoRoute>(
    "GeoRouteProvider",
    { fromSourceType: "GeoRoute" }
);
