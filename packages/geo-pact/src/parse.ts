/**
 * =========================================================================
 *  GEO-PARSE — String-zu-GeoPunkt-Wandler aus dem Query-Void
 * =========================================================================
 *
 *  HTTP-Querystrings liefern alles als string. Diese Helfer wandeln
 *  rohe Records in starke GeoPoint/GeoArea/GeoRoute-Objekte —
 *  und werfen, wenn die Koordinaten nicht aus der Tiefe lesbar sind.
 * =========================================================================
 */

import type { GeoPoint, GeoArea, GeoRoute } from "./types";

const toNum = (v: unknown, field: string): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    if (!isFinite(n)) {
        throw new Error(`Geo: Feld '${field}' ist keine gueltige Zahl (got: ${JSON.stringify(v)})`);
    }
    return n;
};

const toOptNum = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isFinite(n) ? n : undefined;
};

/** Liest `lat` und `lng` aus einem Record. Wirft, wenn ungueltig. */
export function parseGeoPoint(src: Record<string, unknown>): GeoPoint {
    return {
        lat: toNum(src["lat"], "lat"),
        lng: toNum(src["lng"], "lng"),
    };
}

/**
 * Liest `lat`, `lng`, `radius` aus einem Record. Wirft, wenn lat/lng ungueltig sind.
 * `radius` faellt auf `defaultRadius` zurueck (default 1000m), wenn nicht gesetzt.
 */
export function parseGeoArea(src: Record<string, unknown>, defaultRadius: number = 1000): GeoArea {
    const point = parseGeoPoint(src);
    const radius = toOptNum(src["radius"]) ?? defaultRadius;
    return { ...point, radius };
}

/**
 * Liest eine Route aus einem Record. Erwartet entweder:
 *  - `start.lat`, `start.lng`, `end.lat`, `end.lng` (verschachteltes Objekt — wenn src eine GeoRoute ist), oder
 *  - flache Felder `startlat`, `startlng`, `endlat`, `endlng` (Backward-Compat fuer Querystrings)
 * Optionale Waypoints als Array unter `waypoints` (jeweils mit `lat`/`lng`).
 */
export function parseGeoRoute(src: Record<string, unknown>): GeoRoute {
    const startObj = src["start"];
    const endObj = src["end"];

    const start: GeoPoint =
        startObj && typeof startObj === "object"
            ? parseGeoPoint(startObj as Record<string, unknown>)
            : {
                  lat: toNum(src["startlat"], "startlat"),
                  lng: toNum(src["startlng"], "startlng"),
              };

    const end: GeoPoint =
        endObj && typeof endObj === "object"
            ? parseGeoPoint(endObj as Record<string, unknown>)
            : {
                  lat: toNum(src["endlat"], "endlat"),
                  lng: toNum(src["endlng"], "endlng"),
              };

    const waypointsRaw = src["waypoints"];
    const waypoints: GeoPoint[] | undefined = Array.isArray(waypointsRaw)
        ? waypointsRaw.map((wp, i) => {
              if (!wp || typeof wp !== "object") {
                  throw new Error(`Geo: waypoints[${i}] ist kein Objekt`);
              }
              return parseGeoPoint(wp as Record<string, unknown>);
          })
        : undefined;

    return waypoints ? { start, end, waypoints } : { start, end };
}
