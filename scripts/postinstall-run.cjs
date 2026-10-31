const { execSync } = require('child_process');

// postinstall läuft mit NODE_ENV=development → SQLite-Schemas (siehe run-prisma-sync.cjs).
// Hier — und nur hier — werden die Pakete gebaut: `npm run build`/`build:prod` baut sie nicht noch einmal
// (siehe run-build.cjs). Die ui-app wird so installiert wie das Root-Projekt: `npm ci` bleibt `npm ci`.
const uiInstall = process.env.npm_command === 'ci' ? 'npm ci --prefer-offline' : 'npm install --prefer-offline';

execSync(
    `npm run build:packages && npx prisma generate --schema store/prisma/schema.prisma && node scripts/prisma-cache.cjs generate && node scripts/prisma-json-storage.cjs generate && node scripts/prisma-auth.cjs generate && cd ui-app && ${uiInstall}`,
    {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    },
);
