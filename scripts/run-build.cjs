const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
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

// Der Commit fuer GET /api/health (services/ServerVersion.ts): Render nennt ihn, sonst fragt git; ohne beides null.
function buildCommit() {
    const fromEnv = (process.env.RENDER_GIT_COMMIT || '').trim();
    if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) return fromEnv.slice(0, 7).toLowerCase();
    try {
        return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch {
        return null; // kein git-Checkout (z. B. Tarball)
    }
}
const buildInfo = { commit: buildCommit() };
fs.writeFileSync(
    path.join(__dirname, '..', 'dist', 'build-info.json'),
    `${JSON.stringify(buildInfo)}
`,
);
console.log(`[build] dist/build-info.json: commit ${buildInfo.commit ?? '(unbekannt)'}`);

// Nur in production/integration die TypeDefs vorbereiten (unabhaengig von der DB-Art,
// auch der lokale Modus braucht dist/type-defs.json) — dev nutzt weiter Live-Compilation.
if (nodeEnv === 'production' || nodeEnv === 'integration') {
    execSync('node scripts/precompile-typedefs.cjs', {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    });
}
