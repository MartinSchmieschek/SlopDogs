/**
 * Lädt .env / .env.<NODE_ENV> und synchronisiert Store, Cache, JSON-Storage.
 * Vorher: assertRequiredDbEnv + assertNoPostgresSchemaConflict (siehe scripts/dbEnv.cjs).
 */
require('./load-env.cjs');

const { execSync } = require('child_process');
const { resolveCacheDatabaseUrl, resolveJsonStorageDatabaseUrl, authSharesStoreDatabase } = require('./dbEnv.cjs');

function redactedConn(url) {
    if (!url || typeof url !== 'string') return '(nicht gesetzt)';
    const u = url.trim();
    if (u.startsWith('file:')) return u;
    return u.replace(/:\/\/([^:/@]+):([^@]+)@/, '://$1:****@');
}

function pgSchemaHint(url) {
    if (!url || typeof url !== 'string' || url.startsWith('file:')) return '';
    const m = url.match(/[?&]schema=([^&]+)/i);
    if (!m) return '';
    try {
        return `  [PG-Schema: ${decodeURIComponent(m[1])}]`;
    } catch {
        return `  [PG-Schema: ${m[1]}]`;
    }
}

const storeUrl = (process.env.DATABASE_URL || '').trim();
const cacheUrl = resolveCacheDatabaseUrl();
const jsonUrl = resolveJsonStorageDatabaseUrl();

console.log('[prisma-sync] DATABASE_URL              → Store:', redactedConn(storeUrl) + pgSchemaHint(storeUrl));
console.log('[prisma-sync] CACHE_DATABASE_URL        → Cache:', redactedConn(cacheUrl) + pgSchemaHint(cacheUrl));
console.log('[prisma-sync] JSON_STORAGE_DATABASE_URL → JSON-Storage:', redactedConn(jsonUrl) + pgSchemaHint(jsonUrl));

const usePostgres = ['production', 'integration'].includes(process.env.NODE_ENV || 'development');
const storeSchemaFile = usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma';
const cacheSuffix = usePostgres ? ' postgres' : '';

/** Nur Integration: voller Reset vor push (optional npm run prisma:sync:integration:reset). */
const forceResetIntegration =
    process.env.PRISMA_SYNC_FORCE_RESET === '1' && process.env.NODE_ENV === 'integration';
const storePushExtra = forceResetIntegration ? ' --force-reset' : '';

/**
 * Push-Strategie:
 *   - Dev (SQLite): Store, Cache, JSON-Storage und Auth pushen in getrennte DBs.
 *   - Postgres (integration/production): EINE physische DB fuer Store+Cache+JSON
 *     (+Auth, wenn Auth dieselbe DB teilt). Das Haupt-Schema definiert alle
 *     Tabellen; Cache/JSON/Auth werden dann nur generiert, nicht gepusht.
 *     Eine bewusst GETRENNTE Auth-DB (eigener host/db) wird weiterhin gepusht.
 */
const authInMainSchema = usePostgres && authSharesStoreDatabase();

const cmds = [
    `npx prisma generate --schema ${storeSchemaFile}`,
    `node scripts/prisma-cache.cjs generate${cacheSuffix}`,
    `node scripts/prisma-json-storage.cjs generate${cacheSuffix}`,
    `node scripts/prisma-auth.cjs generate${cacheSuffix}`,
    `npx prisma db push --schema ${storeSchemaFile} --accept-data-loss${storePushExtra}`,
];
if (!usePostgres) {
    cmds.push(`node scripts/prisma-cache.cjs push${cacheSuffix}`);
    cmds.push(`node scripts/prisma-json-storage.cjs push${cacheSuffix}`);
    cmds.push(`node scripts/prisma-auth.cjs push${cacheSuffix}`);
} else {
    console.log('[prisma-sync] Postgres-Mode: Cache/JSON-Storage db push uebersprungen — Tabellen liegen im Haupt-Schema.');
    if (authInMainSchema) {
        console.log('[prisma-sync] Postgres-Single-DB: Auth db push uebersprungen — Auth-Tabellen liegen im Haupt-Schema (public).');
    } else {
        // Getrennte Auth-DB (eigener host/db) — dort hat der User Rechte, also pushen.
        cmds.push(`node scripts/prisma-auth.cjs push${cacheSuffix}`);
    }
}

execSync(cmds.join(' && '), { stdio: 'inherit', env: process.env, shell: true });
