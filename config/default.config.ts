// Default-Config: der heutige Betrieb (production, integration). Daten aus Prisma, Cache in zwei Stufen — die
// letzten Aufrufe im RAM, dahinter die Cache-Datenbank —, die Base-Dogs des Betriebs. Zugangsdaten: Env.
// Eine andere Config: SLOPDOGS_CONFIG=<pfad>, z. B. eine Kopie dieser Datei mit eigenem `cache` (ICacheStore).
import { defineConfig } from './AppConfig';
import { prismaDatabase } from './database/prismaDatabase';
import { DbCacheStore } from './cache/DbCacheStore';
import { RamCacheStore } from './cache/RamCacheStore';
import { TieredCacheStore } from './cache/TieredCacheStore';
import { PrismaTileFeatureCache } from '../services/PrismaTileFeatureCache';
import { allBaseDogClasses, allPacts } from './dogs/deployDogs';

export default defineConfig({
    name: 'default',
    database: prismaDatabase,
    cache: (_ctx, db) =>
        new TieredCacheStore(
            new RamCacheStore({ maxEntries: 500, maxBytes: 8 * 1024 * 1024, maxTtlMs: 30_000 }),
            new DbCacheStore(db.cachePrisma()),
        ),
    tiles: (_ctx, db) => new PrismaTileFeatureCache(db.cachePrisma()),
    dogs: allBaseDogClasses,
    pacts: allPacts,
    requireKennelCoverage: true,
});
