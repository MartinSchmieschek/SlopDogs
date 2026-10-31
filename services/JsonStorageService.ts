/**
 * ~~~ JSON-STORAGE-SERVICE — fachlich getrennte KV-Ablage ~~~
 *
 * DB aus JSON_STORAGE_DATABASE_URL, Schema: store/prisma-json-storage/schema.prisma.
 * Fachlich unabhaengig vom Run-Cache (PrismaCacheHandler) und vom Nodes/Kennels-Store; liegt die
 * Tabelle physisch in der Store-Datenbank (Single-DB), nutzt der Service den Store-Client mit
 * (store/SharedPrismaClients.ts), sonst einen eigenen.
 *
 * Wird in main.ts ueber `registerVmGlobalCapability('jsonStore', ...)` als
 * VM-Global-Capability registriert -- jeder SerializedDog sieht jsonStore.get/
 * set/delete/has/list/snapshot automatisch im VM-Context, ohne Parent.
 *
 * Client-Pfad: relativ zum Projektroot (process.cwd()), damit dist/main.js nicht
 * nach dist/store/generated sucht.
 */

import path from 'path';
import type { PrismaClient } from '../store/generated/prisma-json-storage-client';
import type { PrismaClientLease, SharedPrismaClients } from '../store/SharedPrismaClients';

function createPrismaJsonStorageClient(dbUrl: string): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-json-storage-client')) as typeof import('../store/generated/prisma-json-storage-client');
    return new mod.PrismaClient({
        datasources: { db: { url: dbUrl } },
    });
}

export interface JsonEntrySnapshot {
    key: string;
    value: unknown;
    updatedAt: number;
}

export class JsonStorageService {
    private readonly lease: PrismaClientLease<PrismaClient>;
    private prisma: PrismaClient;

    /**
     * @param clients liefert den Store-Client, wenn die JSON-Ablage in der Store-Datenbank liegt —
     *   sonst entsteht ein eigener Client auf `databaseUrl`.
     */
    constructor(clients: SharedPrismaClients, databaseUrl: string) {
        this.lease = clients.lease('jsonStorage', () => createPrismaJsonStorageClient(databaseUrl));
        this.prisma = this.lease.client;
    }

    async get<T = unknown>(key: string): Promise<T | undefined> {
        const row = await this.prisma.jsonEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        return JSON.parse(row.value) as T;
    }

    async set<T = unknown>(key: string, value: T): Promise<void> {
        const payload = JSON.stringify(value);
        const updatedAt = BigInt(Date.now());
        await this.prisma.jsonEntry.upsert({
            where: { key },
            create: { key, value: payload, updatedAt },
            update: { value: payload, updatedAt },
        });
    }

    async delete(key: string): Promise<boolean> {
        const res = await this.prisma.jsonEntry.deleteMany({ where: { key } });
        return res.count > 0;
    }

    async has(key: string): Promise<boolean> {
        const row = await this.prisma.jsonEntry.findUnique({ where: { key } });
        return row !== null;
    }

    async list(): Promise<string[]> {
        const rows = await this.prisma.jsonEntry.findMany({ select: { key: true } });
        return rows.map((r) => r.key);
    }

    async snapshot(): Promise<JsonEntrySnapshot[]> {
        const rows = await this.prisma.jsonEntry.findMany();
        return rows.map((r) => ({
            key: r.key,
            value: JSON.parse(r.value),
            updatedAt: Number(r.updatedAt),
        }));
    }

    /**
     * Gibt den eigenen Connection-Pool frei — der geordnete Shutdown in main.ts ruft das. Ein
     * geliehener Store-Client bleibt verbunden (den trennt store.disconnect()).
     */
    async disconnect(): Promise<void> {
        await this.lease.release();
    }
}
