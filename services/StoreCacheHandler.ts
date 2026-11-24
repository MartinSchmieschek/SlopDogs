/**
 * ~~~ STORE CACHE HANDLER — das Gedaechtnis der Hunde, auf jedem Speicher ~~~
 *
 * Der ICacheHandler der Base-Dogs (core) ueber einem beliebigen ICacheStore aus der App-Config
 * (config/default.config.ts: RAM vor DB). Die Logik bleibt hier, fuer jeden Speicher gleich:
 *  - getOrFetch mit Buendelung laufender Abrufe (gleicher Schluessel = ein Abruf),
 *  - Negativ-Cache (60 s) fuer voruebergehende Provider-Fehler wie Overpass 429/504 — bricht den Retry-Sturm,
 *  - Aufraeum-Takt fuer Speicher und Tile-Feature-Cache.
 * Bis 0.3.x hiess das PrismaCacheHandler und schrieb fest in die Tabelle CacheEntry.
 */

import { ICacheHandler, type ITileFeatureCache } from '@martinschmieschek/slopdogs-core';
import { isRuntimeLogVerbose } from '@martinschmieschek/slopdogs-core/runtime';
import type { ICacheStore } from '../config/cache/ICacheStore';
import { utf8Bytes } from '../config/cache/ICacheStore';
import { isCacheInfraError } from './resilientCacheHandler';

/** Der Tile-Feature-Cache, wie die Config ihn liefert: mit eigenem Aufraeumen. */
export type PrunableTileFeatureCache = ITileFeatureCache & { prune(): Promise<unknown> };

/** Negative-Cache TTL fuer Provider-Errors — kurz genug um sich schnell zu erholen,
 *  lang genug um einen Retry-Sturm zu brechen. */
const NEGATIVE_CACHE_TTL_MS = 60_000;

/** Marker-Payload im Cache; wenn gelesen loesen wir den originalen Error aus. */
const NEGATIVE_MARKER_PREFIX = '__SLOPDOGS_NEG_CACHE__:';
/** Praefix vor der Umbenennung (dataDogs) -- alte Marker in der Cache-DB bleiben Negativ-Treffer. */
const LEGACY_NEGATIVE_MARKER_PREFIX = '__DATADOGS_NEG_CACHE__:';

/**
 * Liest einen gespeicherten Cache-Wert als Negativ-Marker (JSON-String mit Praefix, neu oder alt).
 * Liefert die Fehlermeldung, sonst undefined.
 */
export function readNegativeCacheMarker(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return undefined;
    for (const prefix of [NEGATIVE_MARKER_PREFIX, LEGACY_NEGATIVE_MARKER_PREFIX]) {
        if (raw.startsWith('"' + prefix)) return (JSON.parse(raw) as string).slice(prefix.length);
    }
    return undefined;
}

/**
 * Abstand zwischen zwei Prune-Laeufen. Ein Cache-Aufraeumer, der oefter laeuft als der Cache altert, erzeugt
 * nur Last. Ueber CACHE_PRUNE_INTERVAL_MS (positiver Integer in ms) justierbar.
 */
const DEFAULT_PRUNE_INTERVAL_MS = 300_000;

/** Liest einen positiven Integer aus der Umgebung; alles andere faellt auf den Default. */
function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isTransientProviderError(err: unknown): boolean {
    if (!err) return false;
    const msg = (err as Error)?.message ?? String(err);
    // Overpass/OpenMeteo/Nominatim typische Muster: 429, 502, 503, 504, timeouts.
    return /(\b429\b|\b502\b|\b503\b|\b504\b|timeout|timed\s*out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|rate\s*limit)/i.test(msg);
}

type Lookup<T> = { kind: 'hit'; value: T } | { kind: 'negative'; message: string } | undefined;

export class StoreCacheHandler implements ICacheHandler {
    private readonly inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval> | null;

    constructor(
        private readonly store: ICacheStore,
        private readonly tiles: PrunableTileFeatureCache,
        pruneIntervalMs: number = positiveIntFromEnv('CACHE_PRUNE_INTERVAL_MS', DEFAULT_PRUNE_INTERVAL_MS),
    ) {
        this.pruneTimer = setInterval(() => {
            void this.prune().catch((e) => {
                if (isCacheInfraError(e)) {
                    console.warn('[cache-infra] background prune skipped (SQLite busy/timeout)');
                    return;
                }
                console.error('[StoreCacheHandler] prune', e);
            });
        }, pruneIntervalMs);
        this.pruneTimer.unref?.();
    }

    getTileFeatureCache(): ITileFeatureCache {
        return this.tiles;
    }

    /** Stoppt den Aufraeum-Takt. Den Speicher schliesst, wer ihn gebaut hat (die Config-Laufzeit). Idempotent. */
    public async disconnect(): Promise<void> {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = null;
        }
    }

    async get<T>(key: string): Promise<T | undefined> {
        const found = await this.lookup<T>(key);
        // Negative-Marker werden fuer externe get()-Aufrufer wie Miss behandelt.
        return found?.kind === 'hit' ? found.value : undefined;
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        const text = JSON.stringify(value);
        const now = Date.now();
        await this.store.set(key, { value: text, expiresAt: now + ttlMs, sizeBytes: utf8Bytes(text), lastHitAt: now });
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    async getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        const v = isRuntimeLogVerbose();

        const cached = await this.lookup<T>(key);
        if (cached !== undefined) {
            if (cached.kind === 'hit') {
                if (v) console.log(`[StoreCacheHandler] HIT: ${key}`);
                return cached.value;
            }
            if (v) console.log(`[StoreCacheHandler] NEG-HIT: ${key} (${cached.message})`);
            throw new Error(cached.message);
        }

        const existing = this.inflight.get(key);
        if (existing) {
            if (v) console.log(`[StoreCacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        if (v) console.log(`[StoreCacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(async (result) => {
                await this.set(key, result, ttlMs);
                this.inflight.delete(key);
                if (v) console.log(`[StoreCacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
                return result;
            })
            .catch(async (err) => {
                this.inflight.delete(key);
                if (isTransientProviderError(err)) {
                    // Kurzer Negative-Cache-Eintrag — stoppt den Retry-Sturm, laeuft schnell wieder ab.
                    const msg = (err as Error)?.message ?? String(err);
                    await this.set(key, NEGATIVE_MARKER_PREFIX + msg, NEGATIVE_CACHE_TTL_MS);
                    if (v) console.log(`[StoreCacheHandler] NEG-STORED: ${key} (${msg.slice(0, 80)})`);
                }
                throw err;
            });

        this.inflight.set(key, promise);
        return promise;
    }

    async invalidate(key: string): Promise<void> {
        await this.store.delete(key);
    }

    async invalidateByPrefix(prefix: string): Promise<void> {
        await this.store.deleteByPrefix(prefix);
    }

    async prune(): Promise<void> {
        const removed = await this.store.prune(Date.now());
        if (removed > 0 && isRuntimeLogVerbose()) console.log(`[StoreCacheHandler] PRUNED: ${removed} expired entries`);
        await this.tiles.prune();
    }

    /** Liest den Speicher und unterscheidet Hit / Negative-Hit / Miss. */
    private async lookup<T>(key: string): Promise<Lookup<T>> {
        const record = await this.store.get(key);
        if (!record) return undefined;
        const negativeMessage = readNegativeCacheMarker(record.value);
        if (negativeMessage !== undefined) return { kind: 'negative', message: negativeMessage };
        return { kind: 'hit', value: JSON.parse(record.value) as T };
    }
}
