/**
 * ~~~ THE TALLY ON THE CACHE ~~~
 *
 * Arr, a thin skin over the shared cache handler -- one per hound. It changes nothing
 * about what the cache does; it only notes whether the hound's getOrFetch had to sail out
 * (the factory ran: a miss) or came back without a voyage (a hit, an in-flight share,
 * or a briefly cached failure). The count lands on the hound as `__cacheStats`, where
 * SeasonRunner.letOut() reads it for its DogRunReport (P4b).
 *
 * Kein has()-Vorabruf, keine zweite Leserunde. Der Tile-Feature-Cache bleibt ungezaehlt:
 * er ist tile-granular, ein Hit/Miss je Dog waere dort gelogen.
 */

import type { ICacheHandler } from './ICacheHandler';

/** Die Zaehlung am Hund — letOut() setzt sie vor jedem Lauf auf 0/0. */
export interface DogCacheStats {
    hits: number;
    misses: number;
}

/** Liest (und legt bei Bedarf an) die Zaehlung eines Hundes. */
export function dogCacheStatsOf(dog: object): DogCacheStats {
    const holder = dog as { __cacheStats?: DogCacheStats };
    if (!holder.__cacheStats) holder.__cacheStats = { hits: 0, misses: 0 };
    return holder.__cacheStats;
}

export function withDogCacheStats(inner: ICacheHandler, dog: object): ICacheHandler {
    return {
        get: (key) => inner.get(key),
        set: (key, value, ttlMs) => inner.set(key, value, ttlMs),
        has: (key) => inner.has(key),
        invalidate: (key) => inner.invalidate(key),
        invalidateByPrefix: (prefix) => inner.invalidateByPrefix(prefix),
        prune: () => inner.prune(),
        getTileFeatureCache: () => inner.getTileFeatureCache(),
        getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
            let fetched = false;
            const pending = inner.getOrFetch<T>(key, ttlMs, () => {
                fetched = true;
                return factory();
            });
            // finally laesst Wert und Ablehnung unveraendert durch — gezaehlt wird nach der Aufloesung.
            return pending.finally(() => {
                const stats = dogCacheStatsOf(dog);
                if (fetched) stats.misses += 1;
                else stats.hits += 1;
            });
        },
    };
}
