// Ahoy, ye who peer into this abyss — 'tis the beating black heart of the ship.
// From brooding gulfs are we beheld by that which bears no name,
// yet we set sail regardless, for the data must be plundered.
// Env: `node -r ./scripts/load-env.cjs …` (see package.json: start / start:prod / dev).
// Express-App und umgebungsabhängiges Frontend: `server-app/createHttpApplication.ts`.

// Should the void swallow a promise whole and leave no trace, at least we shall log its dying scream.
// Den GANZEN Fehler ausgeben, nicht nur die Nachricht: ohne Stacktrace ist im Log-Stream einer
// Plattform nicht zu erkennen, wo die Zusage gestorben ist.
process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason instanceof Error ? reason.stack || reason.message : reason);
});

// Ohne diesen Handler stirbt der Prozess bei einem synchronen Fehler zwar mit Stacktrace, aber ohne
// erkennbare Marke im Log. Mit ihm steht im Stream eine eindeutige Zeile -- und der Prozess geht
// danach kontrolliert und mit klarem Exit-Code, statt in undefiniertem Zustand weiterzulaufen.
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
});

import { WebSocketChannelRetriever, registerVmGlobalCapability, setVmConsoleSink } from '@slopdogs/core';
import http from 'http';
import fs from 'fs';
import { ChannelHub } from './services/ChannelHub';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import { JsonStorageService } from './services/JsonStorageService';
import path from 'path';
import { runSeeds } from './seed-data/seed';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { CompilerCache } from './services/CompilerCache';
import { createHttpApplication } from './server-app/createHttpApplication';
import { EX_CONFIG, authModeBootError } from './mcp/auth/middleware';
import { warnMissingEnv } from './server-app/startupEnvCheck';
import { KennelCallCounter } from './services/KennelCallCounter';
import { DogReferenceIndex } from './services/DogReferenceIndex';
import { KeysCapability, scrubbingConsoleSink } from './services/keysCapability';
import { logBootMemory } from './api/utils/memoryLog';
import { Watchpost } from './services/Watchpost';
import {
    assertSlimRegistryCoversKennelDbRefs,
    collectBaseDogNamesFromLatestKennels,
} from './server-app/slimRegistryKennelCoverage';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dbEnv = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
    assertRequiredDbEnv: () => void;
    resolveStoreDatabaseUrl: () => string;
    resolveCacheDatabaseUrl: () => string;
    resolveJsonStorageDatabaseUrl: () => string;
};

// Cast off the moorings — if our vessel fails to launch, we sink into the deep and trouble no man further.
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    // Vor allem anderen — vor der Datenbank und vor createHttpApplication: ein Dienst, in dem
    // jeder Besucher Super-User ist, darf ausserhalb von dev gar nicht erst hochkommen (P3.5).
    const bootError = authModeBootError(process.env, (line) => console.log(line));
    if (bootError) {
        console.error(bootError);
        process.exit(EX_CONFIG);
    }
    // Eine Zeile je fehlender Pflicht-Env (Katalog: server-app/startupEnvCheck.ts) — warnt nur, beendet nie.
    warnMissingEnv(process.env);

    // Wachposten (eigener Thread): sieht Blockaden des Haupt-Threads und den Speicher der cgroup auch dann,
    // wenn hier kein Timer mehr feuert — ab jetzt, damit Seeds und Referenzindex schon ueberwacht sind.
    Watchpost.startShared();

    dbEnv.assertRequiredDbEnv();
    const dbUrl = dbEnv.resolveStoreDatabaseUrl();

    // One store, two anchor lines — hounds and kennels lie in the same hold (table `Dog`),
    // so they share one grip on the deep. Zwei PrismaStore auf derselben URL waren zwei
    // Connection-Pools fuer dieselbe Tabelle; einer genuegt.
    const store = new PrismaStore(dbUrl);
    const nodesStore: IStore = store;
    const kennelsStore: IStore = store;

    // Rouse the store from its slumber lest the connection rot in the bilge.
    await store.init();

    // Plant the first bones in the earth — the seeds from which our pack shall grow.
    await runSeeds(nodesStore, kennelsStore);
    logBootMemory('Seeds');

    // Aufrufe je Kennel (P4): im Speicher gezaehlt, alle KENNEL_CALL_FLUSH_MS in einer Transaktion
    // geschrieben. Die Tabellen haengen am Store-Client — kein fuenfter PrismaClient.
    const callCounter = new KennelCallCounter(store);
    callCounter.start();

    // Fachliche JSON-Ablage: eigene SQLite (JSON_STORAGE_DATABASE_URL), bewusst getrennt
    // von Nodes/Kennels (DATABASE_URL) und Run-Cache (CACHE_DATABASE_URL).
    //
    // Welle 7: jsonStore ist VM-Infrastruktur, kein Daten-Pakt. Statt einen BaseDog
    // (JsonStorageRetriever) zu registrieren, legen wir die Bruecke direkt als VM-Global-
    // Capability beim Core ab. Jeder SerializedDog sieht `jsonStore` damit automatisch im
    // VM-Context, ohne einen Parent zu deklarieren -- so wie er auch `fetch` und `console`
    // sieht.
    const jsonStorageService = new JsonStorageService(dbEnv.resolveJsonStorageDatabaseUrl());
    // Die Doku reist mit der Registrierung: der MCP kuendigt jsonStore dadurch von
    // selbst an. Ohne das ist er im MCP unsichtbar (kein Dog, kein Node, kein Tool)
    // und ein Agent bastelt sich stattdessen eine eigene Ablage.
    registerVmGlobalCapability('jsonStore', (ctx) => {
        const userId = ctx?.userId ?? null;
        const isSuper = ctx?.isSuperUser === true;
        // SECURITY (2026-09-13): anonymous callers used to get the RAW, unprefixed
        // store — so a public kennel run without a login could snapshot()/list()
        // EVERY user's `user:<id>:*` keys and set() straight into them, overwriting
        // other users' data. Keys must be tenant-scoped for everyone except the
        // super-user (dev/admin). Logged-in users get `user:<id>:`; anonymous callers
        // get a single shared, isolated `anon:` namespace — enough for public-kennel
        // caches, but with no reach into any `user:` key. This is the isolation the
        // MCP tool contract already promised ("Keys sind pro eingeloggtem User isoliert").
        const prefix = isSuper
            ? ''
            : (typeof userId === 'string' && userId.length > 0 ? `user:${userId}:` : 'anon:');
        const usePrefix = prefix !== '';
        const wrap = (k: string) => prefix + k;

        return {
            get: (k: string) => jsonStorageService.get(wrap(k)),
            set: (k: string, v: unknown) => jsonStorageService.set(wrap(k), v),
            delete: (k: string) => jsonStorageService.delete(wrap(k)),
            has: (k: string) => jsonStorageService.has(wrap(k)),
            list: async () => {
                const all = await jsonStorageService.list();
                if (!usePrefix) return all;
                return all
                    .filter((k) => k.startsWith(prefix))
                    .map((k) => k.substring(prefix.length));
            },
            snapshot: async () => {
                const all = await jsonStorageService.snapshot();
                if (!usePrefix) return all;
                return all
                    .filter((e) => e.key.startsWith(prefix))
                    .map((e) => ({ ...e, key: e.key.substring(prefix.length) }));
            },
        };
    },
        'jsonStore.get(key) / .set(key, value) / .delete(key) / .has(key) / .list() / .snapshot() — '
        + 'persistente JSON-Ablage, direkt als Global im Dog-Code verfuegbar (kein Parent noetig, alle Methoden async). '
        + 'Keys sind pro eingeloggtem User isoliert. Nutze sie fuer Caches und Zustand, statt dir eine eigene Ablage zu bauen. '
        + 'Die Ablage ist Klartext: API-Schluessel gehoeren nicht hierher, sondern in den Key-Store (set_key, dann keys.fetch).');

    // Lobby-Hub: In-Memory-Raeume fuer den WebSocketChannelRetriever.
    const channelHub = new ChannelHub({
        heartbeatSec: Number(process.env.WS_HEARTBEAT_SEC) || undefined,
        emptyTtlSec: Number(process.env.WS_EMPTY_TTL_SEC) || undefined,
        maxMessageBytes: Number(process.env.WS_MAX_MESSAGE_BYTES) || undefined,
        maxPeersPerChannel: Number(process.env.WS_MAX_PEERS_PER_CHANNEL) || undefined,
        path: process.env.WS_PATH || undefined,
    });
    WebSocketChannelRetriever.initService(channelHub);

    const nodeEnvForRegistry = process.env.NODE_ENV || 'development';
    /** Nur lokal (development): volle Dog-Registry. Production + Integration: schlanke Registry, weniger Imports/Heap. */
    const useSlimBaseDogRegistry = nodeEnvForRegistry === 'production' || nodeEnvForRegistry === 'integration';
    const registryModule = useSlimBaseDogRegistry
        ? await import('./server-registries/slimDeployRegistry')
        : await import('./server-registries/fullRegistry');
    const { allBaseDogClasses, allPacts } = registryModule;

    // Breathe life into each hound — those who lack their credentials perish in the constructor.
    // The survivors form the pack; the fallen are mourned in the logs.
    const allBaseDogs: InstanceType<typeof allBaseDogClasses[number]>[] = [];
    const baseDogsMap = new Map<string, new () => any>();
    // Dogs, deren Konstruktor wirft (z. B. fehlender API-Key), landen NICHT in
    // baseDogsMap. Ihren Klassennamen merken wir uns, damit der Coverage-Guard
    // sie als "registriert, aber env-bedingt nicht verfuegbar" behandelt und den
    // Start nicht killt — statt sie mit einer echten Registry-Luecke zu verwechseln.
    const unavailableBaseDogNames = new Set<string>();

    for (const DogClass of allBaseDogClasses) {
        try {
            const instance = new DogClass();
            allBaseDogs.push(instance);
            baseDogsMap.set(instance.name, DogClass);
        } catch (err: any) {
            unavailableBaseDogNames.add(DogClass.name);
            console.warn(`  ✗ ${DogClass.name} could not rise — ${err.message}`);
        }
    }

    // The Pacts — aus Registry-Modul (schlank unter production/integration, sonst volle Crew).
    allPacts.forEach(PactClass => {
        const instance = new PactClass();
        baseDogsMap.set(instance.name, PactClass);
    });

    // Wiederverwendung (P4b): wer wen referenziert, aus den Kopfversionen — mit voller baseDogsMap
    // (blanke Klassennamen -> base:X). Gebaut wird erst NACH listen() (siehe unten): der Rebuild war die
    // Speicherspitze des Boots, und ein Fehler kostet nur die Referenzzahlen bis zum naechsten Boot.
    // Bis dahin liest DogStatsService den Tabellenstand des letzten Boots; Controller-Schreibzugriffe
    // waehrend des Rebuilds spielt der Index danach nach (DogReferenceIndex.rebuild).
    const refIndex = new DogReferenceIndex(store, store, baseDogsMap, callCounter);
    logBootMemory('vor Registry-Abgleich');

    const envForTypeDefs = process.env.NODE_ENV;
    if (envForTypeDefs === 'production' || envForTypeDefs === 'integration') {
        const typeDefsPath = path.resolve(process.cwd(), 'dist', 'type-defs.json');
        if (fs.existsSync(typeDefsPath)) {
            try {
                const payload = JSON.parse(fs.readFileSync(typeDefsPath, 'utf-8'));
                CompilerCache.loadPrecomputed(payload);
                console.log(`[CompilerCache] Loaded precomputed type-defs from ${typeDefsPath}`);
            } catch (e) {
                console.error('[CompilerCache] Failed to load precomputed type-defs:', e);
            }
        } else {
            console.warn(`[CompilerCache] ${typeDefsPath} not found — falling back to live TS compilation (heap-heavy).`);
        }
    }

    TypeDefBuilder.registerPacts([...allPacts]);

    if (useSlimBaseDogRegistry) {
        const requiredFromDb = await collectBaseDogNamesFromLatestKennels(kennelsStore);
        assertSlimRegistryCoversKennelDbRefs(requiredFromDb, baseDogsMap, nodeEnvForRegistry, unavailableBaseDogNames);
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const devUiOrigin = (process.env.DEV_UI_ORIGIN || 'http://localhost:4300').replace(/\/$/, '');

    const { app, serveBuiltAngular, runStartupTests, disconnect: disconnectHttpApplication, keyStore } = await createHttpApplication({
        nodeEnv,
        devUiOrigin,
        serverRootDir: __dirname,
        nodesStore,
        kennelsStore,
        allBaseDogs,
        baseDogsMap,
        resolveCacheDatabaseUrl: dbEnv.resolveCacheDatabaseUrl,
        callCounter,
        statsStore: store,
        refIndex,
        dogStatsStore: store,
    });

    // Key-Store (P4c): die zweite VM-Global-Capability neben jsonStore. Sie haengt am Auth-Client, den
    // createHttpApplication besitzt — deshalb erst hier. keys.fetch ersetzt `{{key:<alias>}}` auf dem
    // Host, der Klartext betritt nie die VM. `console` im Dog-Code laeuft ab jetzt ueber die Bridge und
    // wird vor der Ausgabe um die im Lauf benutzten Werte bereinigt (Leck L7).
    new KeysCapability(keyStore).register();
    setVmConsoleSink(scrubbingConsoleSink);

    const port = Number(process.env.PORT) || 3000;

    // Eigener http.Server, damit der ChannelHub seinen WebSocketServer per Upgrade-Handler anhaengen kann.
    const httpServer = http.createServer(app);
    await channelHub.attach(httpServer);

    registerGracefulShutdown({ httpServer, callCounter, store, jsonStorageService, disconnectHttpApplication });

    console.log('App started.');
    logBootMemory('App started');
    // Render u. a.: öffentlich erreichbar nur bei Bind an 0.0.0.0; PORT kommt von der Plattform.
    httpServer.listen(port, '0.0.0.0', () => {
        const base = `http://localhost:${port}`;
        if (!serveBuiltAngular) {
            console.log(`API ${base} — Dev-UI-Redirect: ${base}/ → ${devUiOrigin}/`);
        }
        console.log(`Server läuft auf Port ${port}`);
        // ERST JETZT Referenzindex und Selbsttests: der Port ist offen, die Plattform sieht einen gesunden
        // Dienst. Die Selbsttests warten auf den Rebuild — sie schreiben in dieselbe Referenztabelle.
        // Beide fangen intern alles ab und werfen nie.
        void rebuildReferenceIndex(refIndex).then(() => runStartupTests());
    });
}

/**
 * Drossel fuer den Rebuild nach listen(): nach einem Absturz verbinden sich die MCP-Clients sofort neu und
 * ziehen Listen — der Rebuild soll nicht mit dieser Welle zusammenfallen. Ein Fehler oder eine Verzoegerung
 * kostet nur die Referenzzahlen (health_check.dogStats.referenceRows) bis zum Abschluss.
 */
const REFERENCE_REBUILD_DELAY_MS = 3_000;

async function rebuildReferenceIndex(refIndex: DogReferenceIndex): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, REFERENCE_REBUILD_DELAY_MS));
    try {
        const rebuilt = await refIndex.rebuild();
        console.log(`[DogReferenceIndex] rebuild: ${rebuilt.rows} Referenzen aus ${rebuilt.kennels} Kennels und ${rebuilt.dogs} Dogs in ${rebuilt.durationMs} ms`);
    } catch (err) {
        console.error('[DogReferenceIndex] rebuild gescheitert — Referenzzahlen leer bis zum naechsten Start:', err);
    }
    logBootMemory('Referenzindex gebaut');
    // Der Boot endet hier, nicht bei listen(): der Rebuild laeuft danach.
    Watchpost.shared?.bootFinished();
}

/** Wie lange das Ableben hoechstens dauern darf, ehe wir es erzwingen. */
const SHUTDOWN_GRACE_MS = 10_000;

type ShutdownTargets = {
    httpServer: http.Server;
    callCounter: KennelCallCounter;
    store: PrismaStore;
    jsonStorageService: JsonStorageService;
    disconnectHttpApplication: () => Promise<void>;
};

/**
 * We end as we began — but on our own terms. Ohne diesen Handler stirbt der Prozess bei
 * jedem Redeploy, ohne einen einzigen Connection-Pool zurueckzugeben: die Datenbank haelt
 * die Verbindungen des Toten noch, waehrend der Nachfolger schon seine eigenen aufbaut.
 * Genau dort entsteht das "Timed out fetching a new connection from the connection pool".
 */
function registerGracefulShutdown(targets: ShutdownTargets): void {
    let shuttingDown = false;

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[shutdown] ${signal} empfangen — Port schliessen, Verbindungen freigeben.`);

        // Ein haengender Shutdown ist schlimmer als ein unsauberer: der Not-Aus laeuft
        // unref'd mit, damit er den Prozess nicht kuenstlich am Leben haelt.
        setTimeout(() => {
            console.warn(`[shutdown] Not-Aus nach ${SHUTDOWN_GRACE_MS} ms — Prozess wird beendet.`);
            process.exit(0);
        }, SHUTDOWN_GRACE_MS).unref();

        await new Promise<void>((resolve) => targets.httpServer.close(() => resolve()));

        // Sequenziell VOR den Disconnects: die laufenden Requests sind durch (ihr finally hat
        // gezaehlt), der letzte Flush braucht den Store-Pool noch. stop() wirft nie.
        await targets.callCounter.stop();

        await Promise.allSettled([
            targets.store.disconnect(),
            targets.jsonStorageService.disconnect(),
            targets.disconnectHttpApplication(),
        ]);

        await Watchpost.stopShared();
        console.log('[shutdown] Verbindungen freigegeben.');
        process.exit(0);
    };

    for (const signal of ['SIGTERM', 'SIGINT'] as NodeJS.Signals[]) {
        process.on(signal, () => {
            void shutdown(signal).catch((err) => {
                console.error('[shutdown] gescheitert — Prozess wird trotzdem beendet:', err);
                process.exit(0);
            });
        });
    }
}
