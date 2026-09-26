/**
 * ~~~ PRISMA CACHE HANDLER — persistent memory via dieselben ORM-Pfade wie der Store ~~~
 *
 * Eigene DB (CACHE_DATABASE_URL), Schema: store/prisma-cache/schema.prisma.
 * Kein zweites natives SQL-API — nur Prisma.
 *
 * Enthaelt zwei Caches:
 *  - CacheEntry (key/value) fuer klassische getOrFetch-Calls mit TTL + in-flight-dedup.
 *    Enthaelt Negative-Caching (60s) fuer Provider-Errors wie Overpass 429/504 —
 *    verhindert den Retry-Sturm wenn upstream rate-limited.
 *  - PrismaTileFeatureCache fuer atomaren OSM-Feature-Store via Slippy-Map-Tiles.
 *
 * Client-Pfad: immer relativ zum Projektroot (process.cwd()), damit dist/main.js nicht
 * nach dist/store/generated sucht — Prisma legt unter store/generated/ ab.
 */

import path from 'path';
import type { PrismaClient } from '../store/generated/prisma-cache-client';
import { ICacheHandler, isRuntimeLogVerbose, type ITileFeatureCache } from '@slopdogs/core';
import { PrismaTileFeatureCache } from './PrismaTileFeatureCache';
import { isCacheInfraError } from './resilientCacheHandler';

function createPrismaCacheClient(dbUrl: string): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-cache-client')) as typeof import('../store/generated/prisma-cache-client');
    return new mod.PrismaClient({
        datasources: { db: { url: dbUrl } },
    });
}

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
 * Abstand zwischen zwei Prune-Laeufen. Der frueher fest verdrahtete Minutentakt war
 * Selbstzweck: ein Cache-Aufraeumer, der oefter laeuft als der Cache altert, erzeugt
 * nur Last und haelt die Speicher-Wasserlinie oben. Ueber CACHE_PRUNE_INTERVAL_MS
 * (positiver Integer in ms) justierbar.
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
    return /(\b429\b|\b502\b|\b503\b|\b504\b|timeout|timed\s*out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|rate\s*limit)/i.test(
        msg,
    );
}

export class PrismaCacheHandler implements ICacheHandler {
    private prisma: PrismaClient;
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval> | null;
    private tileFeatureCache: PrismaTileFeatureCache;

    constructor(
        cacheDatabaseUrl: string,
        pruneIntervalMs: number = positiveIntFromEnv('CACHE_PRUNE_INTERVAL_MS', DEFAULT_PRUNE_INTERVAL_MS),
    ) {
        this.prisma = createPrismaCacheClient(cacheDatabaseUrl);
        this.tileFeatureCache = new PrismaTileFeatureCache(this.prisma);

        this.pruneTimer = setInterval(() => {
            void this.prune().catch((e) => {
                if (isCacheInfraError(e)) {
                    console.warn('[cache-infra] background prune skipped (SQLite busy/timeout)');
                    return;
                }
                console.error('[PrismaCacheHandler] prune', e);
            });
        }, pruneIntervalMs);
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    getTileFeatureCache(): ITileFeatureCache {
        return this.tileFeatureCache;
    }

    /**
     * Gibt Prune-Timer und Connection-Pool frei. Idempotent — ein zweites Signal
     * darf nicht ueber einen bereits geschlossenen Handler stolpern.
     */
    public async disconnect(): Promise<void> {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = null;
        }
        await this.prisma.$disconnect();
    }

    async get<T>(key: string): Promise<T | undefined> {
        const row = await this.prisma.cacheEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        if (Date.now() >= Number(row.expiresAt)) {
            await this.prisma.cacheEntry.delete({ where: { key } });
            return undefined;
        }
        // Negative-Marker werden fuer externe get()-Aufrufer wie Miss behandelt.
        if (readNegativeCacheMarker(row.value) !== undefined) {
            return undefined;
        }
        return JSON.parse(row.value) as T;
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        const expiresAt = BigInt(Date.now() + ttlMs);
        await this.prisma.cacheEntry.upsert({
            where: { key },
            create: { key, value: JSON.stringify(value), expiresAt },
            update: { value: JSON.stringify(value), expiresAt },
        });
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    async getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        const v = isRuntimeLogVerbose();

        const cached = await this.getWithNegativeCheck<T>(key);
        if (cached !== undefined) {
            if (cached.kind === 'hit') {
                if (v) console.log(`[PrismaCacheHandler] HIT: ${key}`);
                return cached.value;
            }
            if (v) console.log(`[PrismaCacheHandler] NEG-HIT: ${key} (${cached.message})`);
            throw new Error(cached.message);
        }

        const existing = this.inflight.get(key);
        if (existing) {
            if (v) console.log(`[PrismaCacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        if (v) console.log(`[PrismaCacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(async (result) => {
                await this.set(key, result, ttlMs);
                this.inflight.delete(key);
                if (v) console.log(`[PrismaCacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
                return result;
            })
            .catch(async (err) => {
                this.inflight.delete(key);
                if (isTransientProviderError(err)) {
                    // Kurzer Negative-Cache-Eintrag — stoppt den Retry-Sturm,
                    // laeuft naturgemaess schnell wieder ab.
                    const msg = (err as Error)?.message ?? String(err);
                    await this.set(
                        key,
                        NEGATIVE_MARKER_PREFIX + msg,
                        NEGATIVE_CACHE_TTL_MS,
                    );
                    if (v) console.log(`[PrismaCacheHandler] NEG-STORED: ${key} (${msg.slice(0, 80)})`);
                }
                throw err;
            });

        this.inflight.set(key, promise);
        return promise;
    }

    /** Liest Cache und unterscheidet Hit / Negative-Hit / Miss. */
    private async getWithNegativeCheck<T>(
        key: string,
    ): Promise<{ kind: 'hit'; value: T } | { kind: 'negative'; message: string } | undefined> {
        const row = await this.prisma.cacheEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        if (Date.now() >= Number(row.expiresAt)) {
            await this.prisma.cacheEntry.delete({ where: { key } });
            return undefined;
        }
        const raw = row.value;
        // Negative-Marker ist als JSON-String gespeichert (JSON.stringify).
        const negativeMessage = readNegativeCacheMarker(raw);
        if (negativeMessage !== undefined) {
            return { kind: 'negative', message: negativeMessage };
        }
        return { kind: 'hit', value: JSON.parse(raw) as T };
    }

    async invalidate(key: string): Promise<void> {
        await this.prisma.cacheEntry.deleteMany({ where: { key } });
    }

    async invalidateByPrefix(prefix: string): Promise<void> {
        await this.prisma.cacheEntry.deleteMany({
            where: { key: { startsWith: prefix } },
        });
    }

    async prune(): Promise<void> {
        const now = BigInt(Date.now());
        const res = await this.prisma.cacheEntry.deleteMany({
            where: { expiresAt: { lte: now } },
        });
        if (res.count > 0 && isRuntimeLogVerbose()) {
            console.log(`[PrismaCacheHandler] PRUNED: ${res.count} expired entries`);
        }
        await this.tileFeatureCache.prune();
    }
}
