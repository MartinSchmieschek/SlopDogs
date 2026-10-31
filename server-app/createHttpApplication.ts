import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import { type ICacheHandler } from '@martinschmieschek/slopdogs-core';
import { ISerializedDogConfig, SerializedDog, MimicDog, BASE_DOG_PREFIX } from '@martinschmieschek/slopdogs-core/runtime';
import { IStore } from '../store/IStore';
import { Controller } from '../api/Controller';
import { KennelController } from '../api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from '../api/routes/ConfigRouteHandler';
import { AclRouteHandler } from '../api/routes/AclRouteHandler';
import { KennelRunHandler } from '../api/routes/KennelRunHandler';
import { KennelSwaggerHandler } from '../api/routes/KennelSwaggerHandler';
import { KennelBundleHandler } from '../api/routes/KennelBundleHandler';
import { KennelRatingHandler } from '../api/routes/KennelRatingHandler';
import { KennelFavoriteHandler } from '../api/routes/KennelFavoriteHandler';
import { LandingRouteHandler } from '../api/routes/LandingRouteHandler';
import { API_ROUTE } from '../api/routes/routeTable';
import { KeysRouteHandler } from '../api/routes/KeysRouteHandler';
import { BetaRouteHandler } from '../api/routes/BetaRouteHandler';
import { BetaKeys, type BetaKeyPrisma } from '../mcp/auth/betaKeys';
import { KeyStoreService } from '../services/KeyStoreService';
import { NodesRouteHandler } from '../api/routes/NodesRouteHandler';
import { ReadmeRouteHandler } from '../api/routes/ReadmeRouteHandler';
import { PrismaCacheHandler } from '../services/PrismaCacheHandler';
import { withResilientCacheInfra } from '../services/resilientCacheHandler';
import { createPrismaAuthClient, openPrismaAuthClient } from '../store/createPrismaAuthClient';
import type { SharedPrismaClients } from '../store/SharedPrismaClients';
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
import { KennelFavoriteService } from '../services/KennelFavoriteService';
import type { IDogStatsStore, IKennelStatsStore } from '../store/IKennelStatsStore';
import type { DogReferenceIndex } from '../services/DogReferenceIndex';
import { DogStatsService } from '../services/DogStatsService';
import { startMemoryHeartbeat } from '../api/utils/memoryLog';
import { BaseDogPacks, type DogPackage } from '../services/BaseDogPacks';
import { registerBaseDogPackages } from '../services/dogVersions';
import type { BaseDogInfo } from '../mcp/tools/types';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';
import { LandingPage } from './LandingPage';
import { KennelListPage } from './KennelListPage';
import { ResponseCompression } from './ResponseCompression';
import { LOCAL_USER } from './LocalMode';
import { NetworkBoundary } from './NetworkBoundary';
import type { ChannelTickets } from './ChannelTickets';
import type { TestResult } from '../StartupTest';
import { SecurityHeaders } from './SecurityHeaders';
import { SameOriginGuard } from '../mcp/auth/sameOriginGuard';
import { LandingDogLock } from '../services/LandingDogLock';

export type CreateHttpApplicationInput = {
    nodeEnv: string;
    /** Lokaler Modus (Spur L, SLOPDOGS_MODE=local): Netzgrenze LAN, fester lokaler Nutzer, kein OAuth. */
    localMode?: boolean;
    devUiOrigin: string;
    /** `__dirname` des Einstiegspunkts (main), für ReadmeRouteHandler und Pfadauflösung. */
    serverRootDir: string;
    nodesStore: IStore;
    kennelsStore: IStore;
    allBaseDogs: any[];
    baseDogsMap: Map<string, new () => any>;
    resolveCacheDatabaseUrl: () => string;
    /**
     * Der Store-Client fuer Auth und Run-Cache, soweit sie in der Store-Datenbank liegen (P1.4);
     * sonst entstehen hier eigene Clients. Besitzer des Store-Clients bleibt main.ts (store.disconnect()).
     */
    prismaClients: SharedPrismaClients;
    /** Zaehlt jeden Kennel-Lauf (P4); main.ts besitzt ihn und flusht ihn beim Shutdown. */
    callCounter: KennelCallCounter;
    /** Aufrufe und Sterne (P4) — derselbe Store-Client wie die Kennels, kein eigener Pool. */
    statsStore: IKennelStatsStore;
    /** Referenzindex (P4b): main.ts baut ihn beim Boot neu auf; die Controller melden jede Kopfversion. */
    refIndex: DogReferenceIndex;
    /** Dog-Laeufe und Referenzen (P4b) — derselbe Store-Client. */
    dogStatsStore: IDogStatsStore;
    /** Lobby-Tickets fuer Kennel-Seiten unter der Sandbox; die Netzgrenze prueft sie am Hub-Pfad. */
    channelTickets?: ChannelTickets;
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
     * Die Selbsttest-Suite ohne Schalter und ohne Fang: liefert die Ergebnisse, damit
     * `npm run test:startup` daraus einen Exit-Code machen kann. Laedt die Suite erst beim Aufruf.
     */
    runStartupSuite: () => Promise<TestResult[]>;
    /**
     * Aufraeum-Zusage fuer die Pools, die NUR hier drin entstehen (eigener Auth-Client, eigener
     * Run-Cache-Client — im Single-DB-Betrieb keiner, dann stoppt sie nur den Prune-Timer; den
     * geliehenen Store-Client trennt main.ts). main.ts kennt sie sonst nicht und koennte sie beim
     * SIGTERM nicht freigeben — eine globale Variable dafuer waere ein schlechterer Handel. Wirft nie.
     */
    disconnect: () => Promise<void>;
    /** Der Key-Store (P4c) — main.ts registriert damit die VM-Capability `keys`. */
    keyStore: KeyStoreService;
    /** Netzgrenze (Spur L2) fuer den WebSocket-Upgrade; null in integration/production ohne lokalen Modus. */
    networkBoundary: NetworkBoundary | null;
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
 * Der lokale Modus hat nie einen Proxy: immer 0 (der Boot-Guard verweigert TRUST_PROXY_HOPS > 0 ohnehin).
 */
export function resolveTrustProxyHops(nodeEnv: string, localMode = false): number {
    if (localMode) return 0;
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
    const localMode = input.localMode === true;
    const serveBuiltAngular = nodeEnv === 'production' || nodeEnv === 'integration';
    const angularBrowserDir = serveBuiltAngular ? resolveAngularBrowserDir(serverRootDir) : null;

    const frontBinder: HttpFrontEndBinder =
        nodeEnv === 'development'
            ? (await import('./httpFrontEnd.development')).bindHttpFrontEnd
            : (await import('./httpFrontEnd.builtUi')).bindHttpFrontEnd;

    const publicDir = resolvePublicDir(serverRootDir);
    // P5: `/` = Lead-Ausgabe des Landing-Kennels aus dem Memo; den Lauf-Lieferanten bekommt sie unten.
    const landingPage = LandingPage.fromEnv(publicDir);
    // Spur K: `/kennels` = Lead-Ausgabe des Kennels `slopdogs-kennels`; Lauf und Fingerabdruck bekommt sie unten.
    const kennelListPage = KennelListPage.fromEnv();
    const frontCtx: HttpFrontEndContext = { devUiOrigin, angularBrowserDir, publicDir, landingPage, kennelListPage };

    const app = express();

    // Netzgrenze (Spur L2) VOR allem anderen — vor CORS, Landing, /static und jeder Route: Socket-Adresse
    // (nur lokal), Host-Header, Origin bei Schreibzugriffen. Dev und lokal; integration/production: null.
    const networkBoundary = NetworkBoundary.forEnvironment(process.env, {
        nodeEnv,
        localMode,
        devUiOrigin,
        channelTickets: input.channelTickets,
    });
    if (networkBoundary) app.use(networkBoundary.middleware());

    // Hinter Renders TLS-Proxy terminiert HTTPS am Proxy; die App sieht intern HTTP.
    // Ohne `trust proxy` haelt express req.secure fuer false und express-session
    // verweigert das Secure-Cookie -> kein Set-Cookie -> OAuth/PKCE- und
    // Personal-Token-Flow tot. Nur deployed setzen; lokal (development) laeuft
    // alles unveraendert ueber http://localhost ohne Proxy und ohne Login.
    //
    // Dieselbe Einstellung macht req.ip zur Client-IP — die Quelle anonymer Kennel-Laeufe in der
    // Sperre je Quelle (runAdmission.ts). Annahme: zwischen Client und App liegen genau
    // TRUST_PROXY_HOPS Proxys (Render: 1), und der letzte haengt die Adresse seines Gegenuebers an
    // X-Forwarded-For an. Express nimmt dann die Adresse an Position <Hops> von RECHTS — die, die
    // Renders Proxy selbst eingetragen hat. Was ein Client vorne in X-Forwarded-For hineinschreibt,
    // liegt weiter links und wird ignoriert: nicht faelschbar. Steht ein weiterer Proxy davor
    // (z. B. ein CDN), ist die rechte Adresse dessen Kante — dann TRUST_PROXY_HOPS=2. Zu hoch gesetzt,
    // wird die Adresse faelschbar; zu niedrig, teilen sich alle Anonymen die Adresse des Proxys.
    // TRUST_PROXY_HOPS=0 schaltet ab.
    const trustProxyHops = resolveTrustProxyHops(nodeEnv, localMode);
    if (trustProxyHops > 0) {
        app.set('trust proxy', trustProxyHops);
    }

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
        // Lokal: CORS nur fuer die eigenen Namen — dieselbe Liste wie Host- und Origin-Pruefung.
        if (localMode) return networkBoundary?.corsOriginFor(origin);

        const list = process.env.CORS_ALLOWED_ORIGINS?.split(',')
            .map((s) => s.trim())
            .filter(Boolean);
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

        // Dev: frueher jede localhost-Origin jedes Ports — jetzt nur die Namen der Netzgrenze (Server- und UI-Port).
        return networkBoundary?.corsOriginFor(origin);
    };

    // Kopfzeilen fuer jede Antwort und die Sandbox der Kennel-Seiten (SecurityHeaders) — vor allem anderen.
    app.use(new SecurityHeaders().middleware());

    app.use((req: any, res: any, next: any) => {
        const allow = allowedOriginForRequest(req);
        if (allow) {
            res.setHeader('Access-Control-Allow-Origin', allow);
            res.setHeader('Vary', 'Origin');
        } else if (SecurityHeaders.isKennelPath(req.path)) {
            // Kennel-Seiten laufen unter Sandbox mit opakem Origin (`Origin: null`) — ihre Aufrufe an `/k/…` (eigener
            // Kennel, Lesespur, Spec der Doku) sind damit cross-origin. `/k/` ist ohnehin oeffentlich und ohne Cookie
            // gleich dem anonymen Lauf: `*` ohne Allow-Credentials, der Browser gibt keine Antwort mit Cookie frei.
            res.setHeader('Access-Control-Allow-Origin', '*');
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

    const authLease = openPrismaAuthClient(input.prismaClients);
    const authPrisma = authLease.client;
    // Lokaler Modus (Spur L3): der eine Nutzer liegt als echte Zeile in der Auth-DB — grant_access und die
    // ACL-Ansicht loesen ihn auf wie jeden anderen. Idempotent, jeder Boot.
    const localUser = localMode ? await upsertLocalUser(authPrisma) : undefined;
    // Key-Store (P4c): im Auth-Client, Master-Key aus der Env; ohne KEYSTORE_MASTER_KEY_V1 aus (503).
    const keyStore = KeyStoreService.fromEnv(authPrisma);
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(createSessionMiddleware());
    app.use(createAuthContextMiddleware(authPrisma, { localUser }));
    // PAT-Ausgabe/-Widerruf und OAuth-Zustimmung nur von eigenen Seiten — dieselbe Origin-Regel wie CORS oben.
    app.use('/auth', createAuthRouter(authPrisma, new SameOriginGuard((req) => allowedOriginForRequest(req)), { localMode }));
    // Lokal keine OAuth-Discovery: ein MCP-Client soll keinen Login-Weg finden, den es dort nicht gibt.
    if (!localMode) app.use('/.well-known', createDiscoveryRouter());

    // Schleuse vor den teuren Pfaden — MUSS vor allen Route-Handlern montiert sein.
    // Body-Limits deckeln nur die Eingabe; die Spitze entsteht durch parallele Runs
    // und Listen-Abfragen, die gleichzeitig im Heap stehen. EIN Satz Toepfe fuer den Prozess:
    // HTTP und MCP (run_kennel, execute_kennel, refresh_kennel_snapshot, build_kennel) teilen
    // den Heavy-Topf und die Sperre je Quelle.
    const runGates = RunGates.fromEnv();
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
    // Spur U: Favoriten je Nutzer — derselbe Store; Kennel-Delete raeumt sie ueber deleteKennelStats mit.
    const kennelFavorites = new KennelFavoriteService(input.statsStore);

    // P4b: stats an jeder Dog-Antwort — derselbe Store-Client, dasselbe Zaehler-Objekt. Ein Flush, eine
    // Referenz-Aenderung (Save/Delete/Rebuild) und eine Bewertung machen das Memo ungueltig.
    // Die Kopfversionen aller Dogs — SerializedDogs UND MimicDogs (nodesController.listLatest kennt nur
    // den ersten Typ). Nur gelesen: fuer usage.dependents und die provenDogs der Landing. Traegt eine
    // Lineage Zeilen beider Typen, gilt der SerializedDog-Kopf (so wie list_nodes ihn zeigt).
    // Geladen wird je Anfrage und schmal (OOM 2026-10-08): usage nennt seine Lineages, die Landing liest erst
    // die Metadaten aller Dogs und holt description/icon nur fuer die, die sie zeigt. Kein Cache ueber DB-Dogs.
    const mimicsReader = new Controller<ISerializedDogConfig>(nodesStore, MimicDog.name);
    const oneDogPerLineage = (serialized: any[], mimics: any[]): any[] => {
        const byLineage = new Map<string, any>();
        for (const dog of [...serialized, ...mimics]) {
            const key = (dog as any).lineageId || dog.id;
            if (key && !byLineage.has(key)) byLineage.set(key, dog);
        }
        return [...byLineage.values()];
    };
    const listDogsOf = async (lineageIds: string[]): Promise<any[]> => {
        const [serialized, mimics] = await Promise.all([
            nodesController.listLatest(undefined, lineageIds),
            mimicsReader.listLatest(undefined, lineageIds),
        ]);
        const wanted = new Set(lineageIds);
        return oneDogPerLineage(serialized.data ?? [], mimics.data ?? []).filter((d) => wanted.has(d.lineageId || d.id));
    };
    const listDogMeta = async (): Promise<any[]> => {
        const [serialized, mimics] = await Promise.all([nodesController.listLatestMeta(), mimicsReader.listLatestMeta()]);
        return oneDogPerLineage(serialized.data ?? [], mimics.data ?? []);
    };
    const dogStats = new DogStatsService(
        input.dogStatsStore,
        input.callCounter,
        kennelStats,
        {
            listKennels: async (lineageIds) => (await kennelsController.listLatestOf(lineageIds)).data ?? [],
            listDogs: listDogsOf,
        },
        () => input.refIndex.referenceRows,
    );
    input.refIndex.onChange(() => dogStats.invalidate());

    // Besitzerlose Dogs der Landing-Kennels: fuer alle gesperrt (isLandingLocked). Die Menge rechnet LandingDogLock im
    // Hintergrund; bis zur ersten Berechnung gelten besitzerlose Dogs als gesperrt. Neu nach jeder Index-Aenderung.
    new LandingDogLock({
        kennelDogIds: async (kennelId) => {
            const head = await kennelsController.getById(kennelId);
            return head.ok && head.data ? (head.data.dogIds ?? []) : null;
        },
        lineageOf: async (ref) => {
            const normalized = await input.refIndex.normalize(ref);
            return normalized.toKey.startsWith(BASE_DOG_PREFIX) ? null : normalized.toKey;
        },
        dogHeads: listDogsOf,
        onChange: (listener) => input.refIndex.onChange(listener),
    }).start();
    input.callCounter.setOnFlushed(() => {
        kennelStats.invalidate();
        dogStats.invalidate();
    });

    // Die Selbsttest-Suite lief frueher GENAU HIER -- vor dem Montieren aller Routen und vor
    // httpServer.listen. Ein Fehlschlag, ein stiller Kill oder auch nur eine lange Laufzeit hat
    // damit den ganzen Dienst am Hochkommen gehindert: die Plattform sah keinen offenen Port und
    // startete in einer Schleife neu. Ein Selbsttest darf einen Dienst niemals am Start hindern.
    // Deshalb wird er nur noch als Rueckruf gereicht und von main.ts NACH dem Port-Bind gestartet.
    const runStartupSuite = async (): Promise<TestResult[]> => {
        // Erst hier geladen: die Suite samt ihrem Modulgraphen liegt sonst in jedem Prozess im Heap,
        // auch dort, wo sie nie laeuft (integration ohne RUN_STARTUP_TESTS).
        const { StartupTest } = await import('../StartupTest');
        return new StartupTest().runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap, app);
    };
    const runStartupTests = async (): Promise<void> => {
        if (!shouldRunStartupTests(input.nodeEnv)) {
            console.log(`[StartupTest] uebersprungen (NODE_ENV=${input.nodeEnv}) -- mit RUN_STARTUP_TESTS=1 erzwingbar.`);
            return;
        }
        try {
            await runStartupSuite();
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
        listDogMeta,
        listDogsOf,
        dogStats,
    }).registerRoutes(app);
    // Spur K: liefert /kennels gerade den Kennel? Das Signal, mit dem die Angular-App ihre Links auf /kennels zur
    // Vollseiten-Navigation macht — ohne Signal bleibt sie bei ihrer Liste (kein Neuladen im Kreis). VOR /api/:subpath.
    app.get(API_ROUTE.kennelListStatus, (_req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        kennelListPage.status().then(
            (status) => res.json({ ok: true, ...status }),
            () => res.json({ ok: true, active: false, kennelId: kennelListPage.kennelId }),
        );
    });
    // Key-Store (P4c): /api/keys und /api/keys/:alias — ebenfalls VOR /api/:subpath.
    new KeysRouteHandler(keyStore).registerRoutes(app);
    // Beta (SLOPDOGS_STAGE=beta, Beta-Keys): /api/beta, /api/beta/keys, /api/beta/keys/:id — ebenfalls VOR /api/:subpath.
    new BetaRouteHandler(new BetaKeys(authPrisma as unknown as BetaKeyPrisma)).registerRoutes(app);
    const stage = BetaKeys.stage();
    console.log(
        BetaKeys.required()
            ? '[beta] SLOPDOGS_STAGE=beta, Auth an: jedes Google-Konto braucht einmal einen Beta-Key'
            : `[beta] Stage ${stage || '(keine)'}: Anmeldung ohne Beta-Key${stage === BetaKeys.BETA_STAGE ? ' (Auth aus, lokal)' : ''}`,
    );

    const routeHandler = new ConfigRouteHandler(registry, kennelsStore, kennelStats, dogStats, kennelFavorites);
    routeHandler.registerRoutes(app, '/api');
    // Rechte v2 (P3.5): /api/:subpath/:id/acl, …/acl/transfer, …/freeze, …/unfreeze.
    const aclRouteHandler = new AclRouteHandler(kennelsController, nodesController, authPrisma);
    aclRouteHandler.registerRoutes(app);

    // Die rohe Referenz bleibt erhalten: die Resilienz-Huelle reicht disconnect() nicht
    // durch, und nur der Handler selbst kennt seinen Pool und seinen Prune-Timer.
    const prismaCacheHandler = new PrismaCacheHandler(input.prismaClients, input.resolveCacheDatabaseUrl());
    const cacheHandler: ICacheHandler = withResilientCacheInfra(prismaCacheHandler);

    const kennelRunHandler = new KennelRunHandler({
        kennelsController,
        nodesStore,
        baseDogsMap,
        cacheHandler,
        callCounter: input.callCounter,
    });
    landingPage.useRunner(kennelRunHandler);
    kennelListPage.use(kennelRunHandler, {
        kennelHead: async (kennelId) => {
            const head = await kennelsController.getById(kennelId);
            return head.ok && head.data ? { id: String(head.data.id), dogIds: head.data.dogIds ?? [] } : null;
        },
        lineageOf: async (ref) => {
            const normalized = await input.refIndex.normalize(ref);
            return normalized.toKey.startsWith(BASE_DOG_PREFIX) ? null : normalized.toKey;
        },
        dogHeads: listDogsOf,
    });
    // Jede neue Dog- oder Kennel-Version: die naechste Anfrage an /kennels prueft den Fingerabdruck (live anpassbar).
    input.refIndex.onChange(() => kennelListPage.markChanged());
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
        const pkg = packs.packageOf(dog);
        const pack = pkg?.pack;
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
            // P2.5: npm-Name und Version des Pakets, aus dessen package.json (auch unter node_modules).
            ...(pkg ? { packageName: pkg.name, packageVersion: pkg.version } : {}),
        };
    });
    registerBaseDogPackages(allBaseDogs.map((dog) => [dog.name, packs.packageOf(dog)] as [string, DogPackage | null]));

    // Pacts leben NUR in baseDogsMap, nie in allBaseDogs -- ohne sie kann ein Agent nicht
    // erkennen, welcher Vertrag hinter einem parentsRequired-Eintrag steckt und wie er zu
    // erfuellen ist. Deshalb wandern sie hier mit in die Entdeckungs-Liste.
    const knownBaseDogNames = new Set(baseDogsList.map((b) => b.name));
    for (const [dogName, DogClass] of baseDogsMap.entries()) {
        if (knownBaseDogNames.has(dogName)) continue;
        if ((DogClass as any)?.__isPact !== true) continue;
        const typeDef = (DogClass as any).__pactReturnTypeDef ?? (DogClass as any).__pactSourceTypeName;
        const shape = typeof typeDef === 'string' && typeDef ? ` Expected shape: ${typeDef}` : '';
        const pactPkg = packs.packageOf(DogClass);
        baseDogsList.push({
            id: 'base:' + dogName,
            name: dogName,
            description: `Pact -- a contract, not a data source. Fulfil it with a MimicDog (dogs[].imitates) or a dog that provides it.${shape}`,
            type: 'BaseDog' as const,
            parentsRequired: [],
            parentsOptional: [],
            isPact: true,
            ...(typeof typeDef === 'string' && typeDef ? { pactTypeDef: typeDef } : {}),
            ...(pactPkg ? { packageName: pactPkg.name, packageVersion: pactPkg.version } : {}),
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
    // Favoriten (Spur U): /api/kennels/:id/favorite — eigenes Literal, keine Kollision.
    new KennelFavoriteHandler(kennelsController, kennelFavorites).registerRoutes(app);

    frontBinder.afterKennelRoutes(app, frontCtx);

    // Speicher-Heartbeat: Grundstand im Log, nur bei Bewegung oder nach langer Stille (siehe memoryLog.ts).
    startMemoryHeartbeat();

    // Jeder Disconnect fuer sich gekapselt: ein sterbender Pool darf den naechsten
    // nicht mit in die Tiefe ziehen. Geliehene Store-Clients bleiben verbunden (release trennt nur eigene).
    const disconnect = async (): Promise<void> => {
        await Promise.allSettled([prismaCacheHandler.disconnect(), authLease.release()]);
    };

    return { app, serveBuiltAngular, runStartupTests, runStartupSuite, disconnect, keyStore, networkBoundary };
}

async function upsertLocalUser(
    prisma: ReturnType<typeof createPrismaAuthClient>,
): Promise<{ id: string; email: string; name: string | null }> {
    const { id, email, name, googleSub } = LOCAL_USER;
    return prisma.user.upsert({
        where: { id },
        create: { id, email, name, googleSub },
        update: {},
        select: { id: true, email: true, name: true },
    });
}
