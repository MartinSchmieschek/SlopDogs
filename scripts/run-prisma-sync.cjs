/**
 * Lädt .env / .env.<NODE_ENV> und synchronisiert Store, Cache, JSON-Storage.
 * Vorher: assertRequiredDbEnv + assertNoPostgresSchemaConflict (siehe scripts/dbEnv.cjs).
 */
require('./load-env.cjs');

const { execSync } = require('child_process');
const {
    resolveCacheDatabaseUrl,
    resolveJsonStorageDatabaseUrl,
    authSharesStoreDatabase,
    prismaVariantFor,
    sharesStoreDatabase,
    subDatabaseSqliteFile,
    SUB_DATABASE_KINDS,
} = require('./dbEnv.cjs');

function redactedConn(url) {
    if (!url || typeof url !== 'string') return '(nicht gesetzt)';
    const u = url.trim();
    if (u.startsWith('file:')) return u;
    return u.replace(/:\/\/([^:/@]+):([^@]+)@/, '://$1:****@');
}

function pgSchemaHint(url) {
    if (!url || typeof url !== 'string' || url.startsWith('file:')) return '';
    const m = url.match(/[?&]schema=([^&]+)/i);
    if (!m) return '';
    try {
        return `  [PG-Schema: ${decodeURIComponent(m[1])}]`;
    } catch {
        return `  [PG-Schema: ${m[1]}]`;
    }
}

const storeUrl = (process.env.DATABASE_URL || '').trim();
const cacheUrl = resolveCacheDatabaseUrl();
const jsonUrl = resolveJsonStorageDatabaseUrl();

console.log('[prisma-sync] DATABASE_URL              → Store:', redactedConn(storeUrl) + pgSchemaHint(storeUrl));
console.log('[prisma-sync] CACHE_DATABASE_URL        → Cache:', redactedConn(cacheUrl) + pgSchemaHint(cacheUrl));
console.log('[prisma-sync] JSON_STORAGE_DATABASE_URL → JSON-Storage:', redactedConn(jsonUrl) + pgSchemaHint(jsonUrl));

// Postgres oder SQLite nach DATABASE_URL, nicht nach NODE_ENV (lokaler Modus: production + SQLite).
const { usePostgres, storeSchema: storeSchemaFile, cacheSuffix } = prismaVariantFor(process.env);

/** Nur Integration: voller Reset vor push (optional npm run prisma:sync:integration:reset). */
const forceResetIntegration =
    process.env.PRISMA_SYNC_FORCE_RESET === '1' && process.env.NODE_ENV === 'integration';
const storePushExtra = forceResetIntegration ? ' --force-reset' : '';

/**
 * Push-Strategie:
 *   - SQLite (Dev, lokaler Modus): das Store-Schema fuehrt alle Tabellen. Ein Teil-Schema
 *     (Cache, JSON-Storage, Auth) wird nur in seine EIGENE Datei gepusht; liegt es in der
 *     Store-Datei (sharesStoreDatabase, gleicher absoluter Pfad), legt der Store-Push seine
 *     Tabellen an und der Teil-Push entfaellt — sonst droppte jeder Push die Tabellen des anderen.
 *   - Postgres (Render: integration/production): EINE physische DB fuer Store+Cache+JSON
 *     (+Auth, wenn Auth dieselbe DB teilt). Das Haupt-Schema definiert alle
 *     Tabellen; Cache/JSON/Auth werden dann nur generiert, nicht gepusht.
 *     Eine bewusst GETRENNTE Auth-DB (eigener host/db) wird weiterhin gepusht.
 * Generiert werden immer alle vier Clients (Typen; der Server laedt nur die getrennten).
 */
const authInMainSchema = usePostgres && authSharesStoreDatabase();
const sqliteSharesStore = usePostgres ? {} : Object.fromEntries(SUB_DATABASE_KINDS.map((kind) => [kind, sharesStoreDatabase(kind)]));

/**
 * SQLite: zwei getrennte Teil-Schemas in DERSELBEN Datei (aber nicht der Store-Datei) wuerden sich
 * beim Push gegenseitig die Tabellen droppen. Das ist keine gueltige Konfiguration — vor jedem Push abbrechen.
 */
if (!usePostgres) {
    const byFile = new Map();
    for (const kind of SUB_DATABASE_KINDS) {
        if (sqliteSharesStore[kind]) continue;
        const file = subDatabaseSqliteFile(kind);
        if (!file) continue;
        if (byFile.has(file)) {
            console.error(
                `[prisma-sync] ${byFile.get(file)} und ${kind} zeigen auf dieselbe SQLite-Datei (${file}), die nicht die Store-Datei ist.\n`
                + '  Entweder getrennte Dateien oder beide auf die Datei von DATABASE_URL (dann fuehrt das Store-Schema alle Tabellen).',
            );
            process.exit(1);
        }
        byFile.set(file, kind);
    }
}

/**
 * `--push-only` (lokaler Modus, ExecStartPre der systemd-Unit): nur die Tabellen angleichen, keine Clients
 * generieren. Der Dienst darf den Code (node_modules, store/generated) nicht beschreiben — die Clients baut
 * `npm run build:local` als Deploy-Nutzer. PRISMA_SYNC_PUSH_ONLY reicht `--skip-generate` an die Helfer weiter.
 */
const pushOnly = process.argv.includes('--push-only');
if (pushOnly) process.env.PRISMA_SYNC_PUSH_ONLY = '1';
// Der Boot-Guard des lokalen Modus VOR jedem push: eine Fehlkonfiguration (Render, Proxy, oeffentliche Adresse)
// darf nicht erst eine Datenbank angleichen und dann abbrechen. Gebaut liegt er in dist/ (build:local).
if (pushOnly && (process.env.SLOPDOGS_MODE || '').trim() !== '') {
    const guardPath = require('path').join(process.cwd(), 'dist', 'server-app', 'LocalMode.js');
    if (!require('fs').existsSync(guardPath)) {
        console.error(`[prisma-sync] ${guardPath} fehlt — zuerst npm run build:local.`);
        process.exit(79);
    }
    const { LocalMode, EX_LOCAL_MODE } = require(guardPath);
    const guardError = LocalMode.bootError(process.env);
    if (guardError) {
        console.error(guardError);
        process.exit(EX_LOCAL_MODE);
    }
}
const skipGenerate = pushOnly ? ' --skip-generate' : '';
/** `--generate-only` (build:local als Deploy-Nutzer): alle vier Clients passend zur URL, aber keine Datenbank anfassen. */
const generateOnly = process.argv.includes('--generate-only');

const cmds = [
    ...(pushOnly ? [] : [
        `npx prisma generate --schema ${storeSchemaFile}`,
        `node scripts/prisma-cache.cjs generate${cacheSuffix}`,
        `node scripts/prisma-json-storage.cjs generate${cacheSuffix}`,
        `node scripts/prisma-auth.cjs generate${cacheSuffix}`,
    ]),
    `npx prisma db push --schema ${storeSchemaFile} --accept-data-loss${storePushExtra}${skipGenerate}`,
];
if (!usePostgres) {
    const helpers = { cache: 'prisma-cache.cjs', jsonStorage: 'prisma-json-storage.cjs', auth: 'prisma-auth.cjs' };
    const inStoreFile = SUB_DATABASE_KINDS.filter((kind) => sqliteSharesStore[kind]);
    for (const kind of SUB_DATABASE_KINDS) {
        if (!sqliteSharesStore[kind]) cmds.push(`node scripts/${helpers[kind]} push${cacheSuffix}`);
    }
    if (inStoreFile.length) {
        console.log(`[prisma-sync] SQLite: ${inStoreFile.join(', ')} ${inStoreFile.length > 1 ? 'liegen' : 'liegt'} in der Store-Datei — db push uebersprungen, Tabellen kommen aus ${storeSchemaFile}.`);
    }
} else {
    console.log('[prisma-sync] Postgres-Mode: Cache/JSON-Storage db push uebersprungen — Tabellen liegen im Haupt-Schema.');
    if (authInMainSchema) {
        console.log('[prisma-sync] Postgres-Single-DB: Auth db push uebersprungen — Auth-Tabellen liegen im Haupt-Schema (public).');
    } else {
        // Getrennte Auth-DB (eigener host/db) — dort hat der User Rechte, also pushen.
        cmds.push(`node scripts/prisma-auth.cjs push${cacheSuffix}`);
    }
}

const run = generateOnly ? cmds.filter((cmd) => cmd.includes(' generate')) : cmds;
if (generateOnly) console.log('[prisma-sync] --generate-only: nur Clients, kein db push.');
execSync(run.join(' && '), { stdio: 'inherit', env: process.env, shell: true });
