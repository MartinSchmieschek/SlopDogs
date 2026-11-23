/**
 * Stellt JSON_STORAGE_DATABASE_URL fuer store/prisma-json-storage bereit
 * (nach Validierung in dbEnv.cjs). Analog zu prisma-cache.cjs.
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveJsonStorageDatabaseUrl, sharesStoreDatabase } = require('./dbEnv.cjs');

assertRequiredDbEnv();

// Liegt JSON-Storage in der Store-Datenbank, fuehrt das Store-Schema die Tabellen; ein Push dieses Teil-Schemas
// (--accept-data-loss) wuerde dort die Store-Tabellen droppen. Siehe run-prisma-sync.cjs.
if (process.argv[2] === 'push' && sharesStoreDatabase('jsonStorage')) {
    console.log(
        '[prisma-json-storage] db push uebersprungen — JSON-Storage liegt in der Store-Datenbank, Tabellen kommen aus dem Store-Schema.',
    );
    process.exit(0);
}
process.env.JSON_STORAGE_DATABASE_URL = resolveJsonStorageDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const schema = usePostgres ? 'store/prisma-json-storage/schema.postgres.prisma' : 'store/prisma-json-storage/schema.prisma';

const forceResetIntegration = process.env.PRISMA_SYNC_FORCE_RESET === '1' && process.env.NODE_ENV === 'integration';
const pushResetFlag = forceResetIntegration ? ' --force-reset' : '';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${schema} --accept-data-loss${pushResetFlag}${process.env.PRISMA_SYNC_PUSH_ONLY === '1' ? ' --skip-generate' : ''}`
        : `generate --schema ${schema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
