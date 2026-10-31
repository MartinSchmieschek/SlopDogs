const { execSync } = require('child_process');
const { prismaVariantFor } = require('./dbEnv.cjs');

// Postgres oder SQLite nach DATABASE_URL, nicht nach NODE_ENV (lokaler Modus: production + SQLite).
const { storeSchema, cacheSuffix } = prismaVariantFor(process.env);
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Die Pakete baut `tsc -b tsconfig.packages.json` (Projekt-Referenzen, P1.2): es uebersetzt nur Pakete, deren
 * Quellen oder Abhaengigkeiten sich seit dem letzten Lauf geaendert haben, und ist sonst nach ~1-2 s fertig.
 * Die Installation (postinstall, `npm ci`) baut sie schon — im Render-Build (`npm ci && npm run build:prod`)
 * ist der zweite Aufruf hier deshalb nur die Pruefung "alles aktuell", kein zweiter Bau.
 */
// tsconfig.emit.json: wie tsconfig.build.json, aber ohne Pfade auf packages/*/src — kein dist/packages.
execSync(
    `npm run build:packages && npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && node scripts/prisma-json-storage.cjs generate${cacheSuffix} && tsc -p tsconfig.emit.json && node scripts/build-landing.cjs`,
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
