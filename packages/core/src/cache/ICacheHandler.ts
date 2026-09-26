/**
 * ~~~ THE CACHE HANDLER PACT ~~~
 *
 * Arr, this contract binds any soul that dares to remember
 * what the void has already whispered. A cache be nothing
 * but a hound's memory of plunder already seized --
 * why sail the same cursed waters twice?
 *
 * The getOrFetch method be the dark heart of this pact:
 * it deduplicates in-flight requests so no two hounds
 * chase the same quarry at once.
 *
 * Fuer geografische Flaechendaten bitte den Tile-Feature-Cache verwenden
 * (siehe ITileFeatureCache) — der klassische Key-Value-Cache hier bleibt
 * fuer Punkt-Daten (Wetter, Air-Quality, GeoNames, Isochrone).
 */

import type { ITileFeatureCache } from './tiling/ITileFeatureCache';

export interface ICacheHandler {
    /** Retrieve a cached value, or undefined if not present or expired. */
    get<T>(key: string): Promise<T | undefined>;

    /** Store a value under a key with a TTL in milliseconds. */
    set<T>(key: string, value: T, ttlMs: number): Promise<void>;

    /** Check if a non-expired entry exists for this key. */
    has(key: string): Promise<boolean>;

    /**
     * The dark heart of the cache:
     * 1. Cache-Hit --> return immediately
     * 2. In-flight request with same key --> share its Promise (dedup!)
     * 3. No cache --> execute factory(), cache result, share Promise
     *
     * Errors werden kurz negativ gecached (siehe Implementierung), damit
     * Provider nicht ueberrannt werden wenn sie gerade 429/504 liefern.
     */
    getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;

    /** Remove a specific cache entry. */
    invalidate(key: string): Promise<void>;

    /** Remove all entries whose keys start with a given prefix. */
    invalidateByPrefix(prefix: string): Promise<void>;

    /** Purge all expired entries. */
    prune(): Promise<void>;

    /** Shared tile-basierter Geo-Feature-Cache — atomarer Feature-Pool. */
    getTileFeatureCache(): ITileFeatureCache;
}
