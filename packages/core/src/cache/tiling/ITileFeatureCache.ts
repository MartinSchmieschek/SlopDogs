/**
 * ~~~ THE TILE FEATURE CACHE PACT ~~~
 *
 * Ein atomar wachsender Geo-Feature-Store:
 *  - Features werden per (dogType, osmType, osmId) dedupliziert.
 *  - Tile-Coverage ist pro (zoom, tile, facet) getrennt — partielle Queries
 *    sind sinnvoll cache-bar.
 *  - Ein Feature kann in mehreren Tiles (seine BBox) und mehreren Facets
 *    (Tag-Overlap) gleichzeitig referenziert sein.
 *
 * Die Dogs fragen: "welche Tiles x Facets habe ich noch nicht?" und laden
 * nur das Delta per begrenzter Overpass-Query nach.
 */

import type { TileKey } from './tilingMath';

/** Ein atomares Geo-Feature, wie es im Store liegt. */
export interface StoredGeoFeature {
    dogType: string;
    osmType: 'node' | 'way' | 'relation' | string;
    osmId: string; // BigInt als String — JSON/JS-sicher
    primaryKey: string | null;
    primaryValue: string | null;
    name: string | null;
    hasGeom: boolean;
    lat: number | null;
    lng: number | null;
    bboxMinLat: number | null;
    bboxMinLng: number | null;
    bboxMaxLat: number | null;
    bboxMaxLng: number | null;
    /** Das volle Overpass-Element — Caller parst bei Bedarf. */
    payload: string;
    updatedAt: number;
}

/** Ergebnis eines Coverage-Checks: was ist da, was fehlt. */
export interface TileCoverageResult {
    /** Features die bereits im Cache sind und zu angefragten (tile, facet) gehoeren. */
    features: StoredGeoFeature[];
    /** Fehlende (tile, facet)-Kombinationen die der Dog nachfetchen muss. */
    missing: Array<{ tile: TileKey; facet: string }>;
}

/** Ein einzelnes zu speicherndes Feature nach einem Fetch. */
export interface FeatureUpsert {
    osmType: 'node' | 'way' | 'relation' | string;
    osmId: string;
    primaryKey: string | null;
    primaryValue: string | null;
    name: string | null;
    hasGeom: boolean;
    lat: number | null;
    lng: number | null;
    bboxMinLat: number | null;
    bboxMinLng: number | null;
    bboxMaxLat: number | null;
    bboxMaxLng: number | null;
    payload: string;
    /** An welche Facet(s) innerhalb dieses Dog-Types matcht dieses Feature? */
    facets: string[];
}

/** Ergebnis eines Fetches pro (tile, facet-Menge). */
export interface TileFetchResult {
    tile: TileKey;
    /**
     * Welche Facets wurden mit diesem Fetch abgedeckt.
     * Auch Facets mit 0 matchenden Features eintragen — das ist Negative-Cache.
     */
    facets: string[];
    /** Features aus der Overpass-Antwort, vorklassifiziert nach Facet(s). */
    features: FeatureUpsert[];
}

/** Dog opts in: bekommt beim KennelRun-Start einen Tile-Cache injiziert. */
export interface ITileCacheable {
    setTileFeatureCache(cache: ITileFeatureCache): void;
}

export function isTileCacheable(dog: unknown): dog is ITileCacheable {
    return typeof (dog as { setTileFeatureCache?: unknown })
        ?.setTileFeatureCache === 'function';
}

export interface ITileFeatureCache {
    /**
     * Liefert cached Features fuer die angefragten (tile, facet) und gibt die
     * fehlenden Kombinationen zurueck. In-flight dedup pro (dogType, zoom, tile, facet)
     * damit parallele Queries keine doppelten Overpass-Calls ausloesen.
     */
    getCoveredFeatures(
        dogType: string,
        tiles: TileKey[],
        facets: string[],
    ): Promise<TileCoverageResult>;

    /**
     * Schreibt das Ergebnis eines Overpass-Fetches:
     *  - Upsert GeoFeature per (dogType, osmType, osmId).
     *  - Fuer jede Feature-BBox: Membership in alle geschnittenen Tiles auf diesem Zoom.
     *  - Coverage-Row pro (tile, facet) — auch bei 0 Features.
     */
    storeFetchResult(
        dogType: string,
        result: TileFetchResult,
        ttlMs: number,
    ): Promise<void>;

    /** Explizite Invalidation (z.B. Debug/Admin). */
    invalidateDogType(dogType: string): Promise<void>;
}
