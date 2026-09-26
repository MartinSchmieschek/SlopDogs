/**
 * ~~~ TILING MATH ~~~
 *
 * Slippy-Map-Tiles (Web-Mercator) mit Multi-Zoom-Wahl je Query-Radius.
 * Nur reine Funktionen — keine DB, kein Netzwerk.
 *
 * Zoom-Buckets bestimmen deterministisch den Zoom fuer einen Radius, damit
 * identische Queries immer dieselben Tiles treffen. Dadurch wird Cache-Hit
 * berechenbar statt vom exakten Radius abhaengig.
 */

/** Geographischer BBox. */
export interface TileBBox {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
}

/** Tile-Koordinate auf einem Zoom-Level. */
export interface TileKey {
    zoom: number;
    x: number;
    y: number;
}

/**
 * Radius → Zoom-Bucket. Ziel: pro Query wenige Tiles (typisch 2×2 bis 4×4).
 * Deterministische Staffelung, identische Radien treffen identische Zooms.
 *
 * r ≤ 500 m  → z=16 (~300 m/Tile)
 * r ≤ 2 km   → z=14 (~1.2 km/Tile)
 * r ≤ 10 km  → z=12 (~5 km/Tile)
 * r ≤ 50 km  → z=10 (~20 km/Tile)
 * r > 50 km  → z=8  (~80 km/Tile)
 */
export function pickZoomForRadius(radiusM: number): number {
    if (radiusM <= 500) return 16;
    if (radiusM <= 2_000) return 14;
    if (radiusM <= 10_000) return 12;
    if (radiusM <= 50_000) return 10;
    return 8;
}

/** Slippy-Map-Konvertierung lon/lat → Tile auf festem Zoom. */
export function lonLatToTile(lat: number, lng: number, zoom: number): TileKey {
    const n = 1 << zoom;
    const latRad = (lat * Math.PI) / 180;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    );
    const max = n - 1;
    return {
        zoom,
        x: Math.min(Math.max(x, 0), max),
        y: Math.min(Math.max(y, 0), max),
    };
}

/** Umkehrung: Tile-Koordinate → north-west Ecke (lon/lat). */
function tileNW(tile: TileKey): { lat: number; lng: number } {
    const n = 1 << tile.zoom;
    const lng = (tile.x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tile.y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return { lat, lng };
}

/** Liefert die geographische BBox einer Tile. */
export function tileBBox(tile: TileKey): TileBBox {
    const nw = tileNW(tile);
    const se = tileNW({ zoom: tile.zoom, x: tile.x + 1, y: tile.y + 1 });
    return {
        minLat: se.lat,
        maxLat: nw.lat,
        minLng: nw.lng,
        maxLng: se.lng,
    };
}

/**
 * Konservative BBox um einen Circle (center, radiusM).
 * Ueber- statt unterschaetzend, damit alle beruehrten Tiles gefunden werden.
 */
export function circleBBox(lat: number, lng: number, radiusM: number): TileBBox {
    const metrePerDegLat = 111_320;
    const dLat = radiusM / metrePerDegLat;
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
    const dLng = radiusM / (metrePerDegLat * cosLat);
    return {
        minLat: lat - dLat,
        maxLat: lat + dLat,
        minLng: lng - dLng,
        maxLng: lng + dLng,
    };
}

/** Alle Tiles auf einem Zoom, deren BBox den BBox schneidet oder enthaelt. */
export function tilesIntersectingBBox(bbox: TileBBox, zoom: number): TileKey[] {
    const nw = lonLatToTile(bbox.maxLat, bbox.minLng, zoom);
    const se = lonLatToTile(bbox.minLat, bbox.maxLng, zoom);
    const tiles: TileKey[] = [];
    const n = 1 << zoom;
    const max = n - 1;
    const xStart = Math.min(nw.x, se.x);
    const xEnd = Math.max(nw.x, se.x);
    const yStart = Math.min(nw.y, se.y);
    const yEnd = Math.max(nw.y, se.y);
    for (let x = xStart; x <= xEnd; x++) {
        for (let y = yStart; y <= yEnd; y++) {
            if (x < 0 || x > max || y < 0 || y > max) continue;
            tiles.push({ zoom, x, y });
        }
    }
    return tiles;
}

/** Alle Tiles, deren BBox den Query-Circle schneidet. */
export function tilesTouching(
    lat: number,
    lng: number,
    radiusM: number,
    zoom: number,
): TileKey[] {
    return tilesIntersectingBBox(circleBBox(lat, lng, radiusM), zoom);
}

/** Stringifizieren fuer Map-Keys. */
export function tileKeyString(tile: TileKey): string {
    return `${tile.zoom}/${tile.x}/${tile.y}`;
}

/** BBox-Intersect-Test (axis-aligned). */
export function bboxIntersects(a: TileBBox, b: TileBBox): boolean {
    return !(
        a.maxLat < b.minLat ||
        a.minLat > b.maxLat ||
        a.maxLng < b.minLng ||
        a.minLng > b.maxLng
    );
}

/**
 * Exakter Check: schneidet die feature-BBox den Query-Circle?
 * Approximation: zuerst BBox-zu-BBox, dann naechstgelegener Punkt der BBox
 * zum Circle-Center per Haversine.
 */
export function bboxIntersectsCircle(
    bbox: TileBBox,
    center: { lat: number; lng: number },
    radiusM: number,
): boolean {
    if (!bboxIntersects(bbox, circleBBox(center.lat, center.lng, radiusM))) {
        return false;
    }
    const nearestLat = clamp(center.lat, bbox.minLat, bbox.maxLat);
    const nearestLng = clamp(center.lng, bbox.minLng, bbox.maxLng);
    return haversineDistanceM(center, { lat: nearestLat, lng: nearestLng }) <= radiusM;
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

export function haversineDistanceM(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
): number {
    const R = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
        sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}
