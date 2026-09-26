/**
 * Stellt CACHE_DATABASE_URL für store/prisma-cache bereit (nach Validierung in dbEnv.cjs).
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveCacheDatabaseUrl } = require('./dbEnv.cjs');

assertRequiredDbEnv();
process.env.CACHE_DATABASE_URL = resolveCacheDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const cacheSchema = usePostgres ? 'store/prisma-cache/schema.postgres.prisma' : 'store/prisma-cache/schema.prisma';

const forceResetIntegration =
    process.env.PRISMA_SYNC_FORCE_RESET === '1' && process.env.NODE_ENV === 'integration';
const pushResetFlag = forceResetIntegration ? ' --force-reset' : '';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${cacheSchema} --accept-data-loss${pushResetFlag}`
        : `generate --schema ${cacheSchema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
