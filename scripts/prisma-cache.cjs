/**
 * Stellt CACHE_DATABASE_URL für store/prisma-cache bereit (nach Validierung in dbEnv.cjs).
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveCacheDatabaseUrl, sharesStoreDatabase } = require('./dbEnv.cjs');

assertRequiredDbEnv();

// Liegt Cache in der Store-Datenbank, fuehrt das Store-Schema die Tabellen; ein Push dieses Teil-Schemas
// (--accept-data-loss) wuerde dort die Store-Tabellen droppen. Siehe run-prisma-sync.cjs.
if (process.argv[2] === 'push' && sharesStoreDatabase('cache')) {
    console.log('[prisma-cache] db push uebersprungen — Cache liegt in der Store-Datenbank, Tabellen kommen aus dem Store-Schema.');
    process.exit(0);
}
process.env.CACHE_DATABASE_URL = resolveCacheDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const cacheSchema = usePostgres ? 'store/prisma-cache/schema.postgres.prisma' : 'store/prisma-cache/schema.prisma';

const forceResetIntegration =
    process.env.PRISMA_SYNC_FORCE_RESET === '1' && process.env.NODE_ENV === 'integration';
const pushResetFlag = forceResetIntegration ? ' --force-reset' : '';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${cacheSchema} --accept-data-loss${pushResetFlag}${process.env.PRISMA_SYNC_PUSH_ONLY === '1' ? ' --skip-generate' : ''}`
        : `generate --schema ${cacheSchema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
