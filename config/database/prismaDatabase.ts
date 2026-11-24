// Der Datenzugang des heutigen Betriebs: Prisma auf DATABASE_URL, Teil-Datenbanken (Cache, JSON, Auth) teilen den
// Store-Client, wo sie physisch dieselbe Datenbank sind (store/SharedPrismaClients.ts). Die Adressen kommen aus
// der Env ueber `ctx.urls` — hier steht nur der Code, wie wir an die Daten kommen.
import path from 'path';
import { PrismaStore } from '../../store/PrismaStore';
import type { PrismaClientLease } from '../../store/SharedPrismaClients';
import type { PrismaClient as CachePrismaClient } from '../../store/generated/prisma-cache-client';
import type { AppDatabase, ConfigContext } from '../AppConfig';

function createCachePrismaClient(url: string): CachePrismaClient {
    // Erst im eigenen Fall laden — sonst kaeme die Engine des Teil-Clients trotzdem in den Prozess.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- erst im eigenen Fall laden (s. o.)
    const mod = require(
        path.join(process.cwd(), 'store/generated/prisma-cache-client'),
    ) as typeof import('../../store/generated/prisma-cache-client');
    return new mod.PrismaClient({ datasources: { db: { url } } });
}

/** AppDatabase auf Prisma, dazu der Client der Cache-Datenbank fuer DbCacheStore und den Tile-Cache. */
export interface PrismaAppDatabase extends AppDatabase {
    /** Der Client der Cache-Datenbank — einmal geliehen (Single-DB) oder einmal eigen, beim ersten Aufruf. */
    cachePrisma(): CachePrismaClient;
}

export async function prismaDatabase(ctx: ConfigContext): Promise<PrismaAppDatabase> {
    // Ein Store, ein Pool: Hunde und Kennels liegen in derselben Tabelle.
    const store = new PrismaStore(ctx.urls.store());
    await store.init();
    const clients = store.sharedClients();
    let cacheLease: PrismaClientLease<CachePrismaClient> | null = null;
    return {
        store,
        clients,
        cachePrisma: () => (cacheLease ??= clients.lease('cache', () => createCachePrismaClient(ctx.urls.cache()))).client,
        describe: () => clients.describe(),
        close: async () => {
            await cacheLease?.release();
            cacheLease = null;
        },
    };
}
