'use strict';

/**
 * Erzeugt @prisma/client + Cache-Client passend zur DATABASE_URL (SQLite vs PostgreSQL,
 * siehe prismaVariantFor in dbEnv.cjs — nicht nach NODE_ENV).
 * Ohne db push — für Startskripte, wenn zuletzt das andere Schema generiert wurde.
 */
const { execSync } = require('child_process');
const { prismaVariantFor } = require('./dbEnv.cjs');

const { storeSchema, cacheSuffix } = prismaVariantFor(process.env);

execSync(`npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix}`, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
});
