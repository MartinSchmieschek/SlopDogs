const { execSync } = require('child_process');

const usePostgres = ['production', 'integration'].includes(process.env.NODE_ENV || 'development');
const storeSchema = usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma';
const cacheSuffix = usePostgres ? ' postgres' : '';

execSync(
    `npm run build:packages && npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && node scripts/prisma-json-storage.cjs generate${cacheSuffix} && tsc -p tsconfig.build.json && node scripts/build-landing.cjs`,
    {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    },
);

// Nur in production/integration die TypeDefs vorbereiten — dev nutzt weiter Live-Compilation.
if (usePostgres) {
    execSync('node scripts/precompile-typedefs.cjs', {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    });
}
