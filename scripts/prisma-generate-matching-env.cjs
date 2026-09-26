'use strict';

/**
 * Erzeugt @prisma/client + Cache-Client passend zu NODE_ENV (SQLite vs PostgreSQL).
 * Ohne db push — für Startskripte, wenn zuletzt das andere Schema generiert wurde.
 */
const { execSync } = require('child_process');

const usePostgres = ['production', 'integration'].includes(process.env.NODE_ENV || 'development');
const storeSchema = usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma';
const cacheSuffix = usePostgres ? ' postgres' : '';

execSync(`npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix}`, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
});
