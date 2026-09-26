/**
 * Geometry-Helper fuer OSM-Geometry-Hunde:
 *   - simplifyFeatureCollection(fc, toleranceM) — Douglas-Peucker auf alle
 *     Linien/Polygon-Ringe. Tolerance in Metern; intern in Grad umgerechnet
 *     auf Basis der Result-Latitude (gut genug fuer lokale Radien).
 *   - mergeFeatureCollection(fc) — echte topologische Union benachbarter
 *     Polygone via `polygon-clipping`. Punkte/Linien werden unveraendert
 *     durchgereicht; Polygone werden zu einem oder mehreren MultiPolygon
 *     zusammengefasst.
 *
 * Helper hangen am Result-Objekt (siehe attachGeometryHelpers). Sie sind
 * non-mutating: jeder Aufruf liefert ein neues Result mit transformiertem
 * GeoJSON, das selbst wieder die Helper traegt.
 */

import type {
    Feature,
    FeatureCollection,
    GeometryObject,
    LineString,
    MultiLineString,
    Polygon,
    MultiPolygon,
    Position,
} from "geojson";
import polygonClipping, { type Geom as PCGeom, type MultiPolygon as PCMultiPolygon } from "polygon-clipping";

const M_PER_DEG_LAT = 111320;

function metersToDegreesAt(latitude: number, meters: number): number {
    const cosLat = Math.max(Math.cos((latitude * Math.PI) / 180), 1e-6);
    const dLat = meters / M_PER_DEG_LAT;
    const dLng = meters / (M_PER_DEG_LAT * cosLat);
    return Math.min(dLat, dLng);
}

function perpendicularDistanceSq(p: Position, a: Position, b: Position): number {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
        const ex = px - ax;
        const ey = py - ay;
        return ex * ex + ey * ey;
    }
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    const tt = Math.max(0, Math.min(1, t));
    const cx = ax + tt * dx;
    const cy = ay + tt * dy;
    const ex = px - cx;
    const ey = py - cy;
    return ex * ex + ey * ey;
}

function douglasPeucker(points: Position[], toleranceDeg: number): Position[] {
    if (points.length < 3) return points.slice();
    const tolSq = toleranceDeg * toleranceDeg;
    const keep = new Array<boolean>(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;

    const stack: Array<[number, number]> = [[0, points.length - 1]];
    while (stack.length > 0) {
        const [lo, hi] = stack.pop()!;
        let maxDistSq = 0;
        let idx = -1;
        for (let i = lo + 1; i < hi; i++) {
            const d = perpendicularDistanceSq(points[i], points[lo], points[hi]);
            if (d > maxDistSq) {
                maxDistSq = d;
                idx = i;
            }
        }
        if (idx !== -1 && maxDistSq > tolSq) {
            keep[idx] = true;
            stack.push([lo, idx]);
            stack.push([idx, hi]);
        }
    }

    const out: Position[] = [];
    for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
    return out;
}

function simplifyRing(ring: Position[], toleranceDeg: number): Position[] {
    if (ring.length < 4) return ring.slice();
    // Ring schliesst sich; DP auf offenen Pfad, dann schliessen.
    const open = ring.slice(0, ring.length - 1);
    const simplified = douglasPeucker(open, toleranceDeg);
    if (simplified.length < 3) return ring.slice();
    simplified.push(simplified[0]);
    return simplified;
}

function simplifyGeometry(geom: GeometryObject, toleranceDeg: number): GeometryObject {
    switch (geom.type) {
        case "LineString": {
            const g = geom as LineString;
            return { type: "LineString", coordinates: douglasPeucker(g.coordinates, toleranceDeg) };
        }
        case "MultiLineString": {
            const g = geom as MultiLineString;
            return {
                type: "MultiLineString",
                coordinates: g.coordinates.map((line) => douglasPeucker(line, toleranceDeg)),
            };
        }
        case "Polygon": {
            const g = geom as Polygon;
            return {
                type: "Polygon",
                coordinates: g.coordinates.map((ring) => simplifyRing(ring, toleranceDeg)),
            };
        }
        case "MultiPolygon": {
            const g = geom as MultiPolygon;
            return {
                type: "MultiPolygon",
                coordinates: g.coordinates.map((poly) =>
                    poly.map((ring) => simplifyRing(ring, toleranceDeg)),
                ),
            };
        }
        default:
            return geom;
    }
}

export function simplifyFeatureCollection(
    fc: FeatureCollection<GeometryObject>,
    toleranceM: number,
    referenceLat: number,
): FeatureCollection<GeometryObject> {
    if (toleranceM <= 0) return fc;
    const tolDeg = metersToDegreesAt(referenceLat, toleranceM);
    const features: Feature<GeometryObject>[] = fc.features.map((f) => ({
        ...f,
        geometry: simplifyGeometry(f.geometry, tolDeg),
    }));
    return { type: "FeatureCollection", features };
}

function isPolygonGeom(geom: GeometryObject): geom is Polygon | MultiPolygon {
    return geom.type === "Polygon" || geom.type === "MultiPolygon";
}

function geomToPolygonClipping(geom: Polygon | MultiPolygon): PCGeom {
    if (geom.type === "Polygon") return geom.coordinates as PCGeom;
    return geom.coordinates as PCGeom;
}

export function mergeFeatureCollection(
    fc: FeatureCollection<GeometryObject>,
): FeatureCollection<GeometryObject> {
    const polygons: Array<Polygon | MultiPolygon> = [];
    const passthrough: Feature<GeometryObject>[] = [];
    for (const f of fc.features) {
        if (isPolygonGeom(f.geometry)) {
            polygons.push(f.geometry);
        } else {
            passthrough.push(f);
        }
    }
    if (polygons.length === 0) {
        return { type: "FeatureCollection", features: passthrough };
    }

    const [first, ...rest] = polygons.map(geomToPolygonClipping);
    const unioned: PCMultiPolygon = polygonClipping.union(first, ...rest);

    const merged: Feature<MultiPolygon> = {
        type: "Feature",
        properties: { merged: true, sourceCount: polygons.length },
        geometry: { type: "MultiPolygon", coordinates: unioned as Position[][][] },
    };

    return { type: "FeatureCollection", features: [merged, ...passthrough] };
}

/** Result-Shape, das einen `geojson`-FeatureCollection-Slot und ein `center` traegt. */
export interface GeometryResultBase {
    center: { lat: number; lng: number };
    geojson: FeatureCollection<GeometryObject>;
}

/** Methoden, die ein Geometry-Result an seine Consumer ausliefert. */
export interface GeometryResultHelpers<T extends GeometryResultBase> {
    /** Vereinfacht alle Linien/Polygone via Douglas-Peucker. Tolerance in Metern. */
    simplify(toleranceM: number): T;
    /** Vereint alle Polygone topologisch. Punkte/Linien bleiben unangetastet. */
    merge(): T;
}

/**
 * Haengt non-mutating Helper an ein Geometry-Result. Jeder Aufruf liefert
 * eine neue Result-Instanz, die wieder dieselben Helper traegt — Chaining
 * ist also moeglich: `result.simplify(2).merge()`.
 */
export function attachGeometryHelpers<T extends GeometryResultBase>(
    result: T,
): T & GeometryResultHelpers<T> {
    const wrapped = result as T & GeometryResultHelpers<T>;
    wrapped.simplify = (toleranceM: number): T => {
        const next: T = {
            ...result,
            geojson: simplifyFeatureCollection(result.geojson, toleranceM, result.center.lat),
        };
        return attachGeometryHelpers(next);
    };
    wrapped.merge = (): T => {
        const next: T = {
            ...result,
            geojson: mergeFeatureCollection(result.geojson),
        };
        return attachGeometryHelpers(next);
    };
    return wrapped;
}
