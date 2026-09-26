/**
 * ~~~ FILTER IN RADIUS ~~~
 *
 * Geometrie-bewusster Radius-Filter fuer gecachte Features.
 * Polygone/Linien, die den Query-Punkt ueberlappen ohne einen Punkt im Radius
 * zu haben, bleiben erhalten (pointInPolygon-Check).
 *
 * Punktloser Fall: Features ohne Geometrie werden immer durchgelassen —
 * der Caller hat sie ueber Tile-Membership bereits geografisch vorselektiert.
 */

import {
    bboxIntersectsCircle,
    haversineDistanceM,
    type TileBBox,
} from './tilingMath';

export interface GeomFeatureLike {
    osmType: 'node' | 'way' | 'relation' | string;
    hasGeom: boolean;
    lat?: number | null;
    lng?: number | null;
    bboxMinLat?: number | null;
    bboxMinLng?: number | null;
    bboxMaxLat?: number | null;
    bboxMaxLng?: number | null;
    /** Roher geometrischer Punkt-Array im Feature (optional, fuer Exakt-Check). */
    geometry?: Array<{ lat: number; lng: number }> | null;
}

export function featureInRadius(
    feature: GeomFeatureLike,
    queryCenter: { lat: number; lng: number },
    queryRadiusM: number,
): boolean {
    // Features ohne ableitbare Geometrie: vertraue der Tile-Membership.
    if (!feature.hasGeom) return true;

    // Node → klassischer Distance-Check.
    if (feature.osmType === 'node') {
        if (feature.lat == null || feature.lng == null) return true;
        return haversineDistanceM(queryCenter, {
            lat: feature.lat,
            lng: feature.lng,
        }) <= queryRadiusM;
    }

    // Way/Relation mit BBox → erst BBox-Circle-Intersect.
    if (
        feature.bboxMinLat != null &&
        feature.bboxMinLng != null &&
        feature.bboxMaxLat != null &&
        feature.bboxMaxLng != null
    ) {
        const bbox: TileBBox = {
            minLat: feature.bboxMinLat,
            minLng: feature.bboxMinLng,
            maxLat: feature.bboxMaxLat,
            maxLng: feature.bboxMaxLng,
        };
        if (!bboxIntersectsCircle(bbox, queryCenter, queryRadiusM)) {
            return false;
        }
        // Exakter Pfad: ein Geometry-Point im Radius ODER Query-Center im Polygon.
        if (feature.geometry && feature.geometry.length > 0) {
            for (const p of feature.geometry) {
                if (haversineDistanceM(queryCenter, p) <= queryRadiusM) return true;
            }
            if (isPolygonal(feature) && pointInPolygon(queryCenter, feature.geometry)) {
                return true;
            }
            return false;
        }
        return true; // BBox trifft, keine detaillierte Geometrie verfuegbar
    }

    // BBox fehlt aber repraesentativer Punkt existiert.
    if (feature.lat != null && feature.lng != null) {
        return haversineDistanceM(queryCenter, {
            lat: feature.lat,
            lng: feature.lng,
        }) <= queryRadiusM;
    }

    return true;
}

function isPolygonal(feature: GeomFeatureLike): boolean {
    if (!feature.geometry || feature.geometry.length < 3) return false;
    const first = feature.geometry[0];
    const last = feature.geometry[feature.geometry.length - 1];
    return first.lat === last.lat && first.lng === last.lng;
}

/** Standard ray-casting point-in-polygon. Polygon als [lat,lng]-Ring. */
function pointInPolygon(
    point: { lat: number; lng: number },
    ring: Array<{ lat: number; lng: number }>,
): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].lng;
        const yi = ring[i].lat;
        const xj = ring[j].lng;
        const yj = ring[j].lat;
        const intersect =
            yi > point.lat !== yj > point.lat &&
            point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}
