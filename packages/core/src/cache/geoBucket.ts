/**
 * ~~~ GEO BUCKET KEYS — cache coarsening for geographic queries ~~~
 *
 * Exact-match cache keys lose every query that differs by a single metre.
 * This helper rounds `(lat, lng, radiusM)` to a grid whose cell size scales
 * with the query radius, so neighbouring or slightly-shifted queries resolve
 * to the same cache key. Wird aktuell nur noch von Punkt-Dogs (Weather,
 * Air-Quality, GeoNames, Isochrone) genutzt; die Flaechen-Dogs greifen auf
 * den Tile-Feature-Cache zurueck.
 */

export interface GeoBucketOptions {
    /**
     * Bucket cell size, in metres. Defaults to `max(50, round(radiusM / 5))`
     * so a 1000 m query gets ~200 m cells, a 3000 m query gets ~600 m cells.
     */
    bucketM?: number;
    /** Sorted key=value fragments appended to the key — e.g. a facet set. */
    extras?: Record<string, string | number | boolean>;
}

const METRES_PER_DEG_LAT = 111_320;

/**
 * Compute the default bucket cell size (in metres) for a query radius.
 * Kept small enough that two adjacent queries with the same radius still
 * share a cell in the common case, and large enough to ignore GPS jitter.
 *
 * The result is quantised to 50 m steps so that nearby radii (e.g. 2950 m
 * and 3050 m) pick the *same* bucket size and therefore share a grid.
 * Without that quantisation each radius would produce its own slightly-
 * shifted grid and nearby queries with different radii would always miss.
 */
export function defaultGeoBucketM(radiusM: number): number {
    if (!Number.isFinite(radiusM) || radiusM <= 0) return 50;
    const raw = Math.max(50, radiusM / 5);
    return Math.max(50, Math.round(raw / 50) * 50);
}

/**
 * Snap `(lat, lng, radiusM)` to a deterministic grid and build a stable
 * cache key. The cell size scales with the radius unless `bucketM` is given.
 *
 * Example:
 *   geoBucketKey("trails", 47.3769, 8.5417, 3000, { type: "both" })
 *   → "trails:47.376700:8.539867:r3000:type=both"
 */
export function geoBucketKey(
    prefix: string,
    lat: number,
    lng: number,
    radiusM: number,
    options?: GeoBucketOptions,
): string {
    const bucketM = options?.bucketM ?? defaultGeoBucketM(radiusM);
    const bucketDegLat = bucketM / METRES_PER_DEG_LAT;
    // Snap latitude first, then derive the longitude cell from the *snapped*
    // latitude. This ensures every point inside the same lat-cell uses the
    // same longitude grid — otherwise two queries 50 m apart can drift into
    // different columns because their raw cosLat differs microscopically.
    const latSnapped = Math.round(lat / bucketDegLat) * bucketDegLat;
    const cosLat = Math.max(Math.cos((latSnapped * Math.PI) / 180), 1e-6);
    const bucketDegLng = bucketM / (METRES_PER_DEG_LAT * cosLat);
    const lngSnapped = Math.round(lng / bucketDegLng) * bucketDegLng;
    const radiusSnapped = Math.max(bucketM, Math.round(radiusM / bucketM) * bucketM);

    let key = `${prefix}:${latSnapped.toFixed(6)}:${lngSnapped.toFixed(6)}:r${radiusSnapped}`;
    if (options?.extras) {
        const entries = Object.entries(options.extras).filter(([, v]) => v !== undefined && v !== null);
        entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        for (const [k, v] of entries) key += `:${k}=${v}`;
    }
    return key;
}

/**
 * Same snapping logic as `geoBucketKey`, but returns the grid-aligned centre
 * and bucketed radius so callers can reuse them (e.g. as the area-cache store
 * coordinates). Useful when you want neighbouring queries to share an area.
 */
export function geoBucketCenter(
    lat: number,
    lng: number,
    radiusM: number,
    bucketM: number = defaultGeoBucketM(radiusM),
): { lat: number; lng: number; radiusM: number; bucketM: number } {
    const bucketDegLat = bucketM / METRES_PER_DEG_LAT;
    const latSnapped = Math.round(lat / bucketDegLat) * bucketDegLat;
    const cosLat = Math.max(Math.cos((latSnapped * Math.PI) / 180), 1e-6);
    const bucketDegLng = bucketM / (METRES_PER_DEG_LAT * cosLat);
    return {
        lat: latSnapped,
        lng: Math.round(lng / bucketDegLng) * bucketDegLng,
        radiusM: Math.max(bucketM, Math.round(radiusM / bucketM) * bucketM),
        bucketM,
    };
}
