/**
 * =========================================================================
 *  GEO-PACT — der einheitliche Vertrag fuer Geo-Koordinaten im Void
 * =========================================================================
 *
 *  Hier ruht der Pakt, der alle Geo-Hunde bindet:
 *  Punkt, Flaeche, Route — ein Schema fuer alle.
 *
 *  Felder heissen IMMER `lat` und `lng`. Niemals `latitude`, `longitude`,
 *  `lon`, `latlon`, `coords` oder sonstige Verwirrungen aus den
 *  geographischen Untiefen.
 * =========================================================================
 */

/** Ein Geo-Punkt: Breitengrad und Laengengrad in Dezimalgrad (WGS84). */
export interface GeoPoint {
    /** Breitengrad in Dezimalgrad (-90..90) */
    lat: number;
    /** Laengengrad in Dezimalgrad (-180..180) */
    lng: number;
}

/** Eine Geo-Flaeche: Punkt mit Suchradius in Metern. */
export interface GeoArea extends GeoPoint {
    /** Suchradius in Metern */
    radius: number;
}

/**
 * Eine Geo-Route: Start- und End-Punkt, optional mit Zwischenpunkten.
 * Die Route fuehrt von `start` ueber alle `waypoints` (in Reihenfolge) zum `end`.
 */
export interface GeoRoute {
    /** Startpunkt der Route */
    start: GeoPoint;
    /** Endpunkt der Route */
    end: GeoPoint;
    /** Optionale Zwischenpunkte in Reihenfolge */
    waypoints?: GeoPoint[];
}
