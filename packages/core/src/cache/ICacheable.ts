/**
 * ~~~ THE CACHEABLE PACT ~~~
 *
 * Arr, any hound that wishes to remember its plunder across voyages
 * must implement this pact. The KennelRun checks each dog --
 * those bearing the setCacheHandler brand receive the cache handler,
 * all others sail on unchanged.
 */

import { ICacheHandler } from './ICacheHandler';

/** A dog that opts into caching by accepting a cache handler. */
export interface ICacheable {
    setCacheHandler(handler: ICacheHandler): void;
}

/** Type-guard: checks if a dog implements ICacheable. */
export function isCacheable(dog: unknown): dog is ICacheable {
    return typeof (dog as any)?.setCacheHandler === 'function';
}
