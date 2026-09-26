/**
 * Cache-Infrastruktur (SQLite cache.db) darf Kennel-Runs nicht killen —
 * bei Lock/Timeout: Cache-Miss, Fetch trotzdem, optional kein Store.
 *
 * Brückenmodell: Spaeter soll eine schnelle Cache-Anbindung (Postgres o. a.) im Fokus sein;
 * dieses Wrapper ist nur Dev-Schutz, kein Ersatz fuer Cache-Tuning oder Monitoring.
 */
import type {
    ICacheHandler,
    ITileFeatureCache,
    TileCoverageResult,
    TileKey,
} from '@slopdogs/core';

export function isCacheInfraError(err: unknown): boolean {
    const code = (err as { code?: string })?.code;
    if (code === 'P1008' || code === 'P2034') return true;
    const msg = (err as Error)?.message ?? String(err);
    return /failed to respond to a query within the configured timeout|Operations timed out|SQLite busy|database is locked/i.test(
        msg,
    );
}

function warnCacheInfra(op: string, err: unknown): void {
    const msg = (err as Error)?.message ?? String(err);
    console.warn(`[cache-infra] ${op} degraded (SQLite busy/timeout): ${msg.slice(0, 160)}`);
}

async function guard<T>(op: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        if (!isCacheInfraError(err)) throw err;
        warnCacheInfra(op, err);
        return fallback;
    }
}

function allTilesMissing(tiles: TileKey[], facets: string[]): TileCoverageResult['missing'] {
    const missing: TileCoverageResult['missing'] = [];
    for (const tile of tiles) {
        for (const facet of facets) {
            missing.push({ tile, facet });
        }
    }
    return missing;
}

function wrapTileCache(inner: ITileFeatureCache): ITileFeatureCache {
    return {
        getCoveredFeatures: (dogType, tiles, facets) =>
            guard(
                'getCoveredFeatures',
                () => inner.getCoveredFeatures(dogType, tiles, facets),
                { features: [], missing: allTilesMissing(tiles, facets) },
            ),
        storeFetchResult: (dogType, result, ttlMs) =>
            guard('storeFetchResult', () => inner.storeFetchResult(dogType, result, ttlMs), undefined),
        invalidateDogType: (dogType) =>
            guard('invalidateDogType', () => inner.invalidateDogType(dogType), undefined),
    };
}

/** Kennel-Runs sollen bei cache.db-Stress weiterlaufen (Miss / kein Store). */
export function withResilientCacheInfra(handler: ICacheHandler): ICacheHandler {
    return {
        get: (key) => guard('get', () => handler.get(key), undefined),
        set: (key, value, ttlMs) => guard('set', () => handler.set(key, value, ttlMs), undefined),
        has: (key) => guard('has', () => handler.has(key), false),
        getOrFetch: async (key, ttlMs, factory) => {
            try {
                return await handler.getOrFetch(key, ttlMs, factory);
            } catch (err) {
                if (!isCacheInfraError(err)) throw err;
                warnCacheInfra('getOrFetch', err);
                return factory();
            }
        },
        invalidate: (key) => guard('invalidate', () => handler.invalidate(key), undefined),
        invalidateByPrefix: (prefix) =>
            guard('invalidateByPrefix', () => handler.invalidateByPrefix(prefix), undefined),
        prune: () => guard('prune', () => handler.prune(), undefined),
        getTileFeatureCache: () => wrapTileCache(handler.getTileFeatureCache()),
    };
}
