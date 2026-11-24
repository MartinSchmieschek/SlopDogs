// Stufe 1: die letzten Aufrufe im Prozess (PLAN-CACHE-KONFIG, 10-0: „minimal ram für die letzten aufrufe").
// LRU nach Anzahl UND Bytes, jede Haltezeit gekappt. Gehalten wird der Text, nie ein Objekt: ein Aufrufer, der
// ein gelesenes Ergebnis veraendert, verfaelscht so keinen spaeteren Treffer. Unter Speicherdruck (RSS ueber der
// weichen Grenze des Speicher-Waechters) leert sich der Speicher selbst — Render killt sonst ohne Meldung.
import { DogWorkerGate } from '@martinschmieschek/slopdogs-core/runtime';
import type { CacheRecord, ICacheStore } from './ICacheStore';

export interface RamCacheStoreOptions {
    /** Hoechstens so viele Eintraege (Default 500). */
    maxEntries?: number;
    /** Hoechstens so viele Bytes Text insgesamt (Default 8 MB). Groessere Einzeleintraege bleiben draussen. */
    maxBytes?: number;
    /** Hoechste Haltezeit in ms (Default 30 s); laengere Eintraege laufen hier frueher ab. */
    maxTtlMs?: number;
    /** Speicherdruck messen; Default: RSS ueber DogWorkerGate.memorySoftLimitMb(), nur wenn der Waechter an ist. */
    underMemoryPressure?: () => boolean;
}

export class RamCacheStore implements ICacheStore {
    static readonly DEFAULT_MAX_ENTRIES = 500;
    static readonly DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
    static readonly DEFAULT_MAX_TTL_MS = 30_000;
    /** Speicherdruck hoechstens so oft messen (process.memoryUsage ist ein Systemaufruf). */
    private static readonly PRESSURE_CHECK_MS = 1_000;

    readonly name = 'ram';
    readonly maxEntries: number;
    readonly maxBytes: number;
    readonly maxTtlMs: number;
    /** Einfuegereihenfolge = LRU-Reihenfolge: ein Treffer setzt den Eintrag ans Ende. */
    private readonly entries = new Map<string, CacheRecord>();
    private bytes = 0;
    private lastPressureCheck = 0;
    private readonly underMemoryPressure: () => boolean;

    constructor(options: RamCacheStoreOptions = {}) {
        this.maxEntries = Math.max(1, options.maxEntries ?? RamCacheStore.DEFAULT_MAX_ENTRIES);
        this.maxBytes = Math.max(1, options.maxBytes ?? RamCacheStore.DEFAULT_MAX_BYTES);
        this.maxTtlMs = Math.max(1, options.maxTtlMs ?? RamCacheStore.DEFAULT_MAX_TTL_MS);
        this.underMemoryPressure = options.underMemoryPressure ?? RamCacheStore.rssOverSoftLimit;
    }

    /** Belegung — fuer Statistik und Tests. */
    usage(): { entries: number; bytes: number } {
        return { entries: this.entries.size, bytes: this.bytes };
    }

    async get(key: string): Promise<CacheRecord | null> {
        const record = this.entries.get(key);
        if (!record) return null;
        if (record.expiresAt <= Date.now()) {
            this.remove(key);
            return null;
        }
        this.entries.delete(key);
        this.entries.set(key, record);
        return { ...record, meta: record.meta ? { ...record.meta } : record.meta };
    }

    async set(key: string, record: CacheRecord): Promise<void> {
        this.remove(key);
        if (record.sizeBytes > this.maxBytes || this.pressureCheck()) return;
        const expiresAt = Math.min(record.expiresAt, Date.now() + this.maxTtlMs);
        if (expiresAt <= Date.now()) return;
        this.entries.set(key, { ...record, expiresAt, meta: record.meta ? { ...record.meta } : record.meta });
        this.bytes += record.sizeBytes;
        this.evict();
    }

    async touch(key: string, lastHitAt: number, expiresAt?: number): Promise<void> {
        const record = this.entries.get(key);
        if (!record) return;
        record.lastHitAt = lastHitAt;
        if (expiresAt !== undefined) record.expiresAt = Math.min(expiresAt, Date.now() + this.maxTtlMs);
    }

    async delete(key: string): Promise<void> {
        this.remove(key);
    }

    async deleteByPrefix(prefix: string): Promise<number> {
        return this.removeWhere((key) => key.startsWith(prefix));
    }

    async deleteGroup(group: string): Promise<number> {
        return this.removeWhere((_key, record) => record.group === group);
    }

    async countGroup(group: string): Promise<number> {
        const now = Date.now();
        let count = 0;
        for (const record of this.entries.values()) if (record.group === group && record.expiresAt > now) count++;
        return count;
    }

    async trimGroup(group: string, max: number): Promise<number> {
        const members = [...this.entries].filter(([, r]) => r.group === group);
        if (members.length <= max) return 0;
        members.sort(([, a], [, b]) => a.lastHitAt - b.lastHitAt);
        const drop = members.slice(0, members.length - max);
        for (const [key] of drop) this.remove(key);
        return drop.length;
    }

    async prune(now: number): Promise<number> {
        return this.removeWhere((_key, record) => record.expiresAt <= now);
    }

    /** Alles verwerfen (Speicherdruck, Tests). */
    clear(): void {
        this.entries.clear();
        this.bytes = 0;
    }

    async close(): Promise<void> {
        this.clear();
    }

    private remove(key: string): void {
        const record = this.entries.get(key);
        if (!record) return;
        this.entries.delete(key);
        this.bytes -= record.sizeBytes;
    }

    private removeWhere(match: (key: string, record: CacheRecord) => boolean): number {
        let removed = 0;
        for (const [key, record] of [...this.entries]) {
            if (!match(key, record)) continue;
            this.remove(key);
            removed++;
        }
        return removed;
    }

    /** Aelteste zuerst, bis Anzahl und Bytes passen. */
    private evict(): void {
        for (const key of this.entries.keys()) {
            if (this.entries.size <= this.maxEntries && this.bytes <= this.maxBytes) return;
            this.remove(key);
        }
    }

    /** true = unter Druck: dann ist der Speicher geleert und nimmt nichts an. */
    private pressureCheck(): boolean {
        const now = Date.now();
        if (now - this.lastPressureCheck < RamCacheStore.PRESSURE_CHECK_MS) return false;
        this.lastPressureCheck = now;
        if (!this.underMemoryPressure()) return false;
        if (this.entries.size > 0) console.warn(`[cache:ram] Speicherdruck — ${this.entries.size} Eintraege verworfen`);
        this.clear();
        return true;
    }

    private static rssOverSoftLimit(): boolean {
        if (!DogWorkerGate.memoryGuardEnabled()) return false;
        return process.memoryUsage().rss / (1024 * 1024) > DogWorkerGate.memorySoftLimitMb();
    }
}
