/**
 * Stellt AUTH_DATABASE_URL für store/prisma-auth bereit (nach Validierung in dbEnv.cjs).
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveAuthDatabaseUrl, sharesStoreDatabase } = require('./dbEnv.cjs');

assertRequiredDbEnv();

// Liegt Auth in der Store-Datenbank, fuehrt das Store-Schema die Tabellen; ein Push dieses Teil-Schemas
// (--accept-data-loss) wuerde dort die Store-Tabellen droppen. Siehe run-prisma-sync.cjs.
if (process.argv[2] === 'push' && sharesStoreDatabase('auth')) {
    console.log('[prisma-auth] db push uebersprungen — Auth liegt in der Store-Datenbank, Tabellen kommen aus dem Store-Schema.');
    process.exit(0);
}
process.env.AUTH_DATABASE_URL = resolveAuthDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const authSchema = usePostgres ? 'store/prisma-auth/schema.postgres.prisma' : 'store/prisma-auth/schema.prisma';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${authSchema} --accept-data-loss${process.env.PRISMA_SYNC_PUSH_ONLY === '1' ? ' --skip-generate' : ''}`
        : `generate --schema ${authSchema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
