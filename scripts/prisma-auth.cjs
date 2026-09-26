/**
 * Stellt AUTH_DATABASE_URL für store/prisma-auth bereit (nach Validierung in dbEnv.cjs).
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveAuthDatabaseUrl } = require('./dbEnv.cjs');

assertRequiredDbEnv();
process.env.AUTH_DATABASE_URL = resolveAuthDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const authSchema = usePostgres ? 'store/prisma-auth/schema.postgres.prisma' : 'store/prisma-auth/schema.prisma';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${authSchema} --accept-data-loss`
        : `generate --schema ${authSchema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
