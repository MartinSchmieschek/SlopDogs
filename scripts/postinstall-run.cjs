const { execSync } = require('child_process');

// postinstall läuft mit NODE_ENV=development → SQLite-Schemas (siehe run-prisma-sync.cjs).
execSync(
    'npm run build:packages && npx prisma generate --schema store/prisma/schema.prisma && node scripts/prisma-cache.cjs generate && node scripts/prisma-json-storage.cjs generate && node scripts/prisma-auth.cjs generate && cd ui-app && npm install --prefer-offline',
    {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    },
);
