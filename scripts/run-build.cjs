const { execSync } = require('child_process');
const { prismaVariantFor } = require('./dbEnv.cjs');

// Postgres oder SQLite nach DATABASE_URL, nicht nach NODE_ENV (lokaler Modus: production + SQLite).
const { storeSchema, cacheSuffix } = prismaVariantFor(process.env);
const nodeEnv = process.env.NODE_ENV || 'development';

// core und die Dog-Pakete liegen gebaut in node_modules (Git-Tag bzw. Release-Tarball); uebersetzt wird nur der Server.
execSync(
    `npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && node scripts/prisma-json-storage.cjs generate${cacheSuffix} && tsc -p tsconfig.emit.json && node scripts/build-landing.cjs`,
    {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    },
);

// Nur in production/integration die TypeDefs vorbereiten (unabhaengig von der DB-Art,
// auch der lokale Modus braucht dist/type-defs.json) — dev nutzt weiter Live-Compilation.
if (nodeEnv === 'production' || nodeEnv === 'integration') {
    execSync('node scripts/precompile-typedefs.cjs', {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    });
}
