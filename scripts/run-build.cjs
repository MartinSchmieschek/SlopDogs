const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { prismaVariantFor } = require('./dbEnv.cjs');

// Postgres oder SQLite nach DATABASE_URL, nicht nach NODE_ENV (lokaler Modus: production + SQLite).
const { storeSchema, cacheSuffix } = prismaVariantFor(process.env);
const nodeEnv = process.env.NODE_ENV || 'development';

/**
 * Die Pakete baut die Installation (postinstall, `npm ci`/`npm install`) — ein Render-Build
 * (`npm ci && npm run build:prod`) baut die Kette damit genau einmal. Hier nur dann, wenn ein Paket
 * kein dist hat oder eine Quelldatei juenger ist als sein dist/index.js (lokal nach einer Aenderung).
 */
function newestMtimeMs(dir) {
    let newest = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        newest = Math.max(newest, entry.isDirectory() ? newestMtimeMs(full) : fs.statSync(full).mtimeMs);
    }
    return newest;
}

function stalePackages() {
    const packagesDir = path.join(__dirname, '..', 'packages');
    return fs
        .readdirSync(packagesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packagesDir, entry.name, 'tsconfig.json')))
        .map((entry) => entry.name)
        .filter((name) => {
            const builtIndex = path.join(packagesDir, name, 'dist', 'index.js');
            if (!fs.existsSync(builtIndex)) return true;
            return newestMtimeMs(path.join(packagesDir, name, 'src')) > fs.statSync(builtIndex).mtimeMs;
        });
}

const stale = stalePackages();
const buildPackages = stale.length > 0 ? 'npm run build:packages && ' : '';
if (stale.length > 0) {
    console.log(`[build] ${stale.length} Paket(e) ohne aktuelles dist (${stale.slice(0, 5).join(', ')}${stale.length > 5 ? ', …' : ''}) — baue die Paketkette.`);
}

// tsconfig.emit.json: wie tsconfig.build.json, aber ohne Pfade auf packages/*/src — kein dist/packages.
execSync(
    `${buildPackages}npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && node scripts/prisma-json-storage.cjs generate${cacheSuffix} && tsc -p tsconfig.emit.json && node scripts/build-landing.cjs`,
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
