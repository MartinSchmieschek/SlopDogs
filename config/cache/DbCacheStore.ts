// Stufe 2: die Cache-Datenbank (Tabelle CacheEntry, Schema store/prisma-cache). Eine Tabelle fuer alles, was
// cacht — Base-Dogs (getOrFetch) und Ergebnisse ganzer Kennel-Laeufe (Gruppe = Lineage). Den Prisma-Client
// reicht die Config herein (config/database/prismaDatabase.ts); er gehoert diesem Speicher nicht.
import type { PrismaClient } from '../../store/generated/prisma-cache-client';
import type { CacheRecord, ICacheStore } from './ICacheStore';

type Row = {
    key: string;
    value: string;
    expiresAt: bigint;
    groupKey: string | null;
    meta: string | null;
    sizeBytes: number;
    lastHitAt: bigint;
};

export class DbCacheStore implements ICacheStore {
    readonly name = 'db';

    constructor(private readonly prisma: PrismaClient) {}

    async get(key: string): Promise<CacheRecord | null> {
        const row = (await this.prisma.cacheEntry.findUnique({ where: { key } })) as Row | null;
        if (!row) return null;
        if (Number(row.expiresAt) <= Date.now()) {
            await this.prisma.cacheEntry.deleteMany({ where: { key } });
            return null;
        }
        return DbCacheStore.recordOf(row);
    }

    async set(key: string, record: CacheRecord): Promise<void> {
        const data = {
            value: record.value,
            expiresAt: BigInt(record.expiresAt),
            groupKey: record.group ?? null,
            meta: record.meta ? JSON.stringify(record.meta) : null,
            sizeBytes: record.sizeBytes,
            lastHitAt: BigInt(record.lastHitAt),
        };
        await this.prisma.cacheEntry.upsert({ where: { key }, create: { key, ...data }, update: data });
    }

    async touch(key: string, lastHitAt: number, expiresAt?: number): Promise<void> {
        await this.prisma.cacheEntry.updateMany({
            where: { key },
            data: { lastHitAt: BigInt(lastHitAt), ...(expiresAt !== undefined ? { expiresAt: BigInt(expiresAt) } : {}) },
        });
    }

    async delete(key: string): Promise<void> {
        await this.prisma.cacheEntry.deleteMany({ where: { key } });
    }

    async deleteByPrefix(prefix: string): Promise<number> {
        return (await this.prisma.cacheEntry.deleteMany({ where: { key: { startsWith: prefix } } })).count;
    }

    async deleteGroup(group: string): Promise<number> {
        return (await this.prisma.cacheEntry.deleteMany({ where: { groupKey: group } })).count;
    }

    async countGroup(group: string): Promise<number> {
        return this.prisma.cacheEntry.count({ where: { groupKey: group, expiresAt: { gt: BigInt(Date.now()) } } });
    }

    async trimGroup(group: string, max: number): Promise<number> {
        const count = await this.prisma.cacheEntry.count({ where: { groupKey: group } });
        if (count <= max) return 0;
        const oldest = await this.prisma.cacheEntry.findMany({
            where: { groupKey: group },
            orderBy: { lastHitAt: 'asc' },
            take: count - max,
            select: { key: true },
        });
        return (await this.prisma.cacheEntry.deleteMany({ where: { key: { in: oldest.map((r) => r.key) } } })).count;
    }

    async prune(now: number): Promise<number> {
        return (await this.prisma.cacheEntry.deleteMany({ where: { expiresAt: { lte: BigInt(now) } } })).count;
    }

    async close(): Promise<void> {
        // Der Client gehoert der Config-Laufzeit (config/database/prismaDatabase.ts) — hier gibt es nichts freizugeben.
    }

    private static recordOf(row: Row): CacheRecord {
        let meta: CacheRecord['meta'] = null;
        if (row.meta) {
            try {
                meta = JSON.parse(row.meta) as CacheRecord['meta'];
            } catch {
                meta = null; // kaputte Zusatzfelder machen den Eintrag nicht unbrauchbar
            }
        }
        return {
            value: row.value,
            expiresAt: Number(row.expiresAt),
            group: row.groupKey,
            meta,
            sizeBytes: Number(row.sizeBytes),
            lastHitAt: Number(row.lastHitAt),
        };
    }
}
