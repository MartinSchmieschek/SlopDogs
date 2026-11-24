// Zwei Stufen (PLAN-CACHE-KONFIG): erst der schnelle Speicher (RAM), dann der dauerhafte (DB). Ein Treffer aus der
// zweiten Stufe wandert in die erste; Schreiben und jedes Loeschen gehen an beide. Zaehlen und Kappen entscheidet
// die zweite Stufe — sie ist der Massstab. touch schreibt hoechstens einmal je Haltezeit der ersten Stufe durch.
import type { CacheRecord, ICacheStore } from './ICacheStore';

export interface TieredCacheStoreOptions {
    /** So lange zaehlt ein Treffer nur in der ersten Stufe, bevor er in die zweite durchgeschrieben wird (Default 30 s). */
    touchWriteThroughMs?: number;
}

export class TieredCacheStore implements ICacheStore {
    readonly name: string;
    private readonly touchWriteThroughMs: number;
    /** Wann ein Schluessel zuletzt in der zweiten Stufe beruehrt wurde; begrenzt durch die Grenze unten. */
    private readonly lastSlowTouch = new Map<string, number>();
    private static readonly MAX_TOUCH_MARKS = 10_000;

    constructor(
        readonly fast: ICacheStore,
        readonly slow: ICacheStore,
        options: TieredCacheStoreOptions = {},
    ) {
        this.name = `${fast.name}+${slow.name}`;
        this.touchWriteThroughMs = options.touchWriteThroughMs ?? 30_000;
    }

    async get(key: string): Promise<CacheRecord | null> {
        const fast = await this.fast.get(key);
        if (fast) return fast;
        const slow = await this.slow.get(key);
        if (slow) await this.fast.set(key, slow);
        return slow;
    }

    async set(key: string, record: CacheRecord): Promise<void> {
        await this.slow.set(key, record);
        await this.fast.set(key, record);
        this.markSlowTouch(key, record.lastHitAt);
    }

    async touch(key: string, lastHitAt: number, expiresAt?: number): Promise<void> {
        await this.fast.touch(key, lastHitAt, expiresAt);
        const last = this.lastSlowTouch.get(key);
        if (last !== undefined && lastHitAt - last < this.touchWriteThroughMs) return;
        await this.slow.touch(key, lastHitAt, expiresAt);
        this.markSlowTouch(key, lastHitAt);
    }

    async delete(key: string): Promise<void> {
        this.lastSlowTouch.delete(key);
        await Promise.all([this.fast.delete(key), this.slow.delete(key)]);
    }

    async deleteByPrefix(prefix: string): Promise<number> {
        const [, slow] = await Promise.all([this.fast.deleteByPrefix(prefix), this.slow.deleteByPrefix(prefix)]);
        return slow;
    }

    async deleteGroup(group: string): Promise<number> {
        const [, slow] = await Promise.all([this.fast.deleteGroup(group), this.slow.deleteGroup(group)]);
        return slow;
    }

    async countGroup(group: string): Promise<number> {
        return this.slow.countGroup(group);
    }

    async trimGroup(group: string, max: number): Promise<number> {
        const trimmed = await this.slow.trimGroup(group, max);
        // Welche Schluessel die zweite Stufe genommen hat, sagt sie nicht — die erste vergisst die Gruppe ganz.
        if (trimmed > 0) await this.fast.deleteGroup(group);
        return trimmed;
    }

    async prune(now: number): Promise<number> {
        const [, slow] = await Promise.all([this.fast.prune(now), this.slow.prune(now)]);
        return slow;
    }

    async close(): Promise<void> {
        this.lastSlowTouch.clear();
        await Promise.allSettled([this.fast.close(), this.slow.close()]);
    }

    private markSlowTouch(key: string, at: number): void {
        if (this.lastSlowTouch.size >= TieredCacheStore.MAX_TOUCH_MARKS) this.lastSlowTouch.clear();
        this.lastSlowTouch.set(key, at);
    }
}
