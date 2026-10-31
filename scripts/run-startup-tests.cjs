'use strict';

/**
 * `npm run test:startup` (PLAN-DOG-PAKETE P0.1): die Startup-Suite als eigener Lauf mit Exit-Code.
 *
 * 1. Eigene SQLite-Dateien (`test-startup*.db` neben den Schemas) loeschen und per `prisma db push`
 *    frisch anlegen — nie dev.db, nie eine Postgres-URL.
 * 2. `test/startup/runStartupTests.ts` mit genau dieser Umgebung starten. Bewusst OHNE load-env.cjs:
 *    die .env-Dateien des Entwicklers wuerden die Test-URLs ueberschreiben (override: true). So laeuft
 *    der Lauf lokal wie in der CI.
 * 3. Exit-Code des Laufs durchreichen.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

/** SQLite-URLs sind relativ zur Schema-Datei — dort liegt die Datei auch. */
const DATABASES = [
    { env: 'DATABASE_URL', schema: 'store/prisma/schema.prisma', file: 'test-startup.db' },
    { env: 'CACHE_DATABASE_URL', schema: 'store/prisma-cache/schema.prisma', file: 'test-startup-cache.db' },
    { env: 'JSON_STORAGE_DATABASE_URL', schema: 'store/prisma-json-storage/schema.prisma', file: 'test-startup-json-storage.db' },
    { env: 'AUTH_DATABASE_URL', schema: 'store/prisma-auth/schema.prisma', file: 'test-startup-auth.db' },
];

function testEnvironment() {
    const env = { ...process.env, NODE_ENV: 'development' };
    // Pfad-Varianten und Postgres-Reste aus der Shell duerfen die Test-URLs nicht verdraengen.
    for (const name of ['CACHE_DB_PATH', 'JSON_STORAGE_DB_PATH', 'AUTH_DB_PATH', 'RUN_STARTUP_TESTS']) delete env[name];
    for (const db of DATABASES) env[db.env] = `file:./${db.file}`;
    env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
    return env;
}

function removeOldDatabases() {
    for (const db of DATABASES) {
        const file = path.join(root, path.dirname(db.schema), db.file);
        for (const candidate of [file, `${file}-journal`, `${file}-wal`, `${file}-shm`]) {
            fs.rmSync(candidate, { force: true });
        }
    }
}

/**
 * Ohne --skip-generate: der Push erzeugt dabei die SQLite-Clients neu. Nach `build:prod` liegen sonst
 * Postgres-Clients in node_modules, und der Lauf scheitert an der file:-URL statt an einem Test.
 */
function pushSchemas(env) {
    for (const db of DATABASES) {
        execSync(`npx prisma db push --schema ${db.schema} --accept-data-loss`, {
            cwd: root,
            env,
            stdio: ['ignore', 'ignore', 'inherit'],
            shell: true,
        });
    }
}

function runSuite(env) {
    const result = spawnSync(
        process.execPath,
        ['--max-old-space-size=4096', '-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'test/startup/runStartupTests.ts'],
        { cwd: root, env, stdio: 'inherit' },
    );
    if (result.error) throw result.error;
    return result.status === null ? 1 : result.status;
}

const startedAt = Date.now();
try {
    const env = testEnvironment();
    removeOldDatabases();
    pushSchemas(env);
    const code = runSuite(env);
    console.log(`[test:startup] Exit ${code} nach ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
    process.exit(code);
} catch (err) {
    console.error('[test:startup] Vorbereitung gescheitert:', err instanceof Error ? err.message : err);
    process.exit(1);
}
