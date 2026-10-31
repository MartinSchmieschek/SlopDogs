/**
 * Startwarnung fuer fehlende Pflicht-Env — und der Katalog aller Variablen, die der Dienst liest.
 *
 * EINE Liste (`ENV_CATALOG`) traegt je Variable Abschnitt, Zweck, Default, Phase, Folge bei Fehlen und
 * die Pflicht-Regeln je NODE_ENV. Dieselbe Liste gliedert `.env.example` und `.env.integration.example`
 * (gleiche Abschnitte, gleiche Reihenfolge). Beides prueft scripts/check-env-catalog.cjs (P1.5, in npm test):
 * jede Variable, die der Code liest, steht hier; jeder Eintrag hier steht in beiden Beispielen.
 *
 * Die Warnung beendet den Prozess NIE. Die harten Guards bleiben, wo sie sind:
 *   - scripts/load-env.cjs -> dbEnv.assertRequiredDbEnv (DbEnvError, Exit 1)
 *   - mcp/auth/middleware.ts authModeBootError (production/integration ohne Auth, Exit 78)
 *   - server-app/LocalMode.ts LocalMode.bootError (SLOPDOGS_MODE=local mit Deployment-Zeichen, Exit 79)
 * Diese Zeilen sagen vorher, was fehlt und was es kostet — statt dass es erst beim ersten Login bricht.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DogEnvVar } from '@martinschmieschek/slopdogs-core';
import { LocalMode } from './LocalMode';

/**
 * Ein Katalog-Eintrag. Die Form steht seit P2.7 in core (`DogEnvVar`), weil Dog-Pakete ihre Variablen in derselben
 * Form liefern (`<paket>/env`); Server- und Paket-Eintraege sind damit nicht zu unterscheiden.
 */
export type EnvVarSpec = DogEnvVar;
/** Pflicht-/Empfehlungsregel eines Eintrags. */
export type EnvRule = NonNullable<DogEnvVar['rules']>[number];
/** Umgebungen, die der Dienst kennt. Alles andere zaehlt wie development (so auch authModeBootError). */
export type NodeEnvName = EnvRule['in'][number];
/** Abschnitte der .env-Dateien, in dieser Reihenfolge (ENV_SECTIONS). */
export type EnvSection = DogEnvVar['section'];
/**
 * Zusatzbedingung einer Regel:
 *   authRequired     — nur wenn MCP_AUTH_REQUIRED=true (Login an)
 *   storeNotPostgres — nur wenn DATABASE_URL KEINE Postgres-URL ist (sonst spiegelt dbEnv.cjs Cache/JSON darauf)
 *   notLocalMode     — nur ohne SLOPDOGS_MODE=local (der lokale Modus laeuft als production, aber ohne Login)
 */
export type EnvCondition = NonNullable<EnvRule['when']>;

export interface EnvSectionSpec {
    readonly id: EnvSection;
    /** Ueberschrift, wie sie in den .env-Dateien steht. */
    readonly heading: string;
}

export const ENV_SECTIONS: readonly EnvSectionSpec[] = [
    { id: 'required', heading: '1. Pflicht (Required)' },
    { id: 'operations', heading: '2. Betrieb und Grenzen (Operations and limits)' },
    { id: 'features', heading: '3. Funktionen (Features)' },
    { id: 'integrations', heading: '4. Integrationen (Integrations)' },
    { id: 'development', heading: '5. Entwicklung (Development)' },
    { id: 'internal', heading: '6. Intern (nicht setzen)' },
];

const ALL: readonly NodeEnvName[] = ['development', 'integration', 'production'];
const DEPLOYED: readonly NodeEnvName[] = ['integration', 'production'];

/** Pflicht deployed (dort ist Login Pflicht, sonst Exit 78) — lokal nur, wenn der Login an ist. */
const AUTH_RULES: readonly EnvRule[] = [
    { in: DEPLOYED, level: 'required', when: 'notLocalMode' },
    { in: ['development'], level: 'required', when: 'authRequired' },
];

/** Die Variablen des Servers selbst (und von core). Die der Dog-Pakete kommen aus `<paket>/env` (DOG_PACKAGE_ENV). */
const SERVER_ENV_CATALOG: readonly EnvVarSpec[] = [
    // --- 1. Pflicht -------------------------------------------------------------------------------
    {
        name: 'DATABASE_URL',
        section: 'required',
        since: 'vor P1',
        purpose: 'Haupt-Store (Nodes, Kennels, Aufrufe, Sterne); integration: postgresql://',
        defaultValue: '—',
        consequence: 'DbEnvError in scripts/load-env.cjs, Exit 1',
        rules: [{ in: ALL, level: 'required' }],
    },
    {
        name: 'CACHE_DATABASE_URL',
        section: 'required',
        since: 'vor P1',
        purpose: 'HTTP-/Geo-Cache (SQLite-Datei); bei Postgres auf DATABASE_URL gespiegelt',
        defaultValue: 'Postgres: = DATABASE_URL',
        consequence: 'DbEnvError, Exit 1',
        anyOf: ['CACHE_DB_PATH'],
        rules: [{ in: ALL, level: 'required', when: 'storeNotPostgres' }],
    },
    {
        name: 'CACHE_DB_PATH',
        section: 'required',
        since: 'vor P1',
        purpose: 'Pfad-Alternative zu CACHE_DATABASE_URL (SQLite)',
        defaultValue: '—',
        consequence: 'keine, wenn CACHE_DATABASE_URL gesetzt ist',
    },
    {
        name: 'JSON_STORAGE_DATABASE_URL',
        section: 'required',
        since: 'vor P1',
        purpose: 'JSON-Ablage fuer jsonStore (VM-Global); bei Postgres auf DATABASE_URL gespiegelt',
        defaultValue: 'Postgres: = DATABASE_URL',
        consequence: 'DbEnvError, Exit 1',
        anyOf: ['JSON_STORAGE_DB_PATH'],
        rules: [{ in: ALL, level: 'required', when: 'storeNotPostgres' }],
    },
    {
        name: 'JSON_STORAGE_DB_PATH',
        section: 'required',
        since: 'vor P1',
        purpose: 'Pfad-Alternative zu JSON_STORAGE_DATABASE_URL (SQLite)',
        defaultValue: '—',
        consequence: 'keine, wenn JSON_STORAGE_DATABASE_URL gesetzt ist',
    },
    {
        name: 'AUTH_DATABASE_URL',
        section: 'required',
        since: 'vor P1',
        purpose: 'Auth-DB (User, OAuth-Clients, Tokens, Beta-Keys, Key-Store)',
        defaultValue: '—',
        consequence: 'DbEnvError, Exit 1',
        anyOf: ['AUTH_DB_PATH'],
        rules: [{ in: ALL, level: 'required' }],
    },
    {
        name: 'AUTH_DB_PATH',
        section: 'required',
        since: 'vor P1',
        purpose: 'Pfad-Alternative zu AUTH_DATABASE_URL (SQLite)',
        defaultValue: '—',
        consequence: 'keine, wenn AUTH_DATABASE_URL gesetzt ist',
    },
    {
        name: 'SESSION_SECRET',
        section: 'required',
        since: 'vor P1',
        purpose: 'Signiert die Session-Cookies des Browser-Logins (32+ Zeichen)',
        defaultValue: '—',
        consequence: 'createSessionMiddleware wirft, "Failed to start", Exit 1',
        rules: [{ in: ALL, level: 'required' }],
    },
    {
        name: 'MCP_AUTH_REQUIRED',
        section: 'required',
        since: 'P3.5',
        purpose: 'Master-Schalter Login: true = Login + Sichtbarkeit, sonst Super-User fuer alle',
        defaultValue: 'nicht true (Super-User)',
        consequence: 'Exit 78 (EX_CONFIG)',
        requiredValue: 'true',
        rules: [{ in: DEPLOYED, level: 'required', when: 'notLocalMode' }],
    },
    {
        name: 'MCP_TOKEN_SIGNING_KEY',
        section: 'required',
        since: 'vor P1',
        purpose: 'HS256-Schluessel der ausgestellten Access-Tokens (64+ hex)',
        defaultValue: '—',
        consequence: 'Token-Ausgabe und -Pruefung werfen, OAuth- und Bearer-Login scheitern',
        rules: AUTH_RULES,
    },
    {
        name: 'GOOGLE_OAUTH_CLIENT_ID',
        section: 'required',
        since: 'vor P1',
        purpose: 'Google-OAuth-Client (Web application)',
        defaultValue: '—',
        consequence: '/auth/google/login wirft, niemand kann sich anmelden',
        rules: AUTH_RULES,
    },
    {
        name: 'GOOGLE_OAUTH_CLIENT_SECRET',
        section: 'required',
        since: 'vor P1',
        purpose: 'Secret zum Google-OAuth-Client',
        defaultValue: '—',
        consequence: '/auth/google/login wirft, niemand kann sich anmelden',
        rules: AUTH_RULES,
    },
    {
        name: 'GOOGLE_OAUTH_REDIRECT_BASE',
        section: 'required',
        since: 'vor P1',
        purpose: 'Basis der redirect_uri (<base>/auth/google/callback), ohne Slash am Ende',
        defaultValue: 'http://localhost:3000',
        consequence: 'Google leitet nach localhost zurueck, Login tot',
        rules: [{ in: DEPLOYED, level: 'required', when: 'notLocalMode' }],
    },
    {
        name: 'MCP_BASE_URL',
        section: 'required',
        since: 'vor P1',
        purpose: 'Oeffentliche URL: OAuth-Discovery, Token-Issuer, Landing-Links',
        defaultValue: 'Discovery/Landing: Request-Host; Token-Issuer: http://localhost:3000',
        consequence: 'Tokens tragen iss=http://localhost:3000',
        rules: [{ in: DEPLOYED, level: 'recommended', when: 'notLocalMode' }],
    },

    // --- 2. Betrieb und Grenzen -------------------------------------------------------------------
    {
        name: 'NODE_ENV',
        section: 'operations',
        since: 'vor P1',
        purpose: 'development | integration | production; waehlt .env-Dateien, Registry, Guards (setzen die npm-Skripte)',
        defaultValue: 'development',
        consequence: 'gilt als development',
    },
    {
        name: 'PORT',
        section: 'operations',
        since: 'vor P1',
        purpose: 'HTTP-Port (Bind an 0.0.0.0); Render setzt ihn selbst',
        defaultValue: '3000',
        consequence: 'Port 3000',
    },
    {
        name: 'PUBLIC_API_BASE_URL',
        section: 'operations',
        since: 'vor P1',
        purpose: 'API-Basis fuer die UI (Swagger-Links, window.open); beim UI-Build eingebacken',
        defaultValue: 'leer = same-origin',
        consequence: 'UI nutzt den Origin des Browsers',
    },
    {
        name: 'SESSION_COOKIE_SECURE',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Secure-Flag des Session-Cookies',
        defaultValue: 'true in integration/production, sonst false',
        consequence: 'Default nach NODE_ENV',
    },
    {
        name: 'SESSION_STORE_MAX',
        section: 'operations',
        since: 'P9',
        purpose:
            'Hoechstzahl gehaltener Sessions im Prozess-Speicher; darueber gehen zuerst unangemeldete (Login angefangen), dann die aeltesten',
        defaultValue: '10000',
        consequence: 'Default',
    },
    {
        name: 'SESSION_PENDING_TTL_MS',
        section: 'operations',
        since: 'P9',
        purpose: 'Lebensdauer einer Session ohne Login (nur PKCE/Beta-Key aus /auth/google/login) seit dem letzten Zugriff',
        defaultValue: '900000 (15 min)',
        consequence: 'Default',
    },
    {
        name: 'TRUST_PROXY_HOPS',
        section: 'operations',
        since: 'P9',
        purpose:
            'Proxy-Hops vor der App (express trust proxy): macht req.ip zur Client-IP fuer die Sperre je Quelle; zu hoch = X-Forwarded-For faelschbar, zu niedrig = alle Anonymen eine Quelle',
        defaultValue: '1 in integration/production, sonst 0; lokaler Modus immer 0 (> 0 = Exit 79)',
        consequence: 'Default nach NODE_ENV',
    },
    {
        name: 'SLOPDOGS_MODE',
        section: 'operations',
        since: 'Spur L',
        purpose:
            'local = lokaler Modus auf dem Pi (nur mit NODE_ENV=production): kein Login, nur LAN, ein gemeinsamer Nutzer; jeder andere Wert bricht ab',
        defaultValue: 'leer = heutiges Verhalten',
        consequence: 'kein lokaler Modus',
    },
    {
        name: 'SLOPDOGS_LOCAL_ALLOW_CONTAINER',
        section: 'operations',
        since: 'Spur L',
        purpose:
            '1 = lokaler Modus darf im Container laufen (Docker/Podman/LXC); Portfreigaben koennen Internet-Clients als LAN-Clients ausgeben — Warnung beim Start',
        defaultValue: 'leer = Container bricht ab (Exit 79)',
        consequence: 'Exit 79 im Container',
    },
    {
        name: 'LOCAL_ALLOWED_HOSTS',
        section: 'operations',
        since: 'Spur L',
        purpose: 'Weitere Host-Namen der Netzgrenze (dev und lokal), kommagetrennt: name (mit PORT) oder name:port, IPv6 in []',
        defaultValue: 'hostname, hostname.local, Interface-IPs, localhost, 127.0.0.1, [::1] mit PORT (dev: + DEV_UI_ORIGIN-Port)',
        consequence: 'nur die Defaults, andere Host-Header/Origins 403',
    },
    {
        name: 'LOCAL_SECRETS_FILE',
        section: 'operations',
        since: 'Spur L',
        purpose:
            'start:local: Datei, in der SESSION_SECRET und KEYSTORE_MASTER_KEY_V1 beim ersten Start erzeugt werden (0600, nie im Repo)',
        defaultValue: '~/.slopdogs/local-secrets.env',
        consequence: 'Default-Pfad',
    },
    {
        name: 'CORS_ALLOWED_ORIGINS',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Erlaubte Browser-Origins, kommagetrennt (hat Vorrang; nicht im lokalen Modus)',
        defaultValue: 'dev: Namen der Netzgrenze; deployed: gleicher Host',
        consequence: 'Default-Regel',
    },
    {
        name: 'CORS_ORIGIN',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Ein fester erlaubter Origin (nur integration/production)',
        defaultValue: 'DEV_UI_ORIGIN, sonst gleicher Host',
        consequence: 'Default-Regel',
    },
    {
        name: 'DEV_UI_ORIGIN',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Lokale Angular-UI (Redirect von /); deployed Ersatz fuer CORS_ORIGIN',
        defaultValue: 'http://localhost:4300',
        consequence: 'Default',
    },
    {
        name: 'DB_CONNECTION_LIMIT',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Verbindungen je Prisma-Pool (nur Postgres); ohne Wert 4 je Teil auf derselben URL',
        defaultValue: '4 je Teil (Single-DB 16)',
        consequence: 'Default',
    },
    {
        name: 'DB_POOL_TIMEOUT',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Sekunden Warten auf eine freie Pool-Verbindung (nur Postgres)',
        defaultValue: '20',
        consequence: 'Default',
    },
    {
        name: 'MAX_CONCURRENT_HEAVY_REQUESTS',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Gleichzeitige teure Requests (Listen, run/execute)',
        defaultValue: '8',
        consequence: 'Default',
    },
    {
        name: 'HEAVY_REQUEST_QUEUE_TIMEOUT_MS',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Wartebudget der Heavy-Schlange (Anfragen warten und laufen seriell weiter), erst danach 503 + Retry-After',
        defaultValue: '120000',
        consequence: 'Default',
    },
    {
        name: 'HEAVY_REQUEST_QUEUE_MAX',
        section: 'operations',
        since: 'P9',
        purpose: 'Obergrenze der Heavy-Schlange (inkl. MCP-Laeufe); darueber sofort 503 + Retry-After',
        defaultValue: '50',
        consequence: 'Default',
    },
    {
        name: 'MAX_CONCURRENT_PUBLIC_RUNS',
        section: 'operations',
        since: 'P1',
        purpose: 'Gleichzeitige oeffentliche Kennel-Laeufe (/k/:id, /k/:id/openapi.json)',
        defaultValue: '4',
        consequence: 'Default',
    },
    {
        name: 'PUBLIC_RUN_QUEUE_TIMEOUT_MS',
        section: 'operations',
        since: 'P1',
        purpose: 'Wartebudget der Public-Schlange (Anfragen warten und laufen seriell weiter), erst danach 503 + Retry-After',
        defaultValue: '120000',
        consequence: 'Default',
    },
    {
        name: 'PUBLIC_RUN_QUEUE_MAX',
        section: 'operations',
        since: 'P9',
        purpose: 'Obergrenze der Public-Schlange; darueber sofort 503 + Retry-After',
        defaultValue: '50',
        consequence: 'Default',
    },
    {
        name: 'RUNS_PER_SOURCE_MAX_INFLIGHT',
        section: 'operations',
        since: 'P9',
        purpose: 'Kennel-Laeufe je Quelle (user:<id> bzw. Client-IP) gleichzeitig, aktiv + wartend; darueber 429 + Retry-After',
        defaultValue: '2',
        consequence: 'Default',
    },
    {
        name: 'RUNS_PER_SOURCE_PER_MINUTE',
        section: 'operations',
        since: 'P9',
        purpose: 'Token-Bucket je Quelle: Kennel-Laeufe pro Minute (Nachfuellrate); darueber 429 + Retry-After',
        defaultValue: '20',
        consequence: 'Default',
    },
    {
        name: 'RUNS_PER_SOURCE_BURST',
        section: 'operations',
        since: 'P9',
        purpose: 'Token-Bucket je Quelle: so viele Laeufe duerfen direkt hintereinander starten',
        defaultValue: '6',
        consequence: 'Default',
    },
    {
        name: 'WAVE_CONCURRENCY',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Dogs, die innerhalb einer Welle gleichzeitig laufen',
        defaultValue: '4',
        consequence: 'Default',
    },
    {
        name: 'DOG_WORKER_MAX_HEAP_MB',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Old-Space-Deckel je Dog-Isolate in MB',
        defaultValue: '64',
        consequence: 'Default',
    },
    {
        name: 'DOG_WORKER_GLOBAL_LIMIT',
        section: 'operations',
        since: 'P8',
        purpose: 'Globaler Deckel: gleichzeitige Dog-Isolate ueber ALLE Laeufe (Default auf 512 MB RAM ausgelegt)',
        defaultValue: '2',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_LIMIT_MB',
        section: 'operations',
        since: 'P8',
        purpose: 'Container-RAM-Budget; Bezugsgroesse des Speicher-Waechters (Soft-Limit = 85 %)',
        defaultValue: '512',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_SOFT_LIMIT_MB',
        section: 'operations',
        since: 'P8',
        purpose:
            'RSS-Schwelle: darueber versucht der Waechter vor einem neuen Dog-Isolate GC, wartet auf das Ende anderer Isolate und weist erst dann ab',
        defaultValue: '85 % von MEMORY_LIMIT_MB',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_GUARD',
        section: 'operations',
        since: 'P8',
        purpose: 'Speicher-Waechter erzwingen (1) oder abschalten (0); ohne Wert AN ausser NODE_ENV=development',
        defaultValue: 'auto (AN im Betrieb)',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_GUARD_WAIT_MS',
        section: 'operations',
        since: 'P9',
        purpose:
            'So lange wartet ein Dog ueber dem Soft-Limit auf das Ende anderer Isolate, bevor er abgewiesen wird (0 = sofort abweisen)',
        defaultValue: '30000',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_GUARD_GC_MIN_INTERVAL_MS',
        section: 'operations',
        since: 'P9',
        purpose: 'Mindestabstand zwischen zwei GC-Versuchen des Waechters (global.gc, --expose-gc im Startskript)',
        defaultValue: '2000',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_HARD_LIMIT_MB',
        section: 'operations',
        since: 'OOM-Fix',
        purpose:
            'Schwelle des Laufzeit-Waechters (cgroup-Arbeitsspeicher, sonst RSS): darueber wird das juengste laufende Dog-Isolat beendet (503 statt Container-Kill)',
        defaultValue: 'MEMORY_LIMIT_MB - 96',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_RUNTIME_CHECK_MS',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Takt des Laufzeit-Waechters, solange Dog-Isolate laufen (ms)',
        defaultValue: '100',
        consequence: 'Default',
    },
    {
        name: 'SLOPDOGS_WATCHPOST',
        section: 'operations',
        since: 'OOM-Fix',
        purpose:
            'Wachposten-Thread: meldet Blockaden des Haupt-Threads und Speicher-Stufen 80/90/95 % direkt nach stderr, greift nie ein; 1/true/on erzwingt, 0/false/off schaltet ab',
        defaultValue: 'auto (AN ausser NODE_ENV=development)',
        consequence: 'Default',
    },
    {
        name: 'WATCHPOST_STALL_MS',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Ab so langer Stille des Haupt-Thread-Pulses (ms) meldet der Wachposten eine Blockade (min. 100)',
        defaultValue: '1000',
        consequence: 'Default',
    },
    {
        name: 'WATCHPOST_POLL_MS',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Takt des Wachpostens (ms, 10 bis 1000): Puls pruefen, cgroup lesen',
        defaultValue: '100',
        consequence: 'Default',
    },
    {
        name: 'SLOPDOGS_MEMLOG',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Speicher-Log (Zeile je Kennel-Lauf und Boot-Phase, Heartbeat); 1/true/on erzwingt, 0/false/off schaltet ab',
        defaultValue: 'auto (AN ausser NODE_ENV=development)',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_LOG_INTERVAL_MS',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Messtakt des Speicher-Heartbeats (ms, min. 5000); geschrieben wird nur bei Bewegung oder nach langer Stille',
        defaultValue: '30000',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_LOG_DELTA_MB',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Heartbeat-Zeile erst, wenn sich die RSS seit der letzten Zeile um so viele MB bewegt hat',
        defaultValue: '16',
        consequence: 'Default',
    },
    {
        name: 'MEMORY_LOG_MAX_SILENCE_MS',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Spaetestens nach so langer Stille (ms) schreibt der Heartbeat trotzdem eine Zeile',
        defaultValue: '300000 (5 min)',
        consequence: 'Default',
    },
    {
        name: 'DOG_FETCH_MAX_BODY_MB',
        section: 'operations',
        since: 'OOM-Fix',
        purpose: 'Groesste fetch-Antwort je Dog (MB); darueber fetch_body_too_large (Content-Length oder gezaehlte Bytes)',
        defaultValue: '32',
        consequence: 'Default',
    },
    {
        name: 'SLOPDOGS_VM_TIMEOUT_MS',
        section: 'operations',
        since: 'P2',
        purpose: 'Timeout je SerializedDog-Lauf im Worker (ms); Override je MCP-Aufruf per vmTimeoutMs',
        defaultValue: '10000',
        consequence: 'Default',
        aliases: ['DATADOGS_VM_TIMEOUT_MS'],
    },
    {
        name: 'SLOPDOGS_VM_TIMEOUT_MAX_MS',
        section: 'operations',
        since: 'P9',
        purpose: 'Obergrenze jedes Dog-Timeouts, auch des per MCP gereichten vmTimeoutMs',
        defaultValue: '60000',
        consequence: 'Default',
    },
    {
        name: 'SLOPDOGS_MCP_RATE_LIMIT',
        section: 'operations',
        since: 'P2',
        purpose: 'MCP-Requests je Identitaet und Minute',
        defaultValue: '120',
        consequence: 'Default',
        aliases: ['DATADOGS_MCP_RATE_LIMIT'],
    },
    {
        name: 'SNAPSHOT_CACHE_MAX_MB',
        section: 'operations',
        since: 'P9',
        purpose:
            'Obergrenze (geschaetzte MB) aller Snapshots von refresh_kennel_snapshot/build_kennel im Prozess-Speicher; aelteste fallen zuerst',
        defaultValue: '64',
        consequence: 'Default',
    },
    {
        name: 'CACHE_PRUNE_INTERVAL_MS',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Abstand der Cache-Prune-Laeufe (ms)',
        defaultValue: '300000',
        consequence: 'Default',
    },
    {
        name: 'KENNEL_CALL_FLUSH_MS',
        section: 'operations',
        since: 'P4',
        purpose: 'Abstand der Aufruf-Zaehler-Flushes (ms); Verlust bei SIGKILL <= dieser Wert',
        defaultValue: '30000',
        consequence: 'Default',
    },
    {
        name: 'KENNEL_CALL_MAX_PENDING',
        section: 'operations',
        since: 'P4',
        purpose: 'Deckel ungeflushter Zaehler-Schluessel im Speicher',
        defaultValue: '10000',
        consequence: 'Default',
    },
    {
        name: 'KENNEL_STATS_MEMO_MS',
        section: 'operations',
        since: 'P4',
        purpose: 'Lebensdauer des Aggregat-Memos (Listen, Einzelantworten)',
        defaultValue: '30000',
        consequence: 'Default',
    },
    {
        name: 'LANDING_MEMO_MS',
        section: 'operations',
        since: 'P4',
        purpose: 'Lebensdauer des Memos von GET /api/landing',
        defaultValue: '60000',
        consequence: 'Default',
    },
    {
        name: 'LANDING_HTML_MEMO_MS',
        section: 'operations',
        since: 'P5',
        purpose: 'Lebensdauer der gemerkten Landing-Seite /, danach Refresh im Hintergrund',
        defaultValue: '300000',
        consequence: 'Default',
    },
    {
        name: 'HTTP_COMPRESSION',
        section: 'operations',
        since: 'P6-Fix',
        purpose: 'brotli/gzip fuer Textantworten ab 1 KB; 0 = aus',
        defaultValue: '1',
        consequence: 'an',
    },
    {
        name: 'WS_PATH',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Upgrade-Pfad des Lobby-Hubs',
        defaultValue: '/api/channels',
        consequence: 'Default',
    },
    {
        name: 'WS_HEARTBEAT_SEC',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Heartbeat-Intervall der Lobby (s)',
        defaultValue: '20',
        consequence: 'Default',
    },
    {
        name: 'WS_EMPTY_TTL_SEC',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Leere Lobby-Raeume nach so vielen Sekunden raeumen',
        defaultValue: '300',
        consequence: 'Default',
    },
    {
        name: 'WS_MAX_MESSAGE_BYTES',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Max. Bytes je WebSocket-Nachricht',
        defaultValue: '16384',
        consequence: 'Default',
    },
    {
        name: 'WS_MAX_PEERS_PER_CHANNEL',
        section: 'operations',
        since: 'vor P1',
        purpose: 'Max. Teilnehmer je Lobby',
        defaultValue: '50',
        consequence: 'Default',
    },

    // --- 3. Funktionen ----------------------------------------------------------------------------
    {
        name: 'SLOPDOGS_STAGE',
        section: 'features',
        since: 'Beta',
        purpose: 'Phase des Dienstes; "beta" = Beta-Sticker + Beta-Keys (nur mit Login)',
        defaultValue: 'leer = keine Phase',
        consequence: 'kein Sticker, keine Keys',
    },
    {
        name: 'BETA_ADMIN_EMAILS',
        section: 'features',
        since: 'Beta',
        purpose: 'Google-Adressen, die Beta-Keys verwalten (kommagetrennt)',
        defaultValue: 'leer',
        consequence: 'mit Login verwaltet niemand Keys',
    },
    {
        name: 'LANDING_KENNEL_IDS',
        section: 'features',
        since: 'P6-Fix',
        purpose: 'Kennel-IDs, zwischen denen / rotiert (schreibgeschuetzt, solange gelistet)',
        defaultValue: 'leer = geseedeter slopdogs-landing',
        consequence: 'Default-Landing, dahinter statischer Fallback',
        aliases: ['LANDING_KENNEL_ID'],
    },
    {
        name: 'LEGACY_KENNEL_REDIRECT',
        section: 'features',
        since: 'P3',
        purpose: 'Alte Links /<name> antworten 308 -> /k/<name>; 0 = aus',
        defaultValue: '1',
        consequence: 'an',
    },
    {
        name: 'KEYSTORE_MASTER_KEY_V1',
        section: 'features',
        since: 'P4c',
        purpose: 'AES-256-GCM-Master-Key des User-Key-Stores (64 hex)',
        defaultValue: '—',
        consequence: 'Key-Store aus, POST /api/keys 503',
        rules: [{ in: DEPLOYED, level: 'recommended' }],
    },
    {
        name: 'KEYSTORE_MASTER_KEY_V2',
        section: 'features',
        since: 'P4c',
        purpose: 'Nachfolger fuer die Rotation (allgemein KEYSTORE_MASTER_KEY_V<n>)',
        defaultValue: '—',
        consequence: 'keine Rotation',
    },

    // --- 4. Integrationen -------------------------------------------------------------------------
    // Kommen aus den Dog-Paketen (P2.7): jedes Paket, das Env-Variablen liest, exportiert sie unter <paket>/env.

    // --- 5. Entwicklung ---------------------------------------------------------------------------
    {
        name: 'SLOPDOGS_LOG_LEVEL',
        section: 'development',
        since: 'P2',
        purpose: 'verbose|debug = ausfuehrliche Laufzeit-Logs, quiet|minimal = leise',
        defaultValue: 'leise',
        consequence: 'leise',
        aliases: ['DATADOGS_LOG_LEVEL'],
    },
    {
        name: 'SLOPDOGS_VERBOSE',
        section: 'development',
        since: 'P2',
        purpose: '1 = ausfuehrliche Logs (wenn SLOPDOGS_LOG_LEVEL schweigt)',
        defaultValue: '—',
        consequence: 'leise',
        aliases: ['DATADOGS_VERBOSE'],
    },
    {
        name: 'SLOPDOGS_QUIET',
        section: 'development',
        since: 'P2',
        purpose: '1 = leise erzwingen (wenn SLOPDOGS_LOG_LEVEL schweigt)',
        defaultValue: '—',
        consequence: 'leise',
        aliases: ['DATADOGS_QUIET'],
    },
    {
        name: 'DEBUG',
        section: 'development',
        since: 'vor P1',
        purpose: 'Bibliotheks-Debug (z. B. prisma:query), sehr gespraechig',
        defaultValue: '—',
        consequence: 'aus',
    },
    {
        name: 'RUN_STARTUP_TESTS',
        section: 'development',
        since: 'vor P1',
        purpose: 'Selbsttests nach dem Start: 1 = ueberall, 0 = nie',
        defaultValue: 'nur development',
        consequence: 'nur development',
    },
    {
        name: 'KEYSTORE_SUPERUSER_OWNER',
        section: 'development',
        since: 'P4c',
        purpose: 'Nur development: User-Id, deren Keys Super-User-Laeufe nutzen',
        defaultValue: '—',
        consequence: 'Super-User-Laeufe ohne Keys',
    },
    {
        name: 'PRISMA_SYNC_FORCE_RESET',
        section: 'development',
        since: 'vor P1',
        purpose: 'prisma:sync auf integration: 1 = Reset (loescht Daten)',
        defaultValue: '—',
        consequence: 'kein Reset',
    },
    {
        name: 'MCP_BASE',
        section: 'development',
        since: 'vor P1',
        purpose: 'Gateway-Test (test:mcp:integration): Basis-URL',
        defaultValue: 'http://127.0.0.1:3000',
        consequence: 'Default',
    },
    {
        name: 'MCP_PATH',
        section: 'development',
        since: 'vor P1',
        purpose: 'Gateway-Test: MCP-Pfad',
        defaultValue: '/mcp',
        consequence: 'Default',
    },
    {
        name: 'MCP_BEARER',
        section: 'development',
        since: 'vor P1',
        purpose: 'Gateway-Test: Bearer-Token',
        defaultValue: '—',
        consequence: 'anonym',
    },
    {
        name: 'SLOPDOGS_MCP_BEARER',
        section: 'development',
        since: 'P2',
        purpose: 'Gateway-Test: Bearer-Token (nach MCP_BEARER)',
        defaultValue: '—',
        consequence: 'anonym',
        aliases: ['DATADOGS_MCP_BEARER'],
    },
    {
        name: 'KENNEL_ID',
        section: 'development',
        since: 'vor P1',
        purpose: 'Gateway-Test: Ziel-Kennel',
        defaultValue: 'weather-kennel',
        consequence: 'Default',
    },

    // --- 6. Intern (nicht setzen) -----------------------------------------------------------------
    {
        name: 'NODE_OPTIONS',
        section: 'internal',
        since: 'vor P1',
        purpose: 'Heap-Flag steht fest im Startbefehl (package.json), nicht in .env',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'NODE_TLS_REJECT_UNAUTHORIZED',
        section: 'internal',
        since: 'vor P1',
        purpose: 'Liest Node selbst; 0 schaltet TLS-Pruefung ab — nie in production',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'DOTENV_CONFIG_DEBUG',
        section: 'internal',
        since: 'vor P1',
        purpose: 'Nur fuer -r dotenv/config; load-env.cjs liest es nicht',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'PRISMA_DISABLE_WARNINGS',
        section: 'internal',
        since: 'vor P1',
        purpose: 'Liest Prisma selbst (wie PRISMA_CLIENT_* und PRISMA_QUERY_ENGINE_*)',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'NO_COLOR',
        section: 'internal',
        since: 'vor P1',
        purpose: 'Terminal-Farben der Bibliotheken (wie TERM_PROGRAM, PATH)',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'RENDER',
        section: 'internal',
        since: 'Spur L',
        purpose: 'Setzt Render selbst; mit SLOPDOGS_MODE=local bricht der Start ab (Exit 79)',
        defaultValue: '—',
        consequence: '—',
    },
    {
        name: 'PRISMA_SYNC_PUSH_ONLY',
        section: 'internal',
        since: 'Spur L',
        purpose: 'Setzt run-prisma-sync.cjs --push-only fuer seine Helfer (db push mit --skip-generate)',
        defaultValue: '—',
        consequence: '—',
    },
];

/** Die Env-Variablen eines installierten Dog-Pakets, mit seinem Namen. */
export interface DogPackageEnv {
    packageName: string;
    envVars: readonly EnvVarSpec[];
}

/**
 * Liest die Env-Metadaten aller installierten SlopDogs-Pakete: jede Abhaengigkeit `@martinschmieschek/slopdogs-*`
 * aus der package.json des Servers, die einen Einstieg `./env` anbietet, wird mit `require('<paket>/env')` geladen.
 * Nur diese kleine Datei — die Dogs des Pakets laedt das nicht (der slim-Registry bleibt schlank). Aufgeloest wie zur
 * Laufzeit (Workspace-Link, node_modules), nicht ueber einen Ordner packages/.
 */
export function loadDogPackageEnv(rootDir: string = serverRootDir()): DogPackageEnv[] {
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    const out: DogPackageEnv[] = [];
    for (const name of Object.keys(manifest.dependencies ?? {})) {
        if (!name.startsWith('@martinschmieschek/slopdogs-')) continue;
        const pkgJson = require.resolve(`${name}/package.json`, { paths: [rootDir] });
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as { exports?: Record<string, unknown> };
        if (!pkg.exports || !('./env' in pkg.exports)) continue;
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Paketname steht erst zur Laufzeit fest
        const mod = require(require.resolve(`${name}/env`, { paths: [rootDir] })) as { envVars?: readonly EnvVarSpec[] };
        if (!Array.isArray(mod.envVars)) throw new Error(`[env] ${name}/env exportiert kein envVars`);
        out.push({ packageName: name, envVars: mod.envVars });
    }
    return out;
}

/** Der Projekt-Ordner: die naechste package.json oberhalb dieser Datei (Quelle wie dist/server-app). */
function serverRootDir(): string {
    for (let dir = __dirname; ; dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
        if (path.dirname(dir) === dir) throw new Error('[env] package.json des Servers nicht gefunden');
    }
}

/** Die Env-Variablen der installierten Dog-Pakete (beim Laden dieses Moduls gelesen). */
export const DOG_PACKAGE_ENV: readonly DogPackageEnv[] = loadDogPackageEnv();

/**
 * Der ganze Katalog: Server-Eintraege und Paket-Eintraege, nach Abschnitt geordnet (ENV_SECTIONS), innerhalb eines
 * Abschnitts erst der Server, dann die Pakete in der Reihenfolge der package.json. In dieser Reihenfolge stehen sie in
 * beiden .env-Beispielen (scripts/check-env-catalog.cjs).
 */
export const ENV_CATALOG: readonly EnvVarSpec[] = ENV_SECTIONS.flatMap((section) => [
    ...SERVER_ENV_CATALOG.filter((spec) => spec.section === section.id),
    ...DOG_PACKAGE_ENV.flatMap((p) => p.envVars).filter((spec) => spec.section === section.id),
]);

/** Alle Namen des Katalogs, in Katalog-Reihenfolge. */
export const ENV_CATALOG_NAMES: readonly string[] = ENV_CATALOG.map((v) => v.name);

function nodeEnvOf(env: NodeJS.ProcessEnv): NodeEnvName {
    const raw = (env.NODE_ENV || 'development').trim();
    return raw === 'integration' || raw === 'production' ? raw : 'development';
}

function isSet(env: NodeJS.ProcessEnv, name: string): boolean {
    return (env[name] ?? '').trim() !== '';
}

function conditionHolds(env: NodeJS.ProcessEnv, when: EnvCondition | undefined): boolean {
    if (when === 'authRequired') return env.MCP_AUTH_REQUIRED === 'true';
    if (when === 'storeNotPostgres') return !/^postgres(ql)?:\/\//i.test((env.DATABASE_URL || '').trim());
    if (when === 'notLocalMode') return !LocalMode.isEnabled(env);
    return true;
}

function isSatisfied(env: NodeJS.ProcessEnv, spec: EnvVarSpec): boolean {
    // Exakt wie authModeBootError (env.MCP_AUTH_REQUIRED === 'true'), ohne trim.
    if (spec.requiredValue !== undefined) return env[spec.name] === spec.requiredValue;
    return [spec.name, ...(spec.anyOf ?? []), ...(spec.aliases ?? [])].some((n) => isSet(env, n));
}

function labelOf(spec: EnvVarSpec): string {
    if (spec.requiredValue !== undefined) return `${spec.name}=${spec.requiredValue}`;
    return [spec.name, ...(spec.anyOf ?? [])].join(' | ');
}

function collect(env: NodeJS.ProcessEnv, level: EnvRule['level']): EnvVarSpec[] {
    const nodeEnv = nodeEnvOf(env);
    return ENV_CATALOG.filter(
        (spec) =>
            (spec.rules ?? []).some((r) => r.level === level && r.in.includes(nodeEnv) && conditionHolds(env, r.when)) &&
            !isSatisfied(env, spec),
    );
}

/**
 * Eine Zeile je fehlender Pflicht-Variable fuer das NODE_ENV in `env`; leer, wenn alles da ist.
 * Rein: liest nur `env`, schreibt nichts.
 */
export function missingEnvWarnings(env: NodeJS.ProcessEnv): string[] {
    const nodeEnv = nodeEnvOf(env);
    return collect(env, 'required').map((spec) => `[env] missing ${labelOf(spec)} (required in ${nodeEnv}: ${spec.consequence})`);
}

/** Eine Zeile je empfohlener, aber fehlender Variable (kein Fehler, nur ein Preisschild). Rein. */
export function recommendedEnvHints(env: NodeJS.ProcessEnv): string[] {
    const nodeEnv = nodeEnvOf(env);
    return collect(env, 'recommended').map((spec) => `[env] recommended ${labelOf(spec)} not set (${nodeEnv}: ${spec.consequence})`);
}

/** Duenner Aufrufer fuer main.ts: gibt die Zeilen aus, beendet nie. Liefert die Zahl der Pflicht-Zeilen. */
export function warnMissingEnv(env: NodeJS.ProcessEnv = process.env, warn: (line: string) => void = console.warn): number {
    const missing = missingEnvWarnings(env);
    for (const line of [...missing, ...recommendedEnvHints(env)]) warn(line);
    return missing.length;
}
