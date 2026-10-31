'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Zentrale Pruefung und Aufloesung der DB-URLs.
 *
 * Welche DB-Art gilt, entscheidet die URL, nicht NODE_ENV: DATABASE_URL mit
 * postgres://… bzw. postgresql://… → Postgres, sonst SQLite (prismaVariantFor;
 * Build, Prisma-Generierung und Sync waehlen ihre Schemas danach). Damit laeuft
 * auch NODE_ENV=production mit SQLite (lokaler Modus auf dem Pi). integration
 * erzwingt weiterhin Postgres (Pruefung in assertRequiredDbEnv).
 *
 * SQLite (Dev, lokaler Modus): standardmaessig vier Dateien (DATABASE_URL, CACHE_DATABASE_URL,
 * JSON_STORAGE_DATABASE_URL, AUTH_DATABASE_URL). Zeigen Teil-URLs auf die Store-Datei, gilt
 * dieselbe Regel wie bei Postgres: das Store-Schema (store/prisma/schema.prisma) fuehrt alle
 * Tabellen, nur dieses wird gepusht, und zur Laufzeit gibt es einen Client (sharesStoreDatabase).
 *
 * Postgres (Render: integration/production): nur DATABASE_URL ist Pflicht. Cache- und
 * JSON-Storage-URL werden, falls nicht explizit gesetzt, einfach auf
 * DATABASE_URL gespiegelt — alle Tabellen liegen in derselben physischen DB
 * (Schema `public`). Damit sich die `db push`-Laeufe nicht gegenseitig
 * Tabellen wegdroppen, definiert das Haupt-Schema (store/prisma/schema.postgres.prisma)
 * ALLE Tabellen, und nur dieses wird gepusht (siehe scripts/run-prisma-sync.cjs).
 * Cache- und JSON-Storage-Schemas werden nur fuer den Client-Typgenerator genutzt.
 */

function assertRequiredDbEnv() {
    const store = (process.env.DATABASE_URL || '').trim();
    const explicitCacheUrl = (process.env.CACHE_DATABASE_URL || '').trim();
    const cachePath = (process.env.CACHE_DB_PATH || '').trim();
    const explicitJsonStorageUrl = (process.env.JSON_STORAGE_DATABASE_URL || '').trim();
    const jsonStoragePath = (process.env.JSON_STORAGE_DB_PATH || '').trim();
    const authUrl = (process.env.AUTH_DATABASE_URL || '').trim();
    const authPath = (process.env.AUTH_DB_PATH || '').trim();

    const blocks = [];

    if (!store) {
        blocks.push(
            '[ENV] DATABASE_URL fehlt oder ist leer.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma/schema.prisma):',
            '    DATABASE_URL="file:./dev.db"',
            '',
            '  Integration/Production (PostgreSQL, Schema: store/prisma/schema.postgres.prisma):',
            '    DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/DATENBANK?sslmode=require"',
            '    Cache + JSON-Storage benutzen automatisch dieselbe DATABASE_URL,',
            '    wenn ihre eigenen URLs nicht gesetzt sind. Alle Tabellen liegen in `public`.',
            '',
            '  Sonderzeichen im Passwort: in der URL URL-encoden (z. B. @ -> %40).',
            '  Siehe auch: .env.example',
        );
    }

    const storeIsPostgres = isPostgresUrl(store);

    if (!explicitCacheUrl && !cachePath && !storeIsPostgres) {
        blocks.push(
            '[ENV] Cache-DB: Weder CACHE_DATABASE_URL noch CACHE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-cache/schema.prisma):',
            '    CACHE_DATABASE_URL="file:./cache.db"',
            '  oder: CACHE_DB_PATH="store/prisma-cache/cache.db"',
            '',
        );
    }

    if (!explicitJsonStorageUrl && !jsonStoragePath && !storeIsPostgres) {
        blocks.push(
            '[ENV] JSON-Storage-DB: Weder JSON_STORAGE_DATABASE_URL noch JSON_STORAGE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-json-storage/schema.prisma):',
            '    JSON_STORAGE_DATABASE_URL="file:./json-storage.db"',
            '  oder: JSON_STORAGE_DB_PATH="store/prisma-json-storage/json-storage.db"',
            '',
        );
    }

    if (!authUrl && !authPath) {
        blocks.push(
            '[ENV] Auth-DB: Weder AUTH_DATABASE_URL noch AUTH_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-auth/schema.prisma):',
            '    AUTH_DATABASE_URL="file:./auth.db"',
            '  oder: AUTH_DB_PATH="store/prisma-auth/auth.db"',
            '',
            '  Integration/Production (PostgreSQL, Schema: store/prisma-auth/schema.postgres.prisma):',
            '    AUTH_DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/AUTH_DB?sslmode=require"',
            '',
            '  Auth-Daten (User, OAuth*, Tokens) sollten in eigener DB liegen — Backup, Lifecycle und',
            '  Sicherheit profitieren von der Trennung zur Content-DB.',
        );
    }

    if (blocks.length) {
        const err = new Error('\n' + blocks.join('\n'));
        err.name = 'DbEnvError';
        throw err;
    }

    /**
     * Integration: immer echte Postgres-URLs — Store, Cache und JSON-Storage
     * (JsonStorageRetriever) nutzen dieselbe DB nach Spiegelung. SQLite aus
     * `.env` allein reicht nicht; `.env.integration` muss postgresql://… setzen.
     */
    if ((process.env.NODE_ENV || '').trim() === 'integration' && !storeIsPostgres) {
        const err = new Error(
            [
                '',
                '[ENV] NODE_ENV=integration erfordert PostgreSQL als DATABASE_URL (postgresql://…).',
                '  SQLite (file:./dev.db) aus der Basis-.env ist fuer Integration unzulaessig.',
                '',
                '  In `.env.integration` eine Postgres-URL setzen (siehe `.env.integration.example`).',
                '  Cache und JSON-Storage werden auf dieselbe URL gespiegelt — alle Tabellen',
                '  entstehen mit `npm run prisma:sync:integration`.',
            ].join('\n'),
        );
        err.name = 'DbEnvError';
        throw err;
    }

    /**
     * Postgres-Mode: alle drei Clients teilen sich DATABASE_URL, falls die
     * spezifischen URLs nicht gesetzt sind. Wir spiegeln die Werte in
     * process.env, damit Prisma-Clients zur Laufzeit dieselbe DB sehen
     * wie die Push-Skripte.
     */
    if (storeIsPostgres) {
        if (!explicitCacheUrl && !cachePath) {
            process.env.CACHE_DATABASE_URL = store;
        }
        if (!explicitJsonStorageUrl && !jsonStoragePath) {
            process.env.JSON_STORAGE_DATABASE_URL = store;
        }
    }

    /**
     * Integration: Basis-.env enthaelt oft noch SQLite-URLs (file:./cache.db).
     * Die wuerden sonst die Postgres-Spiegelung verhindern — Cache/JSON muessten
     * dieselbe DB wie DATABASE_URL nutzen (ein db push, siehe run-prisma-sync.cjs).
     */
    if ((process.env.NODE_ENV || '').trim() === 'integration' && storeIsPostgres) {
        process.env.CACHE_DATABASE_URL = store;
        process.env.JSON_STORAGE_DATABASE_URL = store;
        delete process.env.CACHE_DB_PATH;
        delete process.env.JSON_STORAGE_DB_PATH;
    }

    /**
     * Postgres-Single-DB: teilt sich Auth die physische Store-DB, liegen die
     * Auth-Tabellen (User, OAuth*, Tokens) im Haupt-Schema (public) — angelegt
     * vom Store-Push, GENAU wie Cache/JSON (siehe store/prisma/schema.postgres.prisma
     * + run-prisma-sync.cjs). KEIN eigenes Schema und kein separater Auth-Push:
     *   - ein eigenes Postgres-Schema braeuchte CREATE-Recht auf der Datenbank,
     *     das gehostete Postgres (dbaas) oft verweigert;
     *   - zwei getrennte `db push --accept-data-loss` in dieselbe DB clobbern sich.
     * Also AUTH_DATABASE_URL auf die Store-URL (public) spiegeln, damit der
     * Auth-Client die Tabellen im Haupt-Schema findet. Greift zur Push- UND
     * Laufzeit (load-env.cjs ruft assertRequiredDbEnv an jedem Entrypoint).
     * Eine bewusst GETRENNTE Auth-DB (anderer host/db) bleibt unangetastet und
     * wird weiterhin separat gepusht.
     */
    if (authSharesStoreDatabase()) {
        process.env.AUTH_DATABASE_URL = store;
        delete process.env.AUTH_DB_PATH;
    }

    /**
     * Konflikt-Check: nur zwischen URLs, die der Nutzer EXPLIZIT gesetzt hat.
     * Wenn jemand bewusst zwei eigene Postgres-URLs eintraegt, die auf denselben
     * (host, db, schema)-Namespace zeigen, ist das ein Konfigurationsfehler —
     * `prisma db push --accept-data-loss` wuerde sich gegenseitig Tabellen wegnehmen.
     * Auto-gespiegelte URLs (siehe oben) sind hier kein Konflikt: das Push-Skript
     * pusht in Postgres-Mode nur das Haupt-Schema; Cache/JSON werden nur
     * generiert (kein db push).
     */
    assertNoExplicitPostgresSchemaConflict({
        DATABASE_URL: store,
        CACHE_DATABASE_URL: explicitCacheUrl,
        JSON_STORAGE_DATABASE_URL: explicitJsonStorageUrl,
    });
}

function isPostgresUrl(raw) {
    return typeof raw === 'string' && /^postgres(ql)?:\/\//i.test(raw);
}

/**
 * Prisma-Variante fuer Build, Generierung und Sync — rein, ohne Seiteneffekte.
 * Postgres genau dann, wenn DATABASE_URL eine Postgres-URL ist; NODE_ENV spielt
 * keine Rolle (auf Render ist DATABASE_URL Postgres, dort bleibt alles gleich).
 * cacheSuffix ist das Argument fuer prisma-cache/-json-storage/-auth.cjs.
 */
function prismaVariantFor(env = process.env) {
    const usePostgres = isPostgresUrl((env.DATABASE_URL || '').trim());
    // Render (RENDER gesetzt) laeuft nur mit Postgres. Frueher erzwang NODE_ENV dort die Postgres-Schemas; eine
    // andere URL-Form (prisma://, prisma+postgres://, Anfuehrungszeichen) wuerde jetzt still SQLite-Clients bauen.
    if (!usePostgres && (env.RENDER || '').trim() !== '') {
        const err = new Error(
            '\n[ENV] RENDER ist gesetzt, aber DATABASE_URL beginnt nicht mit postgres:// oder postgresql:// — '
            + 'Build und Prisma-Generierung waehlen das Schema nach der URL. Wert im Render-Dashboard pruefen.',
        );
        err.name = 'DbEnvError';
        throw err;
    }
    return {
        usePostgres,
        storeSchema: usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma',
        cacheSuffix: usePostgres ? ' postgres' : '',
    };
}

function assertNoExplicitPostgresSchemaConflict(urls) {
    const parsed = [];
    for (const [name, raw] of Object.entries(urls)) {
        if (!raw) continue;
        const info = parsePostgresUrl(raw);
        if (info) parsed.push({ name, ...info });
    }
    if (parsed.length < 2) return;

    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            const a = parsed[i];
            const b = parsed[j];
            const rawA = (urls[a.name] || '').trim();
            const rawB = (urls[b.name] || '').trim();
            if (rawA && rawA === rawB) continue;
            if (a.host !== b.host || a.port !== b.port || a.db !== b.db) continue;
            if (a.schema !== b.schema) continue;
            const err = new Error(
                [
                    '',
                    `[ENV] ${a.name} und ${b.name} sind beide explizit gesetzt und zeigen auf denselben Postgres-Namespace:`,
                    `  host=${a.host}  port=${a.port}  db=${a.db}  schema=${a.schema}`,
                    '',
                    '  Wenn du absichtlich EINE DB fuer alles nutzt, setz nur DATABASE_URL und',
                    '  loesche CACHE_DATABASE_URL / JSON_STORAGE_DATABASE_URL — dbEnv.cjs spiegelt',
                    '  sie automatisch und das Sync-Skript pusht in Postgres-Mode nur das',
                    '  Haupt-Schema (store/prisma/schema.postgres.prisma), das alle Tabellen kennt.',
                    '',
                    '  Wenn du tatsaechlich getrennte Namespaces willst, gib unterschiedliche',
                    '  ?schema=…-Werte an (z. B. ?schema=cache, ?schema=json_storage).',
                ].join('\n'),
            );
            err.name = 'DbEnvError';
            throw err;
        }
    }
}

function parsePostgresUrl(raw) {
    if (!isPostgresUrl(raw)) return null;
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const port = u.port || '5432';
        const db = (u.pathname || '').replace(/^\//, '').toLowerCase();
        const schema = (u.searchParams.get('schema') || 'public').toLowerCase();
        return { host, port, db, schema };
    } catch {
        return null;
    }
}

/**
 * True, wenn Auth in Postgres-Mode dieselbe physische DB wie der Store nutzt
 * (gleicher host/port/db, unabhaengig vom ?schema=). Dann liegen die Auth-Tabellen
 * im Haupt-Schema (public) und es gibt keinen separaten Auth-Push. Getrennte
 * Auth-DB (anderer host/db) oder SQLite-Auth → false. Wird auch von
 * run-prisma-sync.cjs genutzt, um den Auth-Push zu ueberspringen.
 */
function authSharesStoreDatabase() {
    const store = (process.env.DATABASE_URL || '').trim();
    const auth = (process.env.AUTH_DATABASE_URL || '').trim();
    if (!isPostgresUrl(store) || !isPostgresUrl(auth)) return false;
    const s = parsePostgresUrl(store);
    const a = parsePostgresUrl(auth);
    if (!s || !a) return false;
    return s.host === a.host && s.port === a.port && s.db === a.db;
}

/**
 * Liefert die Cache-DB-URL fuer Prisma. Postgres: nutzt CACHE_DATABASE_URL
 * (wurde von assertRequiredDbEnv ggf. auf DATABASE_URL gespiegelt). SQLite-Dev:
 * faellt auf CACHE_DB_PATH zurueck.
 */
function withSqliteBusyTimeout(url) {
    if (!url.startsWith('file:') || /busy_timeout=/i.test(url)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}busy_timeout=60000`;
}

/** Liest einen positiven Integer aus der Umgebung; alles andere faellt auf den Default. */
function positiveIntFromEnv(name, fallback) {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Haengt Postgres-URLs ein Pool-Budget an. Ohne `connection_limit` nimmt jeder
 * Prisma-Client Prismas Default (num_cpus * 2 + 1).
 *
 * Single-DB (integration/production: assertRequiredDbEnv spiegelt Cache, JSON-Storage und
 * Auth auf DATABASE_URL): EIN Prisma-Client fuer Store, Cache, JSON-Storage und Auth
 * (store/SharedPrismaClients.ts, Regel: sharesStoreDatabase), also EIN Pool. Ohne
 * DB_CONNECTION_LIMIT bekommt er 4 je Teil, der auf diese URL zeigt (Single-DB: 4 x 4 = 16) —
 * so viele wie vor P1.4 die vier getrennten Pools zusammen; ein Geo-Lauf mit langer
 * Tile-Transaktion laesst Auth und Store damit nicht schneller warten als vorher. Waehrend eines Render-Deploys laeuft der alte Prozess
 * kurz parallel zum neuen, also kurzzeitig doppelt so viele.
 *
 * Mehr-DB (Teil-URL auf anderen host/db oder anderes ?schema=): jeder getrennte Teil hat
 * seinen eigenen Client und Pool mit demselben Budget — hoechstens vier Pools (Store, Auth,
 * Cache, JSON-Storage); PrismaTileFeatureCache teilt sich den Cache-Client, der Session-
 * Store liegt im Speicher.
 *
 * Die 4 je Teil sind ein bewusst konservativ gewaehltes Budget, KEIN gemessener Wert. Wer
 * misst, setzt DB_CONNECTION_LIMIT / DB_POOL_TIMEOUT — oder schreibt die Parameter
 * direkt in die URL, dann bleibt sie hier unangetastet.
 */
const POOL_BUDGET_PER_PART = 4;
const DB_PART_URL_VARS = ['DATABASE_URL', 'CACHE_DATABASE_URL', 'JSON_STORAGE_DATABASE_URL', 'AUTH_DATABASE_URL'];

/** Wie viele der vier Teile (Store, Cache, JSON-Storage, Auth) auf genau diese URL zeigen, mindestens 1. */
function partsOnUrl(url) {
    const count = DB_PART_URL_VARS.filter((name) => (process.env[name] || '').trim() === url).length;
    return Math.max(1, count);
}

function withPostgresPoolLimit(url) {
    if (!isPostgresUrl(url)) return url;
    if (/[?&](connection_limit|pool_timeout)=/i.test(url)) return url;
    const connectionLimit = positiveIntFromEnv('DB_CONNECTION_LIMIT', POOL_BUDGET_PER_PART * partsOnUrl(url));
    const poolTimeout = positiveIntFromEnv('DB_POOL_TIMEOUT', 20);
    return `${url}${url.includes('?') ? '&' : '?'}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
}

/**
 * Liefert die Store-DB-URL fuer Prisma (Nodes/Kennels, store/prisma/schema*.prisma).
 * DATABASE_URL ist Pflicht — ohne sie kommt der Store nicht hoch.
 */
function resolveStoreDatabaseUrl() {
    const storeUrl = (process.env.DATABASE_URL || '').trim();
    if (!storeUrl) {
        throw new Error('resolveStoreDatabaseUrl: DATABASE_URL fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    return withPostgresPoolLimit(withSqliteBusyTimeout(storeUrl));
}

function resolveCacheDatabaseUrl() {
    const cacheUrl = (process.env.CACHE_DATABASE_URL || '').trim();
    if (cacheUrl) return withPostgresPoolLimit(withSqliteBusyTimeout(cacheUrl));
    const pathOnly = (process.env.CACHE_DB_PATH || '').trim();
    if (!pathOnly) {
        throw new Error('resolveCacheDatabaseUrl: CACHE_DATABASE_URL / CACHE_DB_PATH fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    if (pathOnly.startsWith('file:')) return withSqliteBusyTimeout(pathOnly);
    return withSqliteBusyTimeout(`file:${pathOnly.replace(/\\/g, '/')}`);
}

/**
 * Liefert die JSON-Storage-DB-URL fuer Prisma. Verhalten analog zu
 * resolveCacheDatabaseUrl.
 */
function resolveJsonStorageDatabaseUrl() {
    const jsonStorageUrl = (process.env.JSON_STORAGE_DATABASE_URL || '').trim();
    if (jsonStorageUrl) return withPostgresPoolLimit(jsonStorageUrl);
    const pathOnly = (process.env.JSON_STORAGE_DB_PATH || '').trim();
    if (!pathOnly) {
        throw new Error('resolveJsonStorageDatabaseUrl: JSON_STORAGE_DATABASE_URL / JSON_STORAGE_DB_PATH fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    if (pathOnly.startsWith('file:')) return pathOnly;
    return `file:${pathOnly.replace(/\\/g, '/')}`;
}

/**
 * Setzt aus AUTH_DATABASE_URL oder AUTH_DB_PATH die finale URL fuer Prisma (Auth-Schema).
 */
function resolveAuthDatabaseUrl() {
    const authUrl = (process.env.AUTH_DATABASE_URL || '').trim();
    if (authUrl) return withPostgresPoolLimit(authUrl);
    const pathOnly = (process.env.AUTH_DB_PATH || '').trim();
    if (!pathOnly) {
        throw new Error('resolveAuthDatabaseUrl: AUTH_DATABASE_URL / AUTH_DB_PATH fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    if (pathOnly.startsWith('file:')) return pathOnly;
    return `file:${pathOnly.replace(/\\/g, '/')}`;
}

/**
 * Teil-Datenbanken neben dem Store: Schema-Verzeichnis (dort loest Prisma relative SQLite-Pfade
 * auf) und die URL-Aufloesung, die auch der Laufzeit-Client nutzt.
 */
const STORE_SCHEMA_DIR = 'store/prisma';
const SUB_DATABASES = {
    cache: { schemaDir: 'store/prisma-cache', resolveUrl: resolveCacheDatabaseUrl },
    jsonStorage: { schemaDir: 'store/prisma-json-storage', resolveUrl: resolveJsonStorageDatabaseUrl },
    auth: { schemaDir: 'store/prisma-auth', resolveUrl: resolveAuthDatabaseUrl },
};
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Absoluter Dateipfad einer SQLite-URL, so wie Prisma ihn aufloest: relativ zum Verzeichnis
 * des Schemas, das die URL liest (file:./dev.db -> store/prisma/dev.db, file:./cache.db ->
 * store/prisma-cache/cache.db). Die gleiche Zeichenkette heisst also nicht die gleiche Datei.
 * Query-Teil (?busy_timeout=…) zaehlt nicht. Windows: ohne Gross-/Kleinschreibung. Existiert die
 * Datei schon, zaehlt ihr echter Pfad (Symlink/Hardlink-Ziel, Schreibweise des Dateisystems) — sonst
 * hielte die Regel zwei Namen derselben Datei fuer getrennt, und ein Teil-Push droppte Store-Tabellen.
 * Keine file:-URL -> null.
 */
function sqliteFilePath(url, schemaDir) {
    if (typeof url !== 'string' || !url.startsWith('file:')) return null;
    let file = url.slice('file:'.length);
    const query = file.indexOf('?');
    if (query >= 0) file = file.slice(0, query);
    if (file.startsWith('//')) file = file.slice(2);
    if (/^\/[A-Za-z]:/.test(file)) file = file.slice(1);
    if (!file) return null;
    let absolute = path.resolve(PROJECT_ROOT, schemaDir, file);
    try {
        absolute = fs.realpathSync.native(absolute);
    } catch {
        // Datei gibt es noch nicht (erster Push): dann zaehlt der aufgeloeste Pfad.
    }
    return process.platform === 'win32' ? absolute.toLowerCase() : absolute;
}

/**
 * True, wenn die Teil-Datenbank `kind` (cache | jsonStorage | auth) physisch die Store-Datenbank
 * ist. Dann fuehrt das Store-Schema ihre Tabellen, nur das Store-Schema wird gepusht
 * (run-prisma-sync.cjs) und zur Laufzeit bedient der Store-Client sie mit (store/SharedPrismaClients.ts).
 *
 *   Postgres: die aufgeloesten URLs sind zeichengleich. Das ist nach assertRequiredDbEnv genau der
 *     gespiegelte Fall (Cache/JSON ohne eigene URL, Auth auf demselben host/port/db). Ein bewusst
 *     anderes ?schema=, ein anderer Host oder eine andere DB bleibt getrennt. Gleicher Namespace
 *     mit anderer Zeichenkette kommt nicht vor: assertNoExplicitPostgresSchemaConflict bricht ab.
 *   SQLite: derselbe absolute Dateipfad (sqliteFilePath).
 *
 * Erst nach assertRequiredDbEnv aufrufen (load-env.cjs tut das an jedem Entrypoint).
 */
function sharesStoreDatabase(kind) {
    const sub = SUB_DATABASES[kind];
    if (!sub) throw new Error(`sharesStoreDatabase: unbekannte Teil-Datenbank "${kind}" (cache | jsonStorage | auth).`);
    const storeUrl = resolveStoreDatabaseUrl();
    const subUrl = sub.resolveUrl();
    if (isPostgresUrl(storeUrl) || isPostgresUrl(subUrl)) return storeUrl === subUrl;
    const storeFile = sqliteFilePath(storeUrl, STORE_SCHEMA_DIR);
    return storeFile !== null && storeFile === sqliteFilePath(subUrl, sub.schemaDir);
}

/** Absoluter SQLite-Dateipfad der Teil-Datenbank `kind`, sonst null (Postgres). */
function subDatabaseSqliteFile(kind) {
    const sub = SUB_DATABASES[kind];
    if (!sub) throw new Error(`subDatabaseSqliteFile: unbekannte Teil-Datenbank "${kind}".`);
    return sqliteFilePath(sub.resolveUrl(), sub.schemaDir);
}

module.exports = {
    assertRequiredDbEnv,
    sharesStoreDatabase,
    subDatabaseSqliteFile,
    SUB_DATABASE_KINDS: Object.freeze(Object.keys(SUB_DATABASES)),
    resolveStoreDatabaseUrl,
    resolveCacheDatabaseUrl,
    resolveJsonStorageDatabaseUrl,
    resolveAuthDatabaseUrl,
    authSharesStoreDatabase,
    isPostgresUrl,
    prismaVariantFor,
};
