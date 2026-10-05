import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import {
    ISerializedDogConfig,
    SerializedDog,
    MimicDog,
    type ICacheHandler,
} from '@slopdogs/core';
import { IStore } from '../store/IStore';
import { Controller } from '../api/Controller';
import { KennelController } from '../api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from '../api/routes/ConfigRouteHandler';
import { AclRouteHandler } from '../api/routes/AclRouteHandler';
import { KennelRunHandler } from '../api/routes/KennelRunHandler';
import { KennelSwaggerHandler } from '../api/routes/KennelSwaggerHandler';
import { KennelBundleHandler } from '../api/routes/KennelBundleHandler';
import { KennelRatingHandler } from '../api/routes/KennelRatingHandler';
import { LandingRouteHandler } from '../api/routes/LandingRouteHandler';
import { KeysRouteHandler } from '../api/routes/KeysRouteHandler';
import { BetaRouteHandler } from '../api/routes/BetaRouteHandler';
import { BetaKeys, type BetaKeyPrisma } from '../mcp/auth/betaKeys';
import { KeyStoreService } from '../services/KeyStoreService';
import { NodesRouteHandler } from '../api/routes/NodesRouteHandler';
import { ReadmeRouteHandler } from '../api/routes/ReadmeRouteHandler';
import { StartupTest } from '../StartupTest';
import { PrismaCacheHandler } from '../services/PrismaCacheHandler';
import { withResilientCacheInfra } from '../services/resilientCacheHandler';
import { createPrismaAuthClient } from '../store/createPrismaAuthClient';
import { createSessionMiddleware } from '../mcp/auth/sessions';
import { createAuthRouter } from '../mcp/auth/router';
import { createAuthContextMiddleware } from '../mcp/auth/middleware';
import { createDiscoveryRouter } from '../mcp/auth/discovery';
import { createMcpRouter } from '../mcp/transports/mcp';
import { createActionsRouter } from '../mcp/transports/openapi';
import { KennelSnapshotCache } from '../mcp/snapshots/KennelSnapshotCache';
import { resolveAngularBrowserDir, resolvePublicDir } from './expressPaths';
import { HeavyRequestLimiter } from './heavyRequestLimiter';
import { RunGates } from './runAdmission';
import type { KennelCallCounter } from '../services/KennelCallCounter';
import { KennelStatsService } from '../services/KennelStatsService';
import type { IDogStatsStore, IKennelStatsStore } from '../store/IKennelStatsStore';
import type { DogReferenceIndex } from '../services/DogReferenceIndex';
import { DogStatsService } from '../services/DogStatsService';
import { BaseDogPacks } from '../services/BaseDogPacks';
import type { BaseDogInfo } from '../mcp/tools/types';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';
import { LandingPage } from './LandingPage';
import { ResponseCompression } from './ResponseCompression';

export type CreateHttpApplicationInput = {
    nodeEnv: string;
    devUiOrigin: string;
    /** `__dirname` des Einstiegspunkts (main), für ReadmeRouteHandler und Pfadauflösung. */
    serverRootDir: string;
    nodesStore: IStore;
    kennelsStore: IStore;
    allBaseDogs: any[];
    baseDogsMap: Map<string, new () => any>;
    resolveCacheDatabaseUrl: () => string;
    /** Zaehlt jeden Kennel-Lauf (P4); main.ts besitzt ihn und flusht ihn beim Shutdown. */
    callCounter: KennelCallCounter;
    /** Aufrufe und Sterne (P4) — derselbe Store-Client wie die Kennels, kein eigener Pool. */
    statsStore: IKennelStatsStore;
    /** Referenzindex (P4b): main.ts baut ihn beim Boot neu auf; die Controller melden jede Kopfversion. */
    refIndex: DogReferenceIndex;
    /** Dog-Laeufe und Referenzen (P4b) — derselbe Store-Client. */
    dogStatsStore: IDogStatsStore;
};

export type CreateHttpApplicationResult = {
    app: Application;
    serveBuiltAngular: boolean;
    /**
     * Startet die Selbsttest-Suite. Bewusst NICHT waehrend des Aufbaus ausgefuehrt, sondern als
     * Rueckruf gereicht: main.ts ruft ihn ERST NACH httpServer.listen auf. Wirft nie.
     */
    runStartupTests: () => Promise<void>;
    /**
     * Aufraeum-Zusage fuer die Pools, die NUR hier drin entstehen (Auth-Client, Run-Cache).
     * main.ts kennt sie sonst nicht und koennte sie beim SIGTERM nicht freigeben — eine
     * globale Variable dafuer waere ein schlechterer Handel. Wirft nie.
     */
    disconnect: () => Promise<void>;
    /** Der Key-Store (P4c) — main.ts registriert damit die VM-Capability `keys`. */
    keyStore: KeyStoreService;
};

/**
 * Selbsttests laufen standardmaessig NUR lokal (development): in integration/production schreiben
 * sie Testdaten in die echte Datenbank. Dort nur auf ausdrueckliche Anforderung -- RUN_STARTUP_TESTS=1
 * schaltet sie ueberall ein, RUN_STARTUP_TESTS=0 ueberall aus.
 */
function shouldRunStartupTests(nodeEnv: string): boolean {
    const flag = (process.env.RUN_STARTUP_TESTS || '').trim().toLowerCase();
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return nodeEnv === 'development';
}

/**
 * Proxy-Hops vor der App (siehe `trust proxy` unten). Deployed Default 1 (Render), lokal 0.
 * TRUST_PROXY_HOPS ueberschreibt in beide Richtungen; nur ein Integer >= 0 zaehlt.
 */
export function resolveTrustProxyHops(nodeEnv: string): number {
    const raw = (process.env.TRUST_PROXY_HOPS || '').trim();
    if (raw !== '') {
        const parsed = Number(raw);
        if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
    return nodeEnv === 'production' || nodeEnv === 'integration' ? 1 : 0;
}

/**
 * Baut die Express-App: CORS, JSON, Auth/MCP, /static, umgebungsabhängiges Frontend (dev vs. gebaute SPA),
 * API, Kennel-Run/Swagger/Bundle, SPA-Fallback (nur built UI).
 */
export async function createHttpApplication(input: CreateHttpApplicationInput): Promise<CreateHttpApplicationResult> {
    const { nodeEnv, devUiOrigin, serverRootDir, nodesStore, kennelsStore, allBaseDogs, baseDogsMap } = input;
    const serveBuiltAngular = nodeEnv === 'production' || nodeEnv === 'integration';
    const angularBrowserDir = serveBuiltAngular ? resolveAngularBrowserDir(serverRootDir) : null;

    const frontBinder: HttpFrontEndBinder =
        nodeEnv === 'development'
            ? (await import('./httpFrontEnd.development')).bindHttpFrontEnd
            : (await import('./httpFrontEnd.builtUi')).bindHttpFrontEnd;

    const publicDir = resolvePublicDir(serverRootDir);
    // P5: `/` = Lead-Ausgabe des Landing-Kennels aus dem Memo; den Lauf-Lieferanten bekommt sie unten.
    const landingPage = LandingPage.fromEnv(publicDir);
    const frontCtx: HttpFrontEndContext = { devUiOrigin, angularBrowserDir, publicDir, landingPage };

    const app = express();

    // Hinter Renders TLS-Proxy terminiert HTTPS am Proxy; die App sieht intern HTTP.
    // Ohne `trust proxy` haelt express req.secure fuer false und express-session
    // verweigert das Secure-Cookie -> kein Set-Cookie -> OAuth/PKCE- und
    // Personal-Token-Flow tot. Nur deployed setzen; lokal (development) laeuft
    // alles unveraendert ueber http://localhost ohne Proxy und ohne Login.
    //
    // Fuer req.secure (Secure-Cookie) reicht der letzte Hop: 1. Die CLIENT-IP liefert req.ip auf Render
    // dagegen NICHT: vor der App liegen Renders Cloudflare-Kante UND ein Render-interner Hop (10.x); beide
    // haengen an X-Forwarded-For an, die Zahl der Eintraege schwankt (2 oder 3). Mit 1 Hop ist req.ip der
    // rechteste Eintrag — Kante oder 10.x, nie der Client; mehr Hops sind je nach Form faelschbar.
    // Die Quelle anonymer Kennel-Laeufe kommt deshalb aus ClientAddress (clientAddress.ts): auf Render
    // CF-Connecting-IP (setzt Cloudflare selbst, ein mitgeschickter Wert endet dort mit 403), Schalter
    // CLIENT_IP_HEADER; nur ohne gueltigen Header faellt sie auf req.ip zurueck. Lokal (0 Hops, kein
    // Header-Schalter) ist req.ip die Socket-Adresse. TRUST_PROXY_HOPS=0 schaltet trust proxy ab.
    const trustProxyHops = resolveTrustProxyHops(nodeEnv);
    if (trustProxyHops > 0) {
        app.set('trust proxy', trustProxyHops);
    }

    const isLocalDevOrigin = (origin: string): boolean => {
        try {
            const u = new URL(origin);
            return (
                (u.protocol === 'http:' || u.protocol === 'https:') &&
                (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
            );
        } catch {
            return false;
        }
    };

    const originMatchesRequestHost = (req: any, origin: string): boolean => {
        try {
            const hostHeader = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
            if (!hostHeader) return false;
            return new URL(origin).host.toLowerCase() === hostHeader.toLowerCase();
        } catch {
            return false;
        }
    };

    const allowedOriginForRequest = (req: any): string | undefined => {
        const origin = req.headers.origin as string | undefined;
        if (!origin) return undefined;

        const list = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
        if (list?.length) {
            return list.includes(origin) ? origin : undefined;
        }

        if (nodeEnv === 'production' || nodeEnv === 'integration') {
            const fixedRaw = process.env.CORS_ORIGIN ?? process.env.DEV_UI_ORIGIN;
            if (fixedRaw?.trim()) {
                const fixed = fixedRaw.replace(/\/$/, '');
                return origin === fixed ? origin : undefined;
            }
            return originMatchesRequestHost(req, origin) ? origin : undefined;
        }

        return isLocalDevOrigin(origin) ? origin : undefined;
    };

    app.use((req: any, res: any, next: any) => {
        const allow = allowedOriginForRequest(req);
        if (allow) {
            res.setHeader('Access-Control-Allow-Origin', allow);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    });

    // Kompression (brotli/gzip) fuer alles Textartige — vor /static, der Landing, der SPA und jeder Route.
    // SSE (/mcp) und der WebSocket-Hub bleiben ungepackt; HTTP_COMPRESSION=0 schaltet ab.
    const compression = ResponseCompression.fromEnv();
    if (compression) app.use(compression.middleware());

    app.use(express.json({ limit: '5mb' }));

    const authPrisma = createPrismaAuthClient();
    // Key-Store (P4c): im Auth-Client, Master-Key aus der Env; ohne KEYSTORE_MASTER_KEY_V1 aus (503).
    const keyStore = KeyStoreService.fromEnv(authPrisma);
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(createSessionMiddleware());
    app.use(createAuthContextMiddleware(authPrisma));
    // Ein Satz Toepfe fuer den Prozess (siehe Schleuse unten). Die Client-IP haengt am Auth-Kontext, damit
    // anonyme In-Process-Laeufe (MCP/Actions) dieselbe Quelle bekommen wie HTTP.
    const runGates = RunGates.fromEnv();
    app.use(runGates.clientAddress.contextMiddleware());
    app.use('/auth', createAuthRouter(authPrisma));
    app.use('/.well-known', createDiscoveryRouter());

    // Schleuse vor den teuren Pfaden — MUSS vor allen Route-Handlern montiert sein.
    // Body-Limits deckeln nur die Eingabe; die Spitze entsteht durch parallele Runs
    // und Listen-Abfragen, die gleichzeitig im Heap stehen. EIN Satz Toepfe fuer den Prozess:
    // HTTP und MCP (run_kennel, execute_kennel, refresh_kennel_snapshot, build_kennel) teilen
    // den Heavy-Topf und die Sperre je Quelle.
    HeavyRequestLimiter.heavy(runGates).applyTo(app);
    // Zweiter Topf fuer oeffentliche Kennel-Laeufe (/k/:id, /k/:id/openapi.json): Besucher
    // warten nicht vor der UI, die UI nicht hinter Besuchern. Vor /static und dem SPA-Fallback.
    HeavyRequestLimiter.publicRuns(runGates).applyTo(app);

    if (publicDir) {
        app.use('/static', express.static(publicDir));
    }

    frontBinder.beforeControllers(app, frontCtx);

    const registry = new ControllerRegistry();
    // P4b: beide Controller melden jede neue Kopfversion an den Referenzindex (Konstruktor-Option).
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name, true, { refIndex: input.refIndex });
    const kennelsController = new KennelController(kennelsStore, { refIndex: input.refIndex });
    registry.register('nodes', nodesController);
    registry.register('kennels', kennelsController);

    // P4: stats an jeder Kennel-Antwort. Ein Flush und ein Kennel-Delete machen das Memo ungueltig.
    const kennelStats = new KennelStatsService(input.statsStore, input.callCounter);
    kennelsController.setStatsJanitor(kennelStats);

    // P4b: stats an jeder Dog-Antwort — derselbe Store-Client, dasselbe Zaehler-Objekt. Ein Flush, eine
    // Referenz-Aenderung (Save/Delete/Rebuild) und eine Bewertung machen das Memo ungueltig.
    // Die Kopfversionen aller Dogs — SerializedDogs UND MimicDogs (nodesController.listLatest kennt nur
    // den ersten Typ). Nur gelesen: fuer usage.dependents und die provenDogs der Landing. Traegt eine
    // Lineage Zeilen beider Typen, gilt der SerializedDog-Kopf (so wie list_nodes ihn zeigt).
    const mimicsReader = new Controller<ISerializedDogConfig>(nodesStore, MimicDog.name);
    const listAllDogs = async (): Promise<any[]> => {
        const [serialized, mimics] = await Promise.all([nodesController.listLatest(), mimicsReader.listLatest()]);
        const byLineage = new Map<string, any>();
        for (const dog of [...(serialized.data ?? []), ...(mimics.data ?? [])]) {
            const key = (dog as any).lineageId || dog.id;
            if (key && !byLineage.has(key)) byLineage.set(key, dog);
        }
        return [...byLineage.values()];
    };
    const dogStats = new DogStatsService(
        input.dogStatsStore,
        input.callCounter,
        kennelStats,
        {
            listKennels: async () => (await kennelsController.listLatest()).data ?? [],
            listDogs: listAllDogs,
        },
        () => input.refIndex.referenceRows,
    );
    input.refIndex.onChange(() => dogStats.invalidate());
    input.callCounter.setOnFlushed(() => {
        kennelStats.invalidate();
        dogStats.invalidate();
    });

    // Die Selbsttest-Suite lief frueher GENAU HIER -- vor dem Montieren aller Routen und vor
    // httpServer.listen. Ein Fehlschlag, ein stiller Kill oder auch nur eine lange Laufzeit hat
    // damit den ganzen Dienst am Hochkommen gehindert: die Plattform sah keinen offenen Port und
    // startete in einer Schleife neu. Ein Selbsttest darf einen Dienst niemals am Start hindern.
    // Deshalb wird er nur noch als Rueckruf gereicht und von main.ts NACH dem Port-Bind gestartet.
    const runStartupTests = async (): Promise<void> => {
        if (!shouldRunStartupTests(input.nodeEnv)) {
            console.log(`[StartupTest] uebersprungen (NODE_ENV=${input.nodeEnv}) -- mit RUN_STARTUP_TESTS=1 erzwingbar.`);
            return;
        }
        try {
            const startupTest = new StartupTest();
            await startupTest.runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap, app, authPrisma, keyStore);
        } catch (err) {
            // Laut scheitern, aber weiterlaufen -- der Dienst ist wichtiger als seine Selbstpruefung.
            console.error('[StartupTest] Suite abgebrochen -- der Dienst laeuft weiter:', err);
        }
    };

    const nodesRouteHandler = new NodesRouteHandler(registry, allBaseDogs, dogStats);
    nodesRouteHandler.registerRoutes(app);
    const readmeRouteHandler = new ReadmeRouteHandler(serverRootDir);
    readmeRouteHandler.registerRoutes(app);

    // Landing-Daten (P4) VOR /api/:subpath — sonst antwortet dort der Controller-404. Keine Bremse.
    // P4b: provenDogs aus denselben Kopfversionen und demselben Dog-Memo wie list_nodes.
    new LandingRouteHandler(kennelsController, kennelStats, {
        listDogs: listAllDogs,
        dogStats,
    }).registerRoutes(app);
    // Key-Store (P4c): /api/keys und /api/keys/:alias — ebenfalls VOR /api/:subpath.
    new KeysRouteHandler(keyStore).registerRoutes(app);
    // Beta (SLOPDOGS_STAGE=beta, Beta-Keys): /api/beta, /api/beta/keys, /api/beta/keys/:id — ebenfalls VOR /api/:subpath.
    new BetaRouteHandler(new BetaKeys(authPrisma as unknown as BetaKeyPrisma)).registerRoutes(app);
    const stage = BetaKeys.stage();
    console.log(BetaKeys.required()
        ? '[beta] SLOPDOGS_STAGE=beta, Auth an: jedes Google-Konto braucht einmal einen Beta-Key'
        : `[beta] Stage ${stage || '(keine)'}: Anmeldung ohne Beta-Key${stage === BetaKeys.BETA_STAGE ? ' (Auth aus, lokal)' : ''}`);

    const routeHandler = new ConfigRouteHandler(registry, kennelsStore, kennelStats, dogStats);
    routeHandler.registerRoutes(app, '/api');
    // Rechte v2 (P3.5): /api/:subpath/:id/acl, …/acl/transfer, …/freeze, …/unfreeze.
    const aclRouteHandler = new AclRouteHandler(kennelsController, nodesController, authPrisma);
    aclRouteHandler.registerRoutes(app);

    // Die rohe Referenz bleibt erhalten: die Resilienz-Huelle reicht disconnect() nicht
    // durch, und nur der Handler selbst kennt seinen Pool und seinen Prune-Timer.
    const prismaCacheHandler = new PrismaCacheHandler(input.resolveCacheDatabaseUrl());
    const cacheHandler: ICacheHandler = withResilientCacheInfra(prismaCacheHandler);

    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, cacheHandler, callCounter: input.callCounter });
    landingPage.useRunner(kennelRunHandler);
    const kennelSwaggerHandler = new KennelSwaggerHandler(kennelRunHandler, nodesStore);
    const kennelBundleHandler = new KennelBundleHandler(kennelRunHandler, kennelsController, nodesStore, baseDogsMap);

    // Abhaengigkeits-Klassen -> blanke Namen. Pacts tragen ihren wahren Namen am Konstruktor
    // (createPact setzt ihn per defineProperty), Dog-Klassen ohnehin -- es muss also nichts
    // instanziiert werden und nichts kann dabei werfen.
    const dependencyNames = (list: unknown): string[] => {
        if (!Array.isArray(list)) return [];
        const out: string[] = [];
        for (const dep of list) {
            const depName = (dep as any)?.name;
            if (typeof depName === 'string' && depName) out.push(depName);
        }
        return out;
    };

    // Der Vertrag muss mit: ohne parentsRequired/-Optional sieht ein Agent zwar die Namen der
    // Hunde, kann sie aber nicht verdrahten (frueher standen hier hartcodiert leere Arrays).
    // Das Paket (`pack`, P6) haengt an der Klasse — hier, solange die echte Instanz noch da ist;
    // list_nodes sieht danach nur noch das flache Objekt (dieselbe Ableitung wie GET /api/nodes).
    const packs = BaseDogPacks.fromLoadedModules();
    const baseDogsList: BaseDogInfo[] = allBaseDogs.map((dog) => {
        // Infrastruktur-Dogs tragen ihre Verdrahtungs-Anweisung als statisches Feld an der
        // Klasse (siehe WebSocketChannelRetriever.mcpGuidance). Von dort reist sie bis in
        // list_nodes und in den initialize-Brief -- eine Quelle, kein zweiter Ort zum Verrotten.
        const guidance = (dog as any)?.constructor?.mcpGuidance;
        const pack = packs.packOf(dog);
        return {
            id: 'base:' + dog.name,
            name: dog.name,
            description: dog.description,
            type: 'BaseDog' as const,
            icon: dog.icon,
            parentsRequired: dependencyNames((dog as any).required),
            parentsOptional: dependencyNames((dog as any).optional),
            ...(typeof guidance === 'string' && guidance ? { guidance } : {}),
            ...(pack ? { pack } : {}),
        };
    });

    // Pacts leben NUR in baseDogsMap, nie in allBaseDogs -- ohne sie kann ein Agent nicht
    // erkennen, welcher Vertrag hinter einem parentsRequired-Eintrag steckt und wie er zu
    // erfuellen ist. Deshalb wandern sie hier mit in die Entdeckungs-Liste.
    const knownBaseDogNames = new Set(baseDogsList.map((b) => b.name));
    for (const [dogName, DogClass] of baseDogsMap.entries()) {
        if (knownBaseDogNames.has(dogName)) continue;
        if ((DogClass as any)?.__isPact !== true) continue;
        const typeDef = (DogClass as any).__pactReturnTypeDef ?? (DogClass as any).__pactSourceTypeName;
        const shape = typeof typeDef === 'string' && typeDef ? ` Expected shape: ${typeDef}` : '';
        baseDogsList.push({
            id: 'base:' + dogName,
            name: dogName,
            description: `Pact -- a contract, not a data source. Fulfil it with a MimicDog (dogs[].imitates) or a dog that provides it.${shape}`,
            type: 'BaseDog' as const,
            parentsRequired: [],
            parentsOptional: [],
            isPact: true,
            ...(typeof typeDef === 'string' && typeDef ? { pactTypeDef: typeDef } : {}),
        });
    }
    const snapshotCache = new KennelSnapshotCache();
    const toolDeps = {
        kennelsController,
        nodesController,
        kennelRunHandler,
        kennelsStore,
        nodesStore,
        prisma: authPrisma,
        baseDogsList,
        projectRoot: serverRootDir,
        snapshotCache,
        kennelStats,
        callCounter: input.callCounter,
        dogStats,
        keyStore,
        runGates,
    };
    app.use('/mcp', createMcpRouter(toolDeps));
    app.use('/actions', createActionsRouter(toolDeps));

    kennelSwaggerHandler.registerRoutes(app);
    kennelBundleHandler.registerRoutes(app);
    kennelRunHandler.registerRoutes(app);
    // Sterne (P4): /api/kennels/:id/rating — anderes Literal als /versions und /run, keine Kollision.
    new KennelRatingHandler(kennelsController, kennelStats).registerRoutes(app);

    frontBinder.afterKennelRoutes(app, frontCtx);

    // Jeder Disconnect fuer sich gekapselt: ein sterbender Pool darf den naechsten
    // nicht mit in die Tiefe ziehen.
    const disconnect = async (): Promise<void> => {
        await Promise.allSettled([
            prismaCacheHandler.disconnect(),
            authPrisma.$disconnect(),
        ]);
    };

    return { app, serveBuiltAngular, runStartupTests, disconnect, keyStore };
}
