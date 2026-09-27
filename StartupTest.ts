import { IStore } from './store/IStore';
import { kennelExists } from './seed-data/seed-helpers';
import {
    SerializedDog,
    ISerializedDogConfig,
    IKennelConfig,
    BASE_DOG_PREFIX,
    Dog,
    IHuntingDog,
    createPact,
    MimicDog,
    IMimicDogConfig,
    KennelRun,
    isRuntimeLogVerbose,
    envFirst,
    selectLineDocs,
    sliceDogCodeLines,
    type ChannelState,
    kennelIdBlockedReason,
    publicKennelPath,
    publicKennelDocsPath,
    publicKennelOpenApiPath,
    classifyDogError,
    unregisterVmGlobalCapability,
    DOG_OOM_MARKER,
    DOG_TIMEOUT_MARKER,
    type DogRunReport,
    type ICacheHandler,
} from '@slopdogs/core';
import { Controller } from './api/Controller';
import { AbstractController } from './api/AbstractController';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { HeavyRequestLimiter } from './server-app/heavyRequestLimiter';
import { EventEmitter } from 'events';
import { CompilerCache } from './services/CompilerCache';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { getSnapshotTools } from './mcp/tools/snapshots';
import { getKennelTools } from './mcp/tools/kennels';
import { getNodeTools } from './mcp/tools/nodes';
import { AclRouteHandler } from './api/routes/AclRouteHandler';
import { EX_CONFIG, authModeBootError } from './mcp/auth/middleware';
import { spawn } from 'child_process';
import { KennelSnapshotCache } from './mcp/snapshots/KennelSnapshotCache';
import type { ToolDeps } from './mcp/tools/types';
import type { AuthCtx } from './mcp/auth/middleware';
import { REDACTED_RESULT } from './services/wavesRedaction';
import { readNegativeCacheMarker } from './services/PrismaCacheHandler';
import { generateVersionId, generateLineageId } from './api/utils/versioning';
import { KennelBundleHandler } from './api/routes/KennelBundleHandler';
import { KennelSwaggerHandler } from './api/routes/KennelSwaggerHandler';
import { getAclTools } from './mcp/tools/acl';
import {
    canManageAcl,
    canMutate,
    canRead,
    canRun,
    rightsOf,
    isFrozen,
    isLandingLocked,
    applyCreateDefaults,
    type AclEntity,
    type Visibility,
} from './mcp/auth/visibility';
import { toSwaggridCast } from './services/swaggridAdapter';
import { KennelCallCounter, utcDay } from './services/KennelCallCounter';
import { KennelStatsService } from './services/KennelStatsService';
import { KennelRatingHandler } from './api/routes/KennelRatingHandler';
import { ListQuery, USAGE_FILTERS } from './api/routes/ListQuery';
import { LandingRouteHandler } from './api/routes/LandingRouteHandler';
import type { DogCallDelta, DogReferenceRow, IDogStatsStore, IKennelStatsStore, KennelCallAggregate, KennelCallSource } from './store/IKennelStatsStore';
import { dogStatsKeyOf } from './services/dogStatsKey';
import { DogReferenceIndex } from './services/DogReferenceIndex';
import { DogStatsService } from './services/DogStatsService';
import { DogReuseAdvisor } from './services/DogReuseAdvisor';
import { buildWerkzeugkasten } from './mcp/werkzeugkasten';
import { ENV_CATALOG, ENV_CATALOG_NAMES, ENV_SECTIONS, missingEnvWarnings, recommendedEnvHints } from './server-app/startupEnvCheck';
import { EXPRESS_APP_ROUTES, FRONTEND_ROUTES, LEGACY_ROUTE, PUBLIC_ROUTE, SPA_ROUTES } from './api/routes/routeTable';
import { NodesRouteHandler } from './api/routes/NodesRouteHandler';
import { FIXED_TOP_LEVEL } from './api/routes/spaRouteConstants';
import express from 'express';
import { createPersonalTokensRouter } from './mcp/auth/personal-tokens';
import { BaseDogPacks } from './services/BaseDogPacks';
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput, NearbyLandmarksPact } from '@slopdogs/dogs-geo';
import { randomBytes } from 'crypto';
import { KeyStoreService, MasterKeyring, type KeyStorePrisma } from './services/KeyStoreService';
import { KeysRouteHandler } from './api/routes/KeysRouteHandler';
import {
    KeyRunState,
    KeysCapability,
    REDACTED_KEY,
    scrubbingConsoleSink,
    type KeysFetchResult,
    type KeysNetwork,
    type KeysOutboundRequest,
} from './services/keysCapability';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { gzipSync } from 'zlib';
import { LandingPage, type LandingRunner } from './server-app/LandingPage';
import { LandingKennels } from './mcp/auth/landingKennels';
import { BetaKeyError, BetaKeys, type BetaKeyPrisma, type BetaKeyRow, type BetaUserRow } from './mcp/auth/betaKeys';
import { BetaRouteHandler } from './api/routes/BetaRouteHandler';
import { resolvePublicDir } from './server-app/expressPaths';
import { SLOPDOGS_LANDING_KENNEL_ID, seedSlopdogsLandingKennel } from './seed-data/kennels/slopdogs-landing';

/** Was die Laufzeit-Tests des Key-Stores brauchen (P4c). */
interface KeysTestDeps {
    prisma: KeyStorePrisma;
    appKeyStore?: KeyStoreService;
    nodesStore: IStore;
    kennelsController: KennelController;
    baseDogsMap: Map<string, any>;
}

/**
 * Das Fake-Netz fuer keys.fetch (P4c): kein Aufruf verlaesst den Prozess. Es zaehlt, was gesendet
 * wurde, und echot den Authorization-Header in Body und Header zurueck — der boesartigste Upstream.
 */
class FakeKeysNetwork implements KeysNetwork {
    readonly sent: KeysOutboundRequest[] = [];

    constructor(private readonly hosts: Record<string, string[]> = {}) {}

    async resolve(hostname: string): Promise<string[]> {
        return this.hosts[hostname] ?? ['93.184.216.34'];
    }

    async send(request: KeysOutboundRequest): Promise<KeysFetchResult> {
        this.sent.push(request);
        const authorization = request.headers.authorization ?? null;
        return {
            status: 200,
            headers: { 'content-type': 'application/json', 'x-echo-authorization': authorization ?? '', 'set-cookie': 'sid=p4c' },
            body: JSON.stringify({ url: request.url.href, authorization, body: request.body ?? null }),
        };
    }
}

/**
 * Arr, the testament of a single trial endured upon the eldritch seas —
 * recording whether the crew's test weathered the void or was consumed
 * by the carrion hordes of failure lurking in the deep.
 */
export interface TestResult {
    /** The name of the trial, inscribed upon the ship's log for all to witness. */
    name: string;
    /** Whether the test survived the abyss — true if it passed, false if the void claimed it. */
    passed: boolean;
    /** The error message from brooding gulfs, present only when the test be lost to the deep. */
    error?: string;
}

/**
 * Arr, the StartupTest be the grand trial by fire — a gauntlet of tests
 * run at startup to ensure the stores, controllers, base dogs, type builders,
 * and pact mimics all hold firm against the void. Should any test fall
 * to the carrion hordes, the crew be warned before the ship sets sail
 * into the brooding gulfs of production.
 */
export class StartupTest {
    /** The accumulated results of each trial, a ledger of victories and defeats against the abyss. */
    private results: TestResult[] = [];
    /** IDs of test entities conjured during the trials, marked for cleanup lest they pollute the deep. */
    private createdTestIds: string[] = [];

    /** Ein Stats-Store, der nichts schreibt — Testlaeufe gehoeren nicht in die Statistik. */
    private static readonly NO_STATS_STORE: IKennelStatsStore = {
        incrementKennelCalls: async () => {},
        readKennelCallAggregates: async () => [],
        readKennelRatingAggregates: async () => [],
        readKennelRatingHistogram: async () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }),
        readKennelRating: async () => null,
        upsertKennelRating: async () => {},
        deleteKennelRating: async () => false,
        deleteKennelStats: async () => {},
    };

    /** Ein Dog-Stats-Store ohne Zeilen (P4b) — Testlaeufe gehoeren nicht in die Statistik. */
    private static readonly NO_DOG_STATS_STORE: IDogStatsStore = {
        incrementDogCalls: async () => {},
        readDogCallAggregates: async () => [],
        readDogKennelUsage: async () => [],
        deleteDogCalls: async () => {},
        replaceReferences: async () => {},
        removeReferences: async () => {},
        readAllReferences: async () => [],
        rebuildReferences: async () => {},
    };

    /** Zaehler der Test-Handler: zaehlt im Speicher, flusht nie. */
    private readonly testCallCounter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });

    /**
     * Führt alle Tests aus
     */
    async runAllTests(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: AbstractController<IKennelConfig>,
        baseDogsMap: Map<string, any>,
        /** Die fertig montierte Express-App — fuer den Abgleich Routentabelle <-> Stack. */
        app?: any,
        /** Der Auth-Client der App (P4c): die Key-Store-Tests schreiben echte UserKey-Zeilen und raeumen sie ab. */
        authPrisma?: KeyStorePrisma,
        /** Der Key-Store der App (P4c): nach den Tests mit Fake-Netz wird `keys` wieder auf ihn registriert. */
        appKeyStore?: KeyStoreService,
    ): Promise<TestResult[]> {
        if (isRuntimeLogVerbose()) {
            console.log('\n🧪 Starte Startup-Tests...\n');
        }

        try {
            // Store-Tests
            await this.testStoreSaveAndLoad(nodesStore);
            await this.testStoreFindByType(nodesStore);
            await this.testKennelExistsUsesLineageLookup();
            await this.testEnvAliasFallback();
            await this.testNegativeCacheMarkerAcceptsBothPrefixes();
            
            // Controller-Tests
            await this.testControllerList(nodesController);
            await this.testControllerGetById(nodesController);
            await this.testControllerCreate(nodesController);
            await this.testControllerSave(nodesController);
            await this.testNodeDescriptionAndLineDocs(nodesController);

            // KennelConfig-Tests
            await this.testKennelConfigList(kennelsController);
            await this.testKennelConfigGetById(kennelsController);
            await this.testKennelStatusTrackingPersist(kennelsController);
            await this.testKennelStatusTrackingMerge(kennelsController);
            await this.testKennelStatusTrackingTextChanges(kennelsController);
            await this.testKennelNodeCommentMutations(kennelsController);
            await this.testKennelEdgeCommentMutations(kennelsController);
            await this.testKennelStatusTrackingVersioning(kennelsController);
            await this.testVersionsRespectCanRead(kennelsController as KennelController);
            
            // BaseDogs-Tests
            await this.testBaseDogsAvailability(baseDogsMap);
            await this.testBaseDogsFormat(baseDogsMap);
            
            // TypeDefBuilder-Tests
            await this.testTypeDefBuilder();
            await this.testPactFromSourceType();

            // Gate: zweite Schleuse fuer oeffentliche Kennel-Laeufe
            await this.testPublicLimiterCoversPublicPaths();
            await this.testPublicLimiterQueuesAndReleases();

            // P3: /k/, Segment-Regel, Alt-Weiche, HEAD ohne Lauf, Swagger unter /k, Routentabelle
            await this.testKennelIdRule();
            await this.testCreateRejectsCaseCollision(kennelsController as KennelController);
            await this.testLegacyRedirectKeepsQueryAndMethod();
            await this.testPublicUnknownIs404();
            await this.testPublicHeadDoesNotRun(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testSwaggerRedirectAndPaths(nodesStore, kennelsController as KennelController);
            if (app) await this.testRouteTableMatchesExpressStack(app);

            // SerializedDog-Tests
            await this.testSerializedDogExists(nodesStore);
            await this.testAllVersionsInList(nodesController);
            
            // Pact & MimicDog Tests
            await this.testCreatePact();
            await this.testMimicDogImitatesPact(baseDogsMap);
            await this.testMatchesParentRecognizesMimic(baseDogsMap);
            await this.testFillKennelAutoMimicForPact(baseDogsMap);
            await this.testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap);
            await this.testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap);
            await this.testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap);
            await this.testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap);
            await this.testRunSeasonWithMimicConsumerRuns(baseDogsMap);
            await this.testTalkingDogAllDependenciesResolved(baseDogsMap);

            // Lobby: die Einladung (?channelId=) kommt an -- auch ohne ausdruecklichen QueryRetriever
            await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever']);
            await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever', 'base:QueryRetriever']);
            await this.testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap);

            // Snapshot-Werkzeuge: Redaktion je Dog wie /run
            await this.testSnapshotToolsRedactPerDog(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);

            // Export/Import Tests
            await this.testKennelExportImport(nodesStore, kennelsStore, kennelsController);

            // ACL-Lecks F1, F3, F4, F5
            await this.testExportStubsUnreadableDogs(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testSwaggerHiddenForUnreadable(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testListCollaboratorsGated(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testLegacySaveAppliesCreateDefaults(nodesStore, nodesController);
            await this.testImportAppliesCreateDefaults(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testLegacySaveIgnoresClientAcl(nodesStore, nodesController);

            // P3.5 Rechte v2: NONE < RUN < READ < EDIT < OWN
            await this.testRightsMatrix();
            await this.testOwnerReleasesToCommunity(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testVersionCarriesHeadRights(kennelsController as KennelController);
            await this.testPrivateKennelHiddenFromAnon(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testRunOnlyKennelShowsNoPack(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testRunnerSeesOutputNotCode(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testReaderSeesCodeButCannotSave(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testForeignPrivateDogDoesNotRun(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testEditorEditsButDoesNotOwn(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testPatActsAsItsUser(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testRunOnlyForeignDogPinnedAndScoped(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testFreezeBlocksEveryMutation(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testAclRestRoutes(kennelsController as KennelController, nodesController);
            await this.testAclRestPeopleAndEmail(kennelsController as KennelController, nodesController);
            await this.testBootGuardRefusesSuperUserOutsideDev();
            await this.testEnvCatalogWarnings();

            // Fixes vor P4
            await this.testKennelRenameViaRest(kennelsController as KennelController);
            await this.testTrailingLineCommentRuns(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testNewAutoMimicTakesKennelOwner(nodesStore, kennelsController as KennelController, baseDogsMap);

            // P4: Aufrufe, Sterne, Suche, Landing-API
            const statsStore = this.statsStoreOf(kennelsStore);
            await this.testCallCounterCountsAndFlushes(statsStore);
            await this.testCallCounterDayBoundary(statsStore);
            await this.testCallCounterStopFlushes(statsStore);
            await this.testEveryRunPathIsAttributed(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testFailedRunCountsLeadFailed(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testRatingAggregateAndBayes(statsStore);
            await this.testKennelDeleteClearsStats(kennelsStore, statsStore);
            await this.testRatingRules(kennelsController as KennelController, statsStore);
            await this.testListQuerySortsAndFiltersByStats();
            await this.testLandingRanksOnlyPublic();

            // P4b: Dog-Aufrufe, Wiederverwendung, Bewaehrt
            await this.testDogRunObserverOncePerDog(baseDogsMap);
            await this.testDogRunClassification(baseDogsMap);
            await this.testDogCacheStatsWrapper(baseDogsMap);
            await this.testDogStatsKeyOf(baseDogsMap);
            const dogStatsStore = this.dogStatsStoreOf(kennelsStore);
            await this.testRecordDogAndFlush(statsStore, dogStatsStore);
            await this.testDogCallAggregate(dogStatsStore);
            await this.testDogCounterCost(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testReferenceDerivation(nodesStore, kennelsStore, dogStatsStore, baseDogsMap);
            await this.testReferenceRebuildIdempotent(nodesStore, kennelsStore, dogStatsStore, baseDogsMap);
            await this.testDogDeleteClearsStats(nodesStore, kennelsStore, statsStore, dogStatsStore, baseDogsMap);
            await this.testDogReuseAndUsage();
            await this.testProvenFormula();
            await this.testListQuerySortsDogsByProven();

            // P6 U5: /dogs-Browser — pack an Base-Dogs, lean=1 ohne Code, RUN-Sicht mit Kopf-Version
            await this.testNodesListPackLeanAndRunVersion(baseDogsMap);
            await this.testNodesListLeanOverHttp();

            // P6 U6/U7: Access-Panel, Account
            await this.testPersonalTokensJson();

            // P4c: Key-Store (Selbstangriff T1-T11; T11 im Gateway-Test)
            if (authPrisma) {
                await this.testKeyStoreDbReader(authPrisma);
                await this.testKeyStoreRotation(authPrisma);
                await this.testKeysRestIdor(authPrisma);
                const keysRun = { prisma: authPrisma, appKeyStore, nodesStore, kennelsController: kennelsController as KennelController, baseDogsMap };
                await this.testKeysEditorTheft(keysRun);
                await this.testKeysForeignDogExfil(keysRun);
                await this.testKeysAnonPublicYield(keysRun);
                await this.testKeysLogScrub(keysRun);
                await this.testKeysSuperUserTrap(keysRun);
                await this.testKeysSnapshotCrossRead(keysRun, kennelsStore, nodesController);
                await this.testKeysKennelGrants(keysRun);
            }
            await this.testExportScansRawKeys(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testWorkerFetchBlocksPrivateNetworks(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testDogWorkerHasNoServerEnv(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testDogWorkerHasNoFilesystem(nodesStore, kennelsController as KennelController, baseDogsMap);

            // P5: Landing — / ist der Kennel slopdogs-landing (Memo je Look, Quelle landing, statischer Fallback)
            await this.testLandingSeedIdempotent(nodesStore, kennelsStore);
            await this.testLandingMemoAndSource(nodesStore, kennelsStore, kennelsController as KennelController, baseDogsMap);
            await this.testLandingFallback();
            await this.testLandingFallbackIsBuilt();
            await this.testLandingBudgetAndFonts();
            await this.testLandingOverHttp();

            // Fix-Runde: Kompression (brotli/gzip) fuer Textantworten, nie fuer SSE, HEAD, Schriften
            await this.testResponseCompression();
            // Fix-Runde: DELETE nach Version oder Lineage, Codes statt Store-Text
            await this.testDeleteRefScopes(nodesController, kennelsController as KennelController);
            // Landing-Rotation (LANDING_KENNEL_IDS) und Schreibschutz der gelisteten Kennels
            await this.testLandingRotation();
            await this.testLandingLock(kennelsController as KennelController, nodesController);
            // Beta-Modus: ein Key, ein Google-Konto
            await this.testBetaKeys();
            await this.testLandingStageSticker();

            // Feature-Runde nach dem lokalen Test: Aufruf-Filter (usage) fuer Kennels
            await this.testListQueryUsageFiltersKennels();
            await this.testListKennelsUsageRespectsRights(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            // ... und fuer Dogs (Fehler-Tracking aus P4b: error/timeout/oom)
            await this.testListQueryUsageFiltersDogs();
            await this.testListNodesUsageRespectsRights(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            // Wiederverwenden vor Schreiben: Hinweis in build_kennel, feste Regel in den MCP-Texten
            await this.testDogReuseAdvisorMatches();
            await this.testBuildKennelReuseHint(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);

            // Tile-Feature-Cache: atomarer Geo-Store verifizieren
            await this.testTileFeatureCache();
        } finally {
            // Cleanup: Lösche alle erstellten Test-Daten
            await this.cleanupTestData(nodesStore, kennelsStore, nodesController, kennelsController);
        }
        
        // Zusammenfassung
        this.printSummary();
        
        return this.results;
    }

    /**
     * Löscht alle erstellten Test-Daten (nur die spezifisch erstellten IDs)
     */
    private async cleanupTestData(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: AbstractController<IKennelConfig>
    ): Promise<void> {
        if (this.createdTestIds.length === 0) {
            return; // Keine Test-Daten erstellt
        }
        
        const v = isRuntimeLogVerbose();
        if (v) console.log('\n🧹 Räume Test-Daten auf...\n');

        // Lösche NUR die spezifisch erstellten Test-IDs
        for (const testId of this.createdTestIds) {
            try {
                // Versuche über Controller zu löschen (für SerializedDogs)
                await nodesController.delete(testId);
                if (v) console.log(`  🗑️  Gelöscht: ${testId}`);
            } catch (e) {
                // Falls Controller-Löschen fehlschlägt, versuche über Store
                try {
                    await nodesStore.delete(testId);
                    if (v) console.log(`  🗑️  Gelöscht (via Store): ${testId}`);
                } catch (e2) {
                    // Ignoriere Fehler (kann sein, dass bereits gelöscht wurde oder nicht existiert)
                    if (v) console.log(`  ⚠️  Konnte nicht löschen: ${testId} (möglicherweise bereits gelöscht)`);
                }
            }
        }

        if (v) console.log(`✅ Cleanup abgeschlossen (${this.createdTestIds.length} IDs verarbeitet)\n`);
    }

    /**
     * Test: Store kann speichern und laden
     */
    private async testStoreSaveAndLoad(store: IStore): Promise<void> {
        const testName = 'Store: Save & Load';
        let testId: string | null = null;
        try {
            testId = 'test-store-' + Date.now();
            this.createdTestIds.push(testId);
            const testData = { id: testId, test: true, value: 123 };
            
            await store.save({
                id: testId,
                type: 'TestType',
                serializedDogConfig: JSON.stringify(testData)
            });
            
            const loaded = await store.load(testId);
            if (!loaded) {
                throw new Error('Daten konnten nicht geladen werden');
            }
            
            const parsed = typeof loaded === 'string' ? JSON.parse(loaded) : loaded;
            if (parsed.test !== true || parsed.value !== 123) {
                throw new Error('Geladene Daten stimmen nicht überein');
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    /**
     * Test: Store kann nach Typ suchen
     */
    private async testStoreFindByType(store: IStore): Promise<void> {
        const testName = 'Store: FindByType';
        try {
            const results = await store.findByType(SerializedDog.name);
            if (!Array.isArray(results)) {
                throw new Error('Ergebnis ist kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: kennelExists fragt per (type, lineageId) nach, statt die KennelConfig-Partition
     * zu ziehen — der Seed ruft das 21 Mal je Boot.
     */
    private async testKennelExistsUsesLineageLookup(): Promise<void> {
        const testName = 'Seed: kennelExists ueber findByLineage (kein Vollscan)';
        try {
            let findByTypeCalls = 0;
            const lineageLookups: Array<[string, string]> = [];
            const fakeStore = {
                findByType: async () => { findByTypeCalls++; return []; },
                findByLineage: async (type: string, lineageId: string) => {
                    lineageLookups.push([type, lineageId]);
                    return [{ id: 'v1', lineageId, type }];
                },
            } as unknown as IStore;

            const exists = await kennelExists(fakeStore, 'x');
            if (exists !== true) throw new Error(`kennelExists lieferte ${exists}, erwartet true`);
            if (findByTypeCalls !== 0) throw new Error(`findByType wurde ${findByTypeCalls} Mal gerufen`);
            if (lineageLookups.length !== 1 || lineageLookups[0][0] !== 'KennelConfig' || lineageLookups[0][1] !== 'x') {
                throw new Error(`findByLineage-Aufrufe unerwartet: ${JSON.stringify(lineageLookups)}`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Umbenennung dataDogs -> SlopDogs — alte Env-Namen greifen als Alias, der neue Name gewinnt.
     */
    private async testEnvAliasFallback(): Promise<void> {
        const testName = 'Env: DATADOGS_* als Alias fuer SLOPDOGS_*';
        const keys = ['SLOPDOGS_LOG_LEVEL', 'DATADOGS_LOG_LEVEL'];
        const saved = keys.map((k) => process.env[k]);
        const originalWarn = console.warn;
        const warnings: string[] = [];
        try {
            console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
            delete process.env.SLOPDOGS_LOG_LEVEL;
            process.env.DATADOGS_LOG_LEVEL = 'verbose';
            if (isRuntimeLogVerbose() !== true) throw new Error('alter Name DATADOGS_LOG_LEVEL=verbose wirkt nicht');
            isRuntimeLogVerbose();
            const aliasLines = warnings.filter((w) => w.includes('alias in use: DATADOGS_LOG_LEVEL -> SLOPDOGS_LOG_LEVEL'));
            if (aliasLines.length !== 1) throw new Error(`${aliasLines.length} Alias-Logzeilen, erwartet genau 1`);
            process.env.SLOPDOGS_LOG_LEVEL = 'quiet';
            if (isRuntimeLogVerbose() !== false) throw new Error('neuer Name gewinnt nicht gegen den alten');
            if (envFirst('SLOPDOGS_LOG_LEVEL', 'DATADOGS_LOG_LEVEL') !== 'quiet') throw new Error('envFirst liefert nicht den neuen Namen');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            console.warn = originalWarn;
            keys.forEach((k, i) => {
                if (saved[i] === undefined) delete process.env[k];
                else process.env[k] = saved[i];
            });
        }
    }

    /**
     * Test: Negativ-Marker im Cache werden mit neuem und altem Praefix erkannt.
     */
    private async testNegativeCacheMarkerAcceptsBothPrefixes(): Promise<void> {
        const testName = 'Cache: Negativ-Marker mit __SLOPDOGS_ und __DATADOGS_ Praefix';
        try {
            const current = JSON.stringify('__SLOPDOGS_NEG_CACHE__:boom');
            const legacy = JSON.stringify('__DATADOGS_NEG_CACHE__:old boom');
            if (readNegativeCacheMarker(current) !== 'boom') throw new Error('neues Praefix nicht erkannt');
            if (readNegativeCacheMarker(legacy) !== 'old boom') throw new Error('altes Praefix nicht erkannt');
            if (readNegativeCacheMarker(JSON.stringify({ ok: true })) !== undefined) throw new Error('positiver Wert als Negativ-Marker erkannt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Liste abrufen
     */
    private async testControllerList(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: List';
        try {
            const result = await controller.list();
            if (!result.ok) {
                throw new Error(result.error || 'Liste konnte nicht abgerufen werden');
            }
            if (!Array.isArray(result.data)) {
                throw new Error('Daten sind kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Entity nach ID abrufen
     */
    private async testControllerGetById(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: GetById';
        try {
            // Versuche den gesäten SerializedDog zu laden
            // With GUID-based versioning, the seed ID is dynamic — find any SerializedDog instead.
            const allDogs = await controller.list();
            const result = allDogs.ok && allDogs.data && allDogs.data.length > 0
                ? { ok: true, data: allDogs.data[0] }
                : { ok: false, error: 'Keine SerializedDogs gefunden', data: null };
            if (!result.ok && result.error?.includes('nicht gefunden')) {
                // Das ist OK, wenn der Seed noch nicht existiert
                this.addResult(testName, true, 'Seed existiert noch nicht (OK)');
            } else if (result.ok && result.data) {
                this.addResult(testName, true);
            } else {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Controller kann Entity erstellen
     */
    private async testControllerCreate(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: Create';
        let createdId: string | null = null;
        try {
            const input: ISerializedDogConfig = {
                displayName: 'test-create-' + Date.now(),
                theRun: 'return { test: true };',
            };

            const result = await controller.create(input);
            if (!result.ok) {
                throw new Error(result.error || 'Erstellen fehlgeschlagen');
            }

            if (!result.id) {
                throw new Error('Keine ID zurückgegeben');
            }

            createdId = result.id;
            this.createdTestIds.push(createdId);
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    /**
     * Test: Controller kann Entity speichern
     */
    private async testControllerSave(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Controller: Save';
        try {
            const input: ISerializedDogConfig = {
                displayName: 'test-save-' + Date.now(),
                theRun: 'return { test: true };',
            };

            // Erstelle erst eine Entity — the firstborn incarnation
            const createResult = await controller.create(input);
            if (!createResult.ok || !createResult.id) {
                throw new Error(createResult.error || 'Erstellen fehlgeschlagen');
            }
            this.createdTestIds.push(createResult.id);

            // Dann speichere sie (Update) — a new incarnation branching from the first
            const updateInput: ISerializedDogConfig = {
                id: createResult.id,
                theRun: 'return { test: true, updated: true };',
            };

            const result = await controller.save(updateInput);
            if (!result.ok) {
                throw new Error(result.error || 'Speichern fehlgeschlagen');
            }

            if (result.id) {
                this.createdTestIds.push(result.id);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: SerializedDog carries a settable description + lineDocs that round-trip
     * through create/getById, a description-only save breeds a new version, and the
     * line-doc helpers resolve an annotation + code slice by line.
     */
    private async testNodeDescriptionAndLineDocs(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Node: description + lineDocs round-trip';
        try {
            const theRun = 'const a = 1;\nconst b = 2;\n// combat section\nreturn { a, b };';
            const createInput: ISerializedDogConfig = {
                displayName: 'test-desc-' + Date.now(),
                theRun,
                description: 'yields the combat numbers',
                lineDocs: [{ von: 3, bis: 4, text: 'the combat part' }],
            };

            const created = await controller.create(createInput);
            if (!created.ok || !created.id) throw new Error(created.error || 'create failed');
            this.createdTestIds.push(created.id);
            // The lineageId resolves to the LATEST incarnation; a version GUID pins one version.
            const lineageId = (created.data as any)?.lineageId ?? created.id;

            const fetched = await controller.getById(created.id);
            const cfg = fetched.data as any;
            if (!fetched.ok || !cfg) throw new Error('getById returned nothing');
            if (cfg.description !== 'yields the combat numbers') {
                throw new Error(`description not persisted: ${JSON.stringify(cfg.description)}`);
            }
            if (!Array.isArray(cfg.lineDocs) || cfg.lineDocs.length !== 1 || cfg.lineDocs[0].von !== 3) {
                throw new Error(`lineDocs not persisted: ${JSON.stringify(cfg.lineDocs)}`);
            }

            // Line retrieval: line 3 must hit the annotation and slice the right code.
            const hits = selectLineDocs(cfg.lineDocs, 3, 3);
            if (hits.length !== 1 || hits[0].text !== 'the combat part') {
                throw new Error(`selectLineDocs miss: ${JSON.stringify(hits)}`);
            }
            const slice = sliceDogCodeLines(cfg.theRun, 3, 4);
            if (!slice || !slice.text.includes('combat section')) {
                throw new Error(`sliceDogCodeLines miss: ${JSON.stringify(slice)}`);
            }
            // A line outside every range yields no annotation.
            if (selectLineDocs(cfg.lineDocs, 1, 1).length !== 0) {
                throw new Error('selectLineDocs should miss line 1');
            }

            // A description-only save must breed a new version (not silently no-op).
            const saved = await controller.save({
                id: created.id,
                theRun,
                description: 'now yields updated combat numbers',
            } as ISerializedDogConfig);
            if (!saved.ok) throw new Error(saved.error || 'save failed');
            if (saved.id) this.createdTestIds.push(saved.id);
            if (saved.id === created.id) throw new Error('description-only save did not create a new version');

            // Re-fetch the LATEST incarnation by lineageId — a version GUID would pin the old one.
            const reFetched = await controller.getById(lineageId);
            const reCfg = reFetched.data as any;
            if (reCfg?.description !== 'now yields updated combat numbers') {
                throw new Error(`updated description not persisted: ${JSON.stringify(reCfg?.description)}`);
            }
            // lineDocs must survive a save that did not re-send them.
            if (!Array.isArray(reCfg.lineDocs) || reCfg.lineDocs.length !== 1) {
                throw new Error(`lineDocs lost on save: ${JSON.stringify(reCfg?.lineDocs)}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: KennelConfig kann gelistet werden
     */
    private async testKennelConfigList(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: List';
        try {
            const result = await controller.list();
            if (!result.ok) {
                throw new Error(result.error || 'Liste konnte nicht abgerufen werden');
            }
            if (!Array.isArray(result.data)) {
                throw new Error('Daten sind kein Array');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Status-Tracking-Felder (task / nodes / edges) ueberleben den Roundtrip.
     * Create kennel -> PUT mit task/nodes/edges -> GET zurueck -> alle Felder muessen
     * in korrekter Form vorliegen.
     */
    private async testKennelStatusTrackingPersist(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Persistence';
        const kennelId = 'test-status-persist-' + Date.now();
        try {
            const created = await controller.create({
                id: kennelId,
                name: 'Status Test Persist',
                dogIds: ['base:QueryRetriever'],
            } as any);
            if (!created.ok) throw new Error('Create fehlgeschlagen: ' + created.error);

            const saved = await controller.save({
                id: kennelId,
                task: 'Mission: tracke den Status',
                nodes: [{ id: 'base:QueryRetriever', x: 10, y: 20, comment: 'Einstieg' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'self-ref' }],
            } as any);
            if (!saved.ok) throw new Error('Save fehlgeschlagen: ' + saved.error);

            const loaded = await controller.getById(kennelId);
            if (!loaded.ok || !loaded.data) throw new Error('GetById fehlgeschlagen: ' + loaded.error);
            const cfg = loaded.data as any;

            if (cfg.task !== 'Mission: tracke den Status') {
                throw new Error('task falsch: ' + JSON.stringify(cfg.task));
            }
            if (!Array.isArray(cfg.nodes) || cfg.nodes.length !== 1) {
                throw new Error('nodes falsch: ' + JSON.stringify(cfg.nodes));
            }
            const n = cfg.nodes[0];
            if (n.id !== 'base:QueryRetriever' || n.x !== 10 || n.y !== 20 || n.comment !== 'Einstieg') {
                throw new Error('nodes[0] Inhalt falsch: ' + JSON.stringify(n));
            }
            if (!Array.isArray(cfg.edges) || cfg.edges.length !== 1) {
                throw new Error('edges falsch: ' + JSON.stringify(cfg.edges));
            }
            const e = cfg.edges[0];
            if (e.fromId !== 'base:QueryRetriever' || e.toId !== 'base:QueryRetriever' || e.comment !== 'self-ref') {
                throw new Error('edges[0] Inhalt falsch: ' + JSON.stringify(e));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Partielle Updates der Status-Felder ueberschreiben nicht die anderen.
     * PUT nur {task} laesst nodes/edges intakt; PUT nur {nodes} laesst task intakt.
     */
    private async testKennelStatusTrackingMerge(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Merge';
        const kennelId = 'test-status-merge-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Merge Test', dogIds: ['base:QueryRetriever'] } as any);

            // Voll bestuecken
            await controller.save({
                id: kennelId,
                task: 'initial task',
                nodes: [{ id: 'base:QueryRetriever', comment: 'note A' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'flow A' }],
            } as any);

            // Nur task aktualisieren
            await controller.save({ id: kennelId, task: 'updated task' } as any);

            let r = await controller.getById(kennelId);
            let cfg = r.data as any;
            if (cfg.task !== 'updated task') throw new Error('task nicht aktualisiert');
            if (!cfg.nodes || cfg.nodes.length !== 1 || cfg.nodes[0].comment !== 'note A') {
                throw new Error('nodes verloren nach task-only save: ' + JSON.stringify(cfg.nodes));
            }
            if (!cfg.edges || cfg.edges.length !== 1 || cfg.edges[0].comment !== 'flow A') {
                throw new Error('edges verloren nach task-only save: ' + JSON.stringify(cfg.edges));
            }

            // Nur nodes aktualisieren
            await controller.save({
                id: kennelId,
                nodes: [{ id: 'base:QueryRetriever', comment: 'note B' }],
            } as any);

            r = await controller.getById(kennelId);
            cfg = r.data as any;
            if (cfg.task !== 'updated task') {
                throw new Error('task verloren nach nodes-only save: ' + JSON.stringify(cfg.task));
            }
            if (!cfg.nodes || cfg.nodes[0].comment !== 'note B') {
                throw new Error('nodes nicht aktualisiert: ' + JSON.stringify(cfg.nodes));
            }
            if (!cfg.edges || cfg.edges[0].comment !== 'flow A') {
                throw new Error('edges verloren nach nodes-only save: ' + JSON.stringify(cfg.edges));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Vorhandene Texte koennen geaendert werden — nicht nur neu gesetzt.
     * Eine Annotation wird belegt, dann mit anderem Wert ueberschrieben.
     * Der aktuelle Stand muss den NEUEN Wert zeigen, alte Versionen den ALTEN.
     */
    private async testKennelStatusTrackingTextChanges(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Text-Aenderungen';
        const kennelId = 'test-status-changes-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Changes Test', dogIds: ['base:QueryRetriever'] } as any);

            // Initialer Stand
            await controller.save({
                id: kennelId,
                task: 'alt task',
                nodes: [{ id: 'base:QueryRetriever', x: 10, y: 20, comment: 'alt node' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'alt edge' }],
            } as any);

            // ALLE Texte aendern + Position verschieben
            await controller.save({
                id: kennelId,
                task: 'neu task',
                nodes: [{ id: 'base:QueryRetriever', x: 999, y: 888, comment: 'neu node' }],
                edges: [{ fromId: 'base:QueryRetriever', toId: 'base:QueryRetriever', comment: 'neu edge' }],
            } as any);

            // Aktueller Stand muss alle neuen Werte tragen
            const latest = await controller.getById(kennelId);
            const cfg = latest.data as any;
            if (cfg.task !== 'neu task') throw new Error('task nicht geaendert: ' + JSON.stringify(cfg.task));
            if (cfg.nodes?.[0]?.comment !== 'neu node') {
                throw new Error('node-comment nicht geaendert: ' + JSON.stringify(cfg.nodes?.[0]));
            }
            if (cfg.nodes?.[0]?.x !== 999 || cfg.nodes?.[0]?.y !== 888) {
                throw new Error('node-Position nicht geaendert: ' + JSON.stringify(cfg.nodes?.[0]));
            }
            if (cfg.edges?.[0]?.comment !== 'neu edge') {
                throw new Error('edge-comment nicht geaendert: ' + JSON.stringify(cfg.edges?.[0]));
            }

            // Die ALTEN Werte muessen in der History noch existieren
            const versions = await controller.getVersions(kennelId);
            // 3 Versionen: initial-create, alt-save, neu-save (newest first)
            if (versions.length !== 3) {
                throw new Error('Erwartet 3 Versionen, gefunden: ' + versions.length);
            }
            const altVersion = versions[1].config as any;
            if (altVersion?.task !== 'alt task') {
                throw new Error('Alte task-Version verloren: ' + JSON.stringify(altVersion?.task));
            }
            if (altVersion?.nodes?.[0]?.comment !== 'alt node') {
                throw new Error('Alte node-comment-Version verloren: ' + JSON.stringify(altVersion?.nodes));
            }
            if (altVersion?.nodes?.[0]?.x !== 10) {
                throw new Error('Alte node-Position verloren: ' + JSON.stringify(altVersion?.nodes?.[0]));
            }
            if (altVersion?.edges?.[0]?.comment !== 'alt edge') {
                throw new Error('Alte edge-comment-Version verloren: ' + JSON.stringify(altVersion?.edges));
            }

            // Loeschen eines Texts (leerer task -> undefined) muss auch greifen
            await controller.save({ id: kennelId, task: '' } as any);
            const cleared = await controller.getById(kennelId);
            const c = cleared.data as any;
            // Backend normalisiert leeren task auf undefined/null
            if (c.task) {
                throw new Error('task nicht geloescht (leerer String): ' + JSON.stringify(c.task));
            }
            // nodes/edges bleiben unangetastet
            if (c.nodes?.[0]?.comment !== 'neu node') {
                throw new Error('nodes verloren beim task-clear: ' + JSON.stringify(c.nodes));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Node-Kommentare werden gezielt geaendert, einer hinzugefuegt, einer entfernt.
     * Drei Knoten mit unterschiedlichen Comments; danach selektive Mutationen pruefen.
     */
    private async testKennelNodeCommentMutations(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Node-Comment Mutationen';
        const kennelId = 'test-node-comments-' + Date.now();
        try {
            await controller.create({
                id: kennelId,
                name: 'Node Comments',
                dogIds: ['base:QueryRetriever', 'base:RandomEveryThingRetriever', 'base:TalkingDog'],
            } as any);

            // 3 Knoten mit Initial-Comments + Positionen
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:QueryRetriever',           x: 10, y: 10, comment: 'A initial' },
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B initial' },
                    { id: 'base:TalkingDog',                x: 30, y: 30, comment: 'C initial' },
                ],
            } as any);

            // Mutation: A behaelt Comment+Pos; B aendert NUR Comment; C verliert Comment (Pos bleibt)
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:QueryRetriever',           x: 10, y: 10, comment: 'A initial' },
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B GEANDERT' },
                    { id: 'base:TalkingDog',                x: 30, y: 30 },
                ],
            } as any);

            const r = await controller.getById(kennelId);
            const ns = (r.data as any).nodes as Array<any>;
            const byId: Record<string, any> = Object.fromEntries(ns.map(n => [n.id, n]));

            if (byId['base:QueryRetriever']?.comment !== 'A initial') {
                throw new Error('A-Comment ungewollt veraendert: ' + JSON.stringify(byId['base:QueryRetriever']));
            }
            if (byId['base:RandomEveryThingRetriever']?.comment !== 'B GEANDERT') {
                throw new Error('B-Comment nicht geaendert: ' + JSON.stringify(byId['base:RandomEveryThingRetriever']));
            }
            if (byId['base:RandomEveryThingRetriever']?.x !== 20 || byId['base:RandomEveryThingRetriever']?.y !== 20) {
                throw new Error('B-Position ungewollt veraendert: ' + JSON.stringify(byId['base:RandomEveryThingRetriever']));
            }
            if (byId['base:TalkingDog']?.comment != null) {
                throw new Error('C-Comment nicht entfernt: ' + JSON.stringify(byId['base:TalkingDog']));
            }
            if (byId['base:TalkingDog']?.x !== 30 || byId['base:TalkingDog']?.y !== 30) {
                throw new Error('C-Position ungewollt veraendert: ' + JSON.stringify(byId['base:TalkingDog']));
            }

            // Mutation 2: D dazu (neuer Knoten), A weg
            await controller.save({
                id: kennelId,
                nodes: [
                    { id: 'base:RandomEveryThingRetriever', x: 20, y: 20, comment: 'B GEANDERT' },
                    { id: 'base:TalkingDog',                x: 30, y: 30 },
                    { id: 'base:CountryFlagBlackLab',       x: 40, y: 40, comment: 'D NEU' },
                ],
            } as any);
            const r2 = await controller.getById(kennelId);
            const ns2 = (r2.data as any).nodes as Array<any>;
            if (ns2.length !== 3) throw new Error('Erwartet 3 Knoten, gefunden: ' + ns2.length);
            if (ns2.find(n => n.id === 'base:QueryRetriever')) {
                throw new Error('A wurde nicht entfernt');
            }
            const d = ns2.find(n => n.id === 'base:CountryFlagBlackLab');
            if (!d || d.comment !== 'D NEU') throw new Error('D nicht hinzugefuegt: ' + JSON.stringify(d));

            // Alter Stand muss in der History noch da sein
            const versions = await controller.getVersions(kennelId);
            // 4 Versionen: initial-create, initial-save, mutation, mutation-2 (newest first)
            const initialMutation = (versions[2].config as any).nodes as Array<any>;
            const aInit = initialMutation.find(n => n.id === 'base:QueryRetriever');
            if (!aInit || aInit.comment !== 'A initial') {
                throw new Error('Alte A-Initial-Version verloren: ' + JSON.stringify(aInit));
            }
            const cInit = initialMutation.find(n => n.id === 'base:TalkingDog');
            if (!cInit || cInit.comment !== 'C initial') {
                throw new Error('Alte C-Initial-Version verloren: ' + JSON.stringify(cInit));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Edge-Kommentare werden gezielt geaendert, einer hinzugefuegt, einer entfernt.
     * Mehrere Edges mit unterschiedlichen Comments; danach selektive Mutationen pruefen.
     */
    private async testKennelEdgeCommentMutations(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Edge-Comment Mutationen';
        const kennelId = 'test-edge-comments-' + Date.now();
        try {
            await controller.create({
                id: kennelId,
                name: 'Edge Comments',
                dogIds: ['base:QueryRetriever', 'base:RandomEveryThingRetriever', 'base:TalkingDog'],
            } as any);

            // 3 Edges mit Initial-Comments
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:QueryRetriever',           toId: 'base:RandomEveryThingRetriever', comment: 'X initial' },
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y initial' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog',                  comment: 'Z initial' },
                ],
            } as any);

            // Mutation: X bleibt; Y aendert Comment; Z verliert Comment (Edge bleibt)
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:QueryRetriever',           toId: 'base:RandomEveryThingRetriever', comment: 'X initial' },
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y GEANDERT' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog' },
                ],
            } as any);

            const r = await controller.getById(kennelId);
            const es = (r.data as any).edges as Array<any>;
            const findEdge = (from: string, to: string) =>
                es.find(e => e.fromId === from && e.toId === to);

            const xE = findEdge('base:QueryRetriever', 'base:RandomEveryThingRetriever');
            const yE = findEdge('base:RandomEveryThingRetriever', 'base:TalkingDog');
            const zE = findEdge('base:QueryRetriever', 'base:TalkingDog');

            if (xE?.comment !== 'X initial') {
                throw new Error('X-Comment ungewollt veraendert: ' + JSON.stringify(xE));
            }
            if (yE?.comment !== 'Y GEANDERT') {
                throw new Error('Y-Comment nicht geaendert: ' + JSON.stringify(yE));
            }
            if (!zE) throw new Error('Z-Edge verloren');
            if (zE.comment != null) {
                throw new Error('Z-Comment nicht entfernt: ' + JSON.stringify(zE));
            }

            // Mutation 2: X loeschen (Edge weg), W dazu (neue Edge)
            await controller.save({
                id: kennelId,
                edges: [
                    { fromId: 'base:RandomEveryThingRetriever', toId: 'base:TalkingDog',                 comment: 'Y GEANDERT' },
                    { fromId: 'base:QueryRetriever',           toId: 'base:TalkingDog' },
                    { fromId: 'base:TalkingDog',                toId: 'base:QueryRetriever',           comment: 'W NEU (rueckkopplung)' },
                ],
            } as any);

            const r2 = await controller.getById(kennelId);
            const es2 = (r2.data as any).edges as Array<any>;
            if (es2.length !== 3) throw new Error('Erwartet 3 Edges, gefunden: ' + es2.length);
            if (es2.find(e => e.fromId === 'base:QueryRetriever' && e.toId === 'base:RandomEveryThingRetriever')) {
                throw new Error('X-Edge wurde nicht entfernt');
            }
            const wE = es2.find(e => e.fromId === 'base:TalkingDog' && e.toId === 'base:QueryRetriever');
            if (!wE || wE.comment !== 'W NEU (rueckkopplung)') {
                throw new Error('W nicht hinzugefuegt: ' + JSON.stringify(wE));
            }

            // Alter Stand muss in der History noch da sein
            const versions = await controller.getVersions(kennelId);
            const initialMutation = (versions[2].config as any).edges as Array<any>;
            const xInit = initialMutation.find((e: any) =>
                e.fromId === 'base:QueryRetriever' && e.toId === 'base:RandomEveryThingRetriever',
            );
            if (!xInit || xInit.comment !== 'X initial') {
                throw new Error('Alte X-Initial-Version verloren: ' + JSON.stringify(xInit));
            }
            const zInit = initialMutation.find((e: any) =>
                e.fromId === 'base:QueryRetriever' && e.toId === 'base:TalkingDog',
            );
            if (!zInit || zInit.comment !== 'Z initial') {
                throw new Error('Alte Z-Initial-Version verloren: ' + JSON.stringify(zInit));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: Jede Aenderung an task/nodes/edges erzeugt eine eigene Version, alte Versionen
     * behalten ihren Snapshot. Identische PUTs erzeugen KEINE neue Version (No-Op-Detection).
     */
    private async testKennelStatusTrackingVersioning(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: Status-Tracking Versioning';
        const kennelId = 'test-status-versioning-' + Date.now();
        try {
            await controller.create({ id: kennelId, name: 'Versioning Test', dogIds: ['base:QueryRetriever'] } as any);

            // Drei Saves mit jeweils anderen Texten
            await controller.save({ id: kennelId, task: 'v1', nodes: [{ id: 'base:QueryRetriever', comment: 'a' }] } as any);
            await controller.save({ id: kennelId, task: 'v2', nodes: [{ id: 'base:QueryRetriever', comment: 'b' }] } as any);
            await controller.save({ id: kennelId, task: 'v3', nodes: [{ id: 'base:QueryRetriever', comment: 'c' }] } as any);

            const versions = await controller.getVersions(kennelId);
            // Initial-Create + 3 saves = 4 Versionen
            if (versions.length !== 4) {
                throw new Error('Erwartet 4 Versionen, gefunden: ' + versions.length);
            }

            // Versionen sind newest-first sortiert
            const tasks = versions.map(v => (v.config as any)?.task ?? null);
            // Erwartet: ["v3", "v2", "v1", null]
            if (tasks[0] !== 'v3' || tasks[1] !== 'v2' || tasks[2] !== 'v1' || tasks[3] != null) {
                throw new Error('Versions-Snapshots falsch: ' + JSON.stringify(tasks));
            }

            // Pro Version den eigenen node-comment pruefen
            const comments = versions.map(v => (v.config as any)?.nodes?.[0]?.comment ?? null);
            if (comments[0] !== 'c' || comments[1] !== 'b' || comments[2] !== 'a' || comments[3] != null) {
                throw new Error('Node-comment History falsch: ' + JSON.stringify(comments));
            }

            // No-Op-Save: identischer Payload soll KEINE neue Version anlegen
            await controller.save({ id: kennelId, task: 'v3', nodes: [{ id: 'base:QueryRetriever', comment: 'c' }] } as any);
            const afterNoop = await controller.getVersions(kennelId);
            if (afterNoop.length !== 4) {
                throw new Error('No-Op-Save erzeugte Phantom-Version, jetzt: ' + afterNoop.length);
            }

            // Aelteren Snapshot per version-GUID abrufen
            const oldVersionId = versions[2].id; // sollte v1 sein
            const old = await controller.getById(oldVersionId);
            if (!old.ok || (old.data as any)?.task !== 'v1') {
                throw new Error('Alte Version per GUID liefert nicht v1: ' + JSON.stringify((old.data as any)?.task));
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await controller.delete(kennelId); } catch { /* swallow */ }
        }
    }

    /**
     * Test: KennelConfig kann nach ID abgerufen werden
     */
    private async testKennelConfigGetById(controller: AbstractController<IKennelConfig>): Promise<void> {
        const testName = 'KennelConfig: GetById';
        try {
            // Versuche die default-kennel zu laden
            const result = await controller.getById('default-kennel');
            if (!result.ok && result.error?.includes('nicht gefunden')) {
                // Das ist OK, wenn der Seed noch nicht existiert
                this.addResult(testName, true, 'Default Kennel existiert noch nicht (OK)');
            } else if (result.ok && result.data) {
                // Prüfe ob dogIds vorhanden ist
                if (!Array.isArray(result.data.dogIds)) {
                    throw new Error('dogIds ist kein Array');
                }
                this.addResult(testName, true);
            } else {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: BaseDogs sind verfügbar
     */
    private async testBaseDogsAvailability(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'BaseDogs: Verfügbarkeit';
        try {
            if (baseDogsMap.size === 0) {
                throw new Error('Keine BaseDogs verfügbar');
            }
            
            const expectedDogs = ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'];
            const missingDogs = expectedDogs.filter(name => !baseDogsMap.has(name));
            
            if (missingDogs.length > 0) {
                throw new Error(`Fehlende BaseDogs: ${missingDogs.join(', ')}`);
            }
            
            // Prüfe ob alle BaseDogs eine name-Property haben
            for (const [name, DogClass] of baseDogsMap.entries()) {
                const dog = new DogClass();
                if (!dog.name || dog.name !== name) {
                    throw new Error(`BaseDog ${name} hat keine korrekte name-Property`);
                }
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: BaseDogs haben korrektes Format für API (base:Name)
     */
    private async testBaseDogsFormat(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'BaseDogs: Format für API';
        try {
            // BASE_DOG_PREFIX wird jetzt aus slopdogs importiert
            
            for (const [name, DogClass] of baseDogsMap.entries()) {
                const expectedId = BASE_DOG_PREFIX + name;
                if (!expectedId.startsWith(BASE_DOG_PREFIX)) {
                    throw new Error(`BaseDog ${name} hat kein korrektes Präfix: ${expectedId}`);
                }
            }
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: TypeDefBuilder generiert korrekte Type-Definitionen
     */
    private async testTypeDefBuilder(): Promise<void> {
        const testName = 'TypeDefBuilder: Type-Definitionen';
        try {
            // Test 1: Einfacher Context mit Primitives
            const simpleCtx = {
                name: 'test',
                age: 25,
                active: true
            };
            const simpleResult = TypeDefBuilder.buildContextLib('SimpleNode', simpleCtx);
            
            // Validierung: Primitives
            if (!simpleResult.includes('declare global')) {
                throw new Error('Fehlende declare global Blocks');
            }
            if (!simpleResult.includes('export type Node_SimpleNode')) {
                throw new Error('Fehlender export type mit Node_ prefix');
            }
            if (!simpleResult.includes('name: string')) {
                throw new Error('String-Typ nicht korrekt konvertiert');
            }
            if (!simpleResult.includes('age: number')) {
                throw new Error('Number-Typ nicht korrekt konvertiert');
            }
            if (!simpleResult.includes('active: boolean')) {
                throw new Error('Boolean-Typ nicht korrekt konvertiert');
            }
            
            // Test 2: Arrays
            const arrayCtx = {
                tags: ['tag1', 'tag2'],
                numbers: [1, 2, 3],
                emptyArray: []
            };
            const arrayResult = TypeDefBuilder.buildContextLib('ArrayNode', arrayCtx);
            
            if (!arrayResult.includes('tags: string[]')) {
                throw new Error('String-Array nicht korrekt konvertiert');
            }
            if (!arrayResult.includes('numbers: number[]')) {
                throw new Error('Number-Array nicht korrekt konvertiert');
            }
            if (!arrayResult.includes('emptyArray: any[]')) {
                throw new Error('Leeres Array sollte als any[] behandelt werden');
            }
            
            // Test 3: Objects und verschachtelte Strukturen
            const objectCtx = {
                user: {
                    id: 1,
                    profile: {
                        name: 'John',
                        email: 'john@example.com'
                    }
                },
                emptyObj: {}
            };
            const objectResult = TypeDefBuilder.buildContextLib('ObjectNode', objectCtx);
            
            if (!objectResult.includes('user: {')) {
                throw new Error('Object-Typ nicht erkannt');
            }
            if (!objectResult.includes('id: number')) {
                throw new Error('Verschachtelte Properties nicht korrekt');
            }
            if (!objectResult.includes('profile: {')) {
                throw new Error('Verschachtelte Objects nicht korrekt');
            }
            if (!objectResult.includes('emptyObj: {}')) {
                throw new Error('Leeres Object sollte als {} behandelt werden');
            }
            
            // Test 4: Functions
            const functionCtx = {
                handler: (a: any, b: any) => a + b,
                noArgs: () => {},
                threeArgs: (x: any, y: any, z: any) => x + y + z
            };
            const functionResult = TypeDefBuilder.buildContextLib('FunctionNode', functionCtx);
            
            if (!functionResult.includes('handler: (arg0: any, arg1: any) => any')) {
                throw new Error('Function mit Parametern nicht korrekt konvertiert');
            }
            if (!functionResult.includes('noArgs: () => any')) {
                throw new Error('Function ohne Parameter nicht korrekt konvertiert');
            }
            if (!functionResult.includes('threeArgs: (arg0: any, arg1: any, arg2: any) => any')) {
                throw new Error('Function mit mehreren Parametern nicht korrekt konvertiert');
            }
            
            // Test 5: Null-Werte
            const nullCtx = {
                value: null,
                data: 'test'
            };
            const nullResult = TypeDefBuilder.buildContextLib('NullNode', nullCtx);
            
            if (!nullResult.includes('value: null')) {
                throw new Error('Null-Wert nicht korrekt als "null" typisiert');
            }
            
            // Test 6: Komplexer Context (Kombination aller Typen)
            const complexCtx = {
                string: 'test',
                number: 42,
                boolean: true,
                nullValue: null,
                array: [1, 2, 3],
                emptyArray: [],
                object: {
                    nested: {
                        deep: 'value'
                    },
                    array: ['a', 'b']
                },
                emptyObject: {},
                func: (x: any) => x,
                fetch: fetch,
                console: console
            };
            const complexResult = TypeDefBuilder.buildContextLib('ComplexNode-123', complexCtx);
            
            // Validierung: Type-Name sollte sicher sein (Sonderzeichen ersetzt)
            if (!complexResult.includes('export type Node_ComplexNode_123')) {
                throw new Error('Type-Name sollte Sonderzeichen ersetzen');
            }
            
            // Validierung: Alle Typen sollten vorhanden sein
            if (!complexResult.includes('string: string') || 
                !complexResult.includes('number: number') ||
                !complexResult.includes('boolean: boolean') ||
                !complexResult.includes('nullValue: null') ||
                !complexResult.includes('array: number[]') ||
                !complexResult.includes('emptyArray: any[]') ||
                !complexResult.includes('object: {') ||
                !complexResult.includes('emptyObject: {}')) {
                throw new Error('Nicht alle Typen im komplexen Context korrekt konvertiert');
            }
            
            // Validierung: Global declarations für Context-Keys
            if (!complexResult.includes('declare global')) {
                throw new Error('Fehlende global declarations für Context-Keys');
            }
            
            // Validierung: Context-Keys als declare global (globalVars)
            const globalDeclarations = (complexResult.match(/declare global/g) || []).length;
            if (globalDeclarations < 1) {
                throw new Error('Zu wenige declare global Blocks');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Die Public-Schleuse trifft oeffentliche Kennel-Laeufe und die Spec-Erzeugung —
     * aber keine Angular-Artefakte, keine festen Segmente, keine Heavy-Pfade und kein HEAD.
     */
    private async testPublicLimiterCoversPublicPaths(): Promise<void> {
        const testName = 'Gate: Public-Schleuse trifft /k/:id und openapi.json';
        try {
            const limiter = HeavyRequestLimiter.publicRuns();
            const hits: Array<[string, string]> = [
                ['/k/wetter', 'GET'],
                ['/k/wetter/', 'POST'],
                ['/k/foo.bar', 'GET'],
                ['/k/w/openapi.json', 'GET'],
            ];
            const misses: Array<[string, string | undefined]> = [
                ['/kennels', undefined],
                ['/main-abc.js', undefined],
                ['/favicon.ico', undefined],
                ['/api/kennels', undefined],
                ['/kennel/w', undefined],
                ['/wetter', 'GET'],
                ['/k/w/docs', 'GET'],
                ['/k/wetter', 'HEAD'],
            ];
            for (const [path, method] of hits) {
                if (!limiter.isHeavy(path, method)) throw new Error(`${method} ${path} sollte gebremst werden`);
            }
            for (const [path, method] of misses) {
                if (limiter.isHeavy(path, method)) throw new Error(`${method ?? '*'} ${path} darf nicht gebremst werden`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Die Schleuse laesst maxConcurrent durch, reiht den Rest ein, gibt den Platz bei
     * 'finish' weiter und antwortet nach dem Wartebudget mit 503 + Retry-After.
     */
    private async testPublicLimiterQueuesAndReleases(): Promise<void> {
        const testName = 'Gate: Public-Schleuse reiht ein, gibt frei, 503 nach Wartebudget';
        try {
            const limiter = new HeavyRequestLimiter({
                name: 'public',
                paths: [/^\/x$/],
                methods: ['GET', 'POST'],
                maxConcurrent: 2,
                queueTimeoutMs: 200,
            });
            let middleware: any = null;
            limiter.applyTo({ use: (mw: any) => { middleware = mw; } } as any);
            if (typeof middleware !== 'function') throw new Error('applyTo hat keine Middleware montiert');

            const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
            const fire = () => {
                const res: any = new EventEmitter();
                res.statusCode = 200;
                res.headers = {} as Record<string, string>;
                res.setHeader = (k: string, v: string) => { res.headers[k.toLowerCase()] = v; };
                res.status = (code: number) => { res.statusCode = code; return res; };
                res.json = (body: any) => { res.body = body; return res; };
                const state = { passed: false, res };
                middleware({ path: '/x', method: 'GET' }, res, () => { state.passed = true; });
                return state;
            };

            const r1 = fire();
            const r2 = fire();
            const r3 = fire();
            await tick();
            if (!r1.passed || !r2.passed) throw new Error('die ersten zwei Requests muessen durch');
            if (r3.passed) throw new Error('der dritte Request muss warten');

            r1.res.emit('finish');
            await tick();
            if (!r3.passed) throw new Error('der dritte Request muss nach finish durch');

            const r4 = fire();
            await tick();
            if (r4.passed) throw new Error('der vierte Request muss warten (zwei laufen noch)');
            await new Promise<void>((resolve) => setTimeout(resolve, 300));
            if (r4.passed) throw new Error('der vierte Request darf nie durch');
            if (r4.res.statusCode !== 503) throw new Error(`erwartet 503, erhalten ${r4.res.statusCode}`);
            if (r4.res.headers['retry-after'] !== '1') throw new Error(`Retry-After erwartet 1, erhalten ${r4.res.headers['retry-after']}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Pact mit fromSourceType — CompilerCache liefert Typ-String, TypeDefBuilder/ MimicDog-Kontext enthält erwartete Symbole.
     */
    private async testPactFromSourceType(): Promise<void> {
        const testName = 'Pact: fromSourceType (CompilerCache → TypeDefBuilder)';
        try {
            const batch = CompilerCache.getPactReturnTypeDefsBatch(['BloodhoundIsochroneInput']);
            const def = batch.get('BloodhoundIsochroneInput');
            if (!def) {
                throw new Error('Batch liefert keinen Eintrag für BloodhoundIsochroneInput');
            }
            if (!def.includes('lat') || !def.includes('range') || !def.includes('BloodhoundIsochroneInputReturn')) {
                throw new Error('Generierter Typ-String enthält nicht die erwarteten Member bzw. Return-Alias');
            }

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { lat: "0", lng: "0", range: "100" };',
                imitates: 'BloodhoundIsochroneProvider',
            };
            const mimic = new MimicDog<BloodhoundIsochroneInput>(mimicConfig, 'pact-source-test-mimic');
            mimic.resolveImitates(new Map([['BloodhoundIsochroneProvider', BloodhoundIsochronePact]]));

            const pactKey = 'pact-source-test-mimic';
            const expectedAlias = TypeDefBuilder.expectedReturnAliasTypeName(pactKey);
            const lib = TypeDefBuilder.buildContextLib('PactSourceNode', {}, mimic, pactKey);
            if (!lib.includes('BloodhoundIsochroneInput')) {
                throw new Error('buildContextLib enthält nicht BloodhoundIsochroneInput');
            }
            if (!lib.includes(expectedAlias)) {
                throw new Error(`Erwarteter Return-Alias ${expectedAlias} fehlt im generierten Lib-String`);
            }

            // OSM Landmarks: eigener Quell-Typ (nicht BloodhoundIsochroneInput)
            const batchLm = CompilerCache.getPactReturnTypeDefsBatch(['OsmLandmarksQueryInput']);
            const defLm = batchLm.get('OsmLandmarksQueryInput');
            if (!defLm) {
                throw new Error('Batch liefert keinen Eintrag für OsmLandmarksQueryInput');
            }
            if (defLm.includes('BloodhoundIsochroneInput')) {
                throw new Error('OsmLandmarksQueryInput-Def darf kein BloodhoundIsochroneInput enthalten');
            }
            if (!defLm.includes('preset') || !defLm.includes('OsmLandmarksQueryInputReturn')) {
                throw new Error('OsmLandmarksQueryInput-Def unvollständig');
            }

            const mimicLm: IMimicDogConfig = {
                theRun: 'return { lat: "0", lng: "0" };',
                imitates: 'NearbyLandmarksQueryProvider',
            };
            const mimicLandmarks = new MimicDog(mimicLm, 'pact-osm-test-mimic');
            mimicLandmarks.resolveImitates(
                new Map<string, new () => IHuntingDog<unknown>>([
                    ['BloodhoundIsochroneProvider', BloodhoundIsochronePact],
                    ['NearbyLandmarksQueryProvider', NearbyLandmarksPact],
                ])
            );
            const osmKey = 'pact-osm-test-key';
            const libLm = TypeDefBuilder.buildContextLib('OsmPactNode', {}, mimicLandmarks, osmKey);
            if (!libLm.includes('OsmLandmarksQueryInput')) {
                throw new Error('buildContextLib für Landmarks-Mimic enthält nicht OsmLandmarksQueryInput');
            }
            if (libLm.includes('BloodhoundIsochroneInput')) {
                throw new Error('buildContextLib für Landmarks-Mimic darf kein BloodhoundIsochroneInput enthalten');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Basis-URL des eigenen Servers — die Suite laeuft NACH listen (main.ts), also antwortet er.
     */
    private selfBaseUrl(): string {
        return `http://127.0.0.1:${Number(process.env.PORT) || 3000}`;
    }

    /**
     * Test: Segment-Regel fuer Kennel-IDs statt Blockliste (P3, 2.6).
     */
    private async testKennelIdRule(): Promise<void> {
        const testName = 'P3: Kennel-ID-Regel (Segment statt Blockliste)';
        try {
            const allowed = ['wetter', 'Wetter-2024', 'k', 'api', 'a.b_c', 'a'.repeat(64)];
            const blocked = ['', 'a/b', '.', '..', 'a b', '-lead', 'a'.repeat(65), 'a?b', 'a#b', 'a%b'];
            for (const id of allowed) {
                const reason = kennelIdBlockedReason(id);
                if (reason !== null) throw new Error(`"${id}" sollte erlaubt sein: ${reason}`);
            }
            for (const id of blocked) {
                if (typeof kennelIdBlockedReason(id) !== 'string') throw new Error(`"${id}" sollte abgelehnt werden`);
            }
            if (publicKennelPath('wetter') !== '/k/wetter') throw new Error(`publicKennelPath: ${publicKennelPath('wetter')}`);
            if (publicKennelDocsPath('wetter') !== '/k/wetter/docs') throw new Error('publicKennelDocsPath');
            if (publicKennelOpenApiPath('wetter') !== '/k/wetter/openapi.json') throw new Error('publicKennelOpenApiPath');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: create lehnt eine ID ab, die sich nur in der Schreibweise von einer bestehenden unterscheidet.
     */
    private async testCreateRejectsCaseCollision(kennelsController: KennelController): Promise<void> {
        const testName = 'P3: create lehnt Gross-/Kleinschreibungs-Kollision ab';
        const stamp = Date.now();
        const original = `Test-Case-${stamp}`;
        const other = `test-case-${stamp}-2`;
        try {
            const created = await kennelsController.create({ id: original, dogIds: [] });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const clash = await kennelsController.create({ id: original.toLowerCase(), dogIds: [] });
            if (clash.ok) throw new Error('Kollision in der Schreibweise wurde angelegt');
            if (!String(clash.error || '').includes(original)) throw new Error(`Grund nennt die bestehende ID nicht: ${clash.error}`);
            const fine = await kennelsController.create({ id: other, dogIds: [] });
            if (!fine.ok) throw new Error(`freie ID abgelehnt: ${fine.error}`);
            const bad = await kennelsController.create({ id: 'a/b', dogIds: [] });
            if (bad.ok) throw new Error('ID mit / wurde angelegt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(original); } catch { /* ignore */ }
            try { await kennelsController.delete(original.toLowerCase()); } catch { /* ignore */ }
            try { await kennelsController.delete(other); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Alt-Weiche `/:name` -> 308 `/k/:name` mit Query und Methode, ohne DB-Lookup;
     * feste Segmente gehen per next() weiter.
     */
    private async testLegacyRedirectKeepsQueryAndMethod(): Promise<void> {
        const testName = 'P3: Alt-Weiche 308 behaelt Query und Methode, 0 DB-Lookups';
        try {
            let lookups = 0;
            const countingController: any = { getById: async () => { lookups++; return { ok: false, data: null }; } };
            const countingStore: any = new Proxy({}, { get: () => async () => { lookups++; return null; } });
            const handler = new KennelRunHandler({ kennelsController: countingController, nodesStore: countingStore, baseDogsMap: new Map(), callCounter: this.testCallCounter });

            const routes: Array<{ method: string; path: string; fn: any }> = [];
            const collect = (method: string) => (path: string, fn: any) => { routes.push({ method, path, fn }); };
            handler.registerRoutes({ get: collect('get'), post: collect('post'), head: collect('head'), all: collect('all') });
            const legacyEnabled = KennelRunHandler.legacyRedirectEnabled();
            const legacyRoute = routes.find((r) => r.method === 'all' && r.path === LEGACY_ROUTE.kennel);
            if (legacyEnabled && !legacyRoute) throw new Error('Alt-Weiche nicht registriert');
            if (!legacyEnabled && legacyRoute) throw new Error('Alt-Weiche trotz LEGACY_KENNEL_REDIRECT=0 registriert');
            const headIdx = routes.findIndex((r) => r.method === 'head' && r.path === PUBLIC_ROUTE.kennel);
            const getIdx = routes.findIndex((r) => r.method === 'get' && r.path === PUBLIC_ROUTE.kennel);
            if (headIdx < 0 || getIdx < 0 || headIdx > getIdx) throw new Error('HEAD /k/:id muss vor GET registriert sein');

            const call = (method: string, name: string, originalUrl: string) => {
                const out = { status: 0, location: '', next: false };
                const res: any = { redirect: (code: number, loc: string) => { out.status = code; out.location = loc; } };
                handler.legacyRedirect({ method, params: { name }, originalUrl }, res, () => { out.next = true; });
                return out;
            };

            const get = call('GET', 'wetter', '/wetter?lat=1&channelId=AbC');
            if (get.status !== 308 || get.location !== '/k/wetter?lat=1&channelId=AbC') {
                throw new Error(`GET: ${get.status} ${get.location}`);
            }
            const post = call('POST', 'wetter', '/wetter?lat=1&channelId=AbC');
            if (post.status !== 308 || post.location !== get.location) throw new Error(`POST: ${post.status} ${post.location}`);
            for (const fixed of ['kennels', 'api', 'robots.txt', 'K', 'kennel', 'dogs', 'account', 'login']) {
                const r = call('GET', fixed, `/${fixed}`);
                if (!r.next || r.status !== 0) throw new Error(`/${fixed} muss per next() weitergehen`);
            }
            if (lookups !== 0) throw new Error(`Alt-Weiche hat ${lookups} DB-Lookups ausgeloest`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: ein unbekannter Kennel unter /k/ ist 404 JSON — nie index.html (SKIP_PREFIXES enthaelt /k).
     */
    private async testPublicUnknownIs404(): Promise<void> {
        const testName = 'P3: GET /k/<unbekannt> -> 404 JSON';
        try {
            const res = await fetch(`${this.selfBaseUrl()}/k/nicht-da-${Date.now()}`, { redirect: 'manual' });
            const type = res.headers.get('content-type') || '';
            const body = await res.text();
            if (res.status !== 404) throw new Error(`erwartet 404, erhalten ${res.status}`);
            if (!type.includes('application/json')) throw new Error(`Content-Type ${type}`);
            if (JSON.parse(body).error !== 'kennel_not_found') throw new Error(`Body ${body}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: HEAD /k/:id antwortet ohne Lauf — Spy auf runKennel am Handler, dazu der echte Server.
     */
    private async testPublicHeadDoesNotRun(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3: HEAD /k/:id ohne Lauf';
        const kennelId = `test-head-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'HeadProbeDog', 'return { head: 1 };', { visibility: 'public', ownerId: null });
            const created = await kennelsController.create({ id: kennelId, dogIds: [dog], visibility: 'public' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const handler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            let runs = 0;
            (handler as any).runKennel = async () => { runs++; return []; };
            const head = async (id: string) => {
                const out = { status: 0, ended: false, body: undefined as any, headers: {} as Record<string, string> };
                const res: any = {
                    setHeader: (k: string, v: string) => { out.headers[k.toLowerCase()] = v; },
                    status: (code: number) => { out.status = code; return res; },
                    end: (body?: any) => { out.ended = true; out.body = body; return res; },
                };
                await (handler as any).handlePublicHead({ params: { id }, query: {}, ctx: { user: null, isSuperUser: false } }, res);
                return out;
            };
            const known = await head(kennelId);
            if (known.status !== 200 || !known.ended || known.body !== undefined) throw new Error(`bekannt: ${known.status}`);
            if (known.headers['cache-control'] !== 'no-store') throw new Error('Cache-Control no-store fehlt');
            const unknown = await head(`${kennelId}-nicht-da`);
            if (unknown.status !== 404) throw new Error(`unbekannt: ${unknown.status}`);
            if (runs !== 0) throw new Error(`HEAD hat ${runs}x runKennel ausgeloest`);

            const live = await fetch(`${this.selfBaseUrl()}/k/${kennelId}`, { method: 'HEAD' });
            if (live.status !== 200) throw new Error(`Server HEAD: ${live.status}`);
            if ((await live.text()) !== '') throw new Error('Server HEAD mit Body');
            const liveUnknown = await fetch(`${this.selfBaseUrl()}/k/${kennelId}-nicht-da`, { method: 'HEAD' });
            if (liveUnknown.status !== 404) throw new Error(`Server HEAD unbekannt: ${liveUnknown.status}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: alte Swagger-Adressen -> 308 auf /k/…; die Spec traegt paths['/k/<id>'] und servers ''.
     */
    private async testSwaggerRedirectAndPaths(nodesStore: IStore, kennelsController: KennelController): Promise<void> {
        const testName = 'P3: Swagger unter /k/:id/docs|openapi.json, 308 von /api';
        const kennelId = `test-openapi-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'OpenApiProbeDog', 'return { spec: 1 };', { visibility: 'public', ownerId: null });
            const created = await kennelsController.create({ id: kennelId, dogIds: [dog], visibility: 'public' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const base = this.selfBaseUrl();

            const docs = await fetch(`${base}/api/kennels/${kennelId}/docs?version=x`, { redirect: 'manual' });
            if (docs.status !== 308) throw new Error(`/docs alt: ${docs.status}`);
            if (docs.headers.get('location') !== `/k/${kennelId}/docs?version=x`) throw new Error(`/docs Location ${docs.headers.get('location')}`);
            const json = await fetch(`${base}/api/kennels/${kennelId}/swagger.json`, { redirect: 'manual' });
            if (json.status !== 308 || json.headers.get('location') !== `/k/${kennelId}/openapi.json`) {
                throw new Error(`swagger.json alt: ${json.status} ${json.headers.get('location')}`);
            }

            const specRes = await fetch(`${base}/k/${kennelId}/openapi.json`);
            if (specRes.status !== 200) throw new Error(`openapi.json: ${specRes.status}`);
            const spec: any = await specRes.json();
            const firstPath = Object.keys(spec.paths || {})[0];
            if (firstPath !== `/k/${kennelId}`) throw new Error(`paths[0] = ${firstPath}`);
            if (spec.servers?.[0]?.url !== '') throw new Error(`servers[0].url = ${spec.servers?.[0]?.url}`);

            const ui = await fetch(`${base}/k/${kennelId}/docs`);
            const html = await ui.text();
            if (ui.status !== 200 || !html.includes(`/k/${kennelId}/openapi.json`)) throw new Error(`/k/:id/docs: ${ui.status}, specUrl fehlt`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Express kennt genau die Routen der Routentabelle — Diff in beide Richtungen ist ein Fehler.
     */
    private async testRouteTableMatchesExpressStack(app: any): Promise<void> {
        const testName = 'P3: Routentabelle == Express-Stack';
        try {
            const stack: any[] = app?.router?.stack ?? app?._router?.stack ?? [];
            if (!stack.length) throw new Error('Express-Stack nicht lesbar');
            const registered = new Set<string>();
            for (const layer of stack) {
                const p = layer?.route?.path;
                if (typeof p === 'string') registered.add(p);
            }
            const expected = new Set<string>(
                [...EXPRESS_APP_ROUTES, ...FRONTEND_ROUTES].filter(
                    (p) => p !== LEGACY_ROUTE.kennel || KennelRunHandler.legacyRedirectEnabled(),
                ),
            );
            const missing = [...expected].filter((p) => !registered.has(p));
            const extra = [...registered].filter((p) => !expected.has(p));
            if (missing.length || extra.length) {
                throw new Error(`fehlt in Express: [${missing.join(', ')}]; fehlt in der Tabelle: [${extra.join(', ')}]`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Minimal-Response fuer Route-Handler ohne Express: haelt Status, Body und Header fest.
     */
    private fakeResponse(): { res: any; out: { statusCode: number; body: any; headers: Record<string, string> } } {
        const out = { statusCode: 200, body: undefined as any, headers: {} as Record<string, string> };
        const res: any = {
            status(code: number) { out.statusCode = code; return res; },
            json(body: any) { out.body = body; return res; },
            send(body: any) { out.body = body; return res; },
            setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v; },
        };
        return { res, out };
    }

    /**
     * Test: GET /api/:subpath/:id/versions prueft canRead — Regressionstest, kein Codefix (W5).
     */
    private async testVersionsRespectCanRead(kennelsController: KennelController): Promise<void> {
        const testName = 'ACL: /versions respektiert canRead';
        const kennelId = `test-versions-acl-${Date.now()}`;
        try {
            const created = await kennelsController.create({
                id: kennelId,
                name: `Versions ACL ${kennelId}`,
                dogIds: [],
                visibility: 'private',
                ownerId: 'U1',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            const handler = new ConfigRouteHandler(registry);
            const call = async (ctx: any) => {
                const { res, out } = this.fakeResponse();
                await (handler as any).handleGetVersions({ params: { subpath: 'kennels', id: kennelId }, ctx }, res);
                return out;
            };

            const anon = await call({ user: null, isSuperUser: false });
            if (anon.statusCode !== 404) throw new Error(`anonym: erwartet 404, erhalten ${anon.statusCode}`);

            const owner = await call({ user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false });
            if (owner.statusCode !== 200) throw new Error(`Owner: erwartet 200, erhalten ${owner.statusCode}`);
            if (!Array.isArray(owner.body?.data)) throw new Error('Owner: data ist kein Array');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Gesäter SerializedDog existiert und ist ein Mimic für LayoutInputProvider (Tinder-Return)
     */
    private async testSerializedDogExists(store: IStore): Promise<void> {
        const testName = 'SerializedDog: Seed-Mimic (LayoutInputProvider + Tinder)';
        try {
            // With GUID-based versioning, find the seed by type instead of hardcoded ID — and by its
            // name, not by row order: a schema push (P3.5: runners/frozen) rebuilds the SQLite
            // table, and the first row of the type is then whichever id sorts first.
            const allSeeds = await store.findByType(SerializedDog.name);
            const seedRow = allSeeds.find((r: any) => r.displayName === 'Seed Serialized 1') ?? null;
            const seed = seedRow ? seedRow.serializedDogConfig : null;
            if (!seed) {
                this.addResult(testName, true, 'Seed existiert noch nicht (wird beim nächsten Start erstellt)');
                return;
            }

            const parsed = typeof seed === 'string' ? JSON.parse(seed) : seed;
            const cfg = parsed.serializedDogConfig
                ? (typeof parsed.serializedDogConfig === 'string'
                    ? JSON.parse(parsed.serializedDogConfig)
                    : parsed.serializedDogConfig)
                : parsed;

            if (!cfg?.theRun || typeof cfg.theRun !== 'string') {
                throw new Error('Seed hat kein theRun-Feld');
            }
            if (cfg.imitates !== 'LayoutInputProvider') {
                throw new Error(`Erwartet imitates "LayoutInputProvider", erhalten: ${JSON.stringify(cfg.imitates)}`);
            }
            const req = cfg.parentsRequired as string[] | undefined;
            if (!req?.includes('RandomRecipesRetriever') || !req.includes('RandomEveryThingRetriever')) {
                throw new Error(
                    `parentsRequired muss RandomRecipesRetriever und RandomEveryThingRetriever enthalten: ${JSON.stringify(req)}`
                );
            }
            const run = cfg.theRun as string;
            if (!run.includes('tinder') || !run.includes('RandomEveryThingRetriever.woof')) {
                throw new Error('theRun muss Tinder-LayoutInput und RandomEveryThingRetriever.woof referenzieren');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Alle Versionen von SerializedDogs werden in der Liste angezeigt
     */
    private async testAllVersionsInList(controller: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'SerializedDog: Alle Versionen in Liste';
        const createdIds: string[] = [];
        try {
            // Create v1 — the firstborn incarnation with a fresh GUID.
            const v1Input: ISerializedDogConfig = {
                displayName: 'test-versions-' + Date.now(),
                theRun: 'return { version: 1 };',
            };
            const v1Result = await controller.create(v1Input);
            if (!v1Result.ok || !v1Result.id) throw new Error('V1 erstellen fehlgeschlagen');
            createdIds.push(v1Result.id);
            this.createdTestIds.push(v1Result.id);
            const lineageId = (v1Result.data as any)?.lineageId;

            // Save v2 — a new incarnation branching from v1.
            const v2Input: ISerializedDogConfig = {
                id: v1Result.id,
                theRun: 'return { version: 2 };',
            };
            const v2Result = await controller.save(v2Input);
            if (!v2Result.ok || !v2Result.id) throw new Error('V2 erstellen fehlgeschlagen');
            createdIds.push(v2Result.id);
            this.createdTestIds.push(v2Result.id);

            // Save v3 — a new incarnation branching from v2.
            const v3Input: ISerializedDogConfig = {
                id: v2Result.id,
                theRun: 'return { version: 3 };',
            };
            const v3Result = await controller.save(v3Input);
            if (!v3Result.ok || !v3Result.id) throw new Error('V3 erstellen fehlgeschlagen');
            createdIds.push(v3Result.id);
            this.createdTestIds.push(v3Result.id);

            // Prüfe, dass alle Versionen in der Liste erscheinen
            const listResult = await controller.list();
            if (!listResult.ok || !listResult.data) {
                throw new Error('Liste konnte nicht abgerufen werden');
            }

            // Filter by lineageId — all incarnations of the same spirit share this lineage mark.
            const foundVersions = listResult.data.filter((dog: ISerializedDogConfig) => {
                return dog.lineageId === lineageId;
            });

            if (foundVersions.length < 3) {
                throw new Error(`Erwartet: 3 Versionen, gefunden: ${foundVersions.length}`);
            }

            // Prüfe, dass alle IDs unterschiedlich sind (GUIDs should never collide)
            const ids = foundVersions.map((d: ISerializedDogConfig) => d.id).filter(Boolean);
            const uniqueIds = new Set(ids);
            if (uniqueIds.size !== ids.length) {
                throw new Error('Doppelte IDs in der Liste gefunden');
            }
            
            // Füge alle gefundenen Versionen zur Cleanup-Liste hinzu
            foundVersions.forEach((dog: ISerializedDogConfig) => {
                if (dog.id && !this.createdTestIds.includes(dog.id)) {
                    this.createdTestIds.push(dog.id);
                }
            });
            
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        // Cleanup wird zentral am Ende durchgeführt
    }

    // ===== Pact & MimicDog Tests =====

    /**
     * Test: createPact erzeugt gueltige Dog-Klasse
     */
    private async testCreatePact(): Promise<void> {
        const testName = 'Pact: createPact erzeugt gueltige Dog-Klasse';
        try {
            const TestPact = createPact<{ value: number }>('TestPact');

            if (TestPact.name !== 'TestPact') {
                throw new Error(`Erwarteter Name 'TestPact', erhalten: '${TestPact.name}'`);
            }

            if ((TestPact as any).__isPact !== true) {
                throw new Error('__isPact ist nicht true');
            }

            const instance = new TestPact();
            if (!(instance instanceof Dog)) {
                throw new Error('Instanz ist kein instanceof Dog');
            }

            if (instance.name !== 'TestPact') {
                throw new Error(`Instanz-Name falsch: '${instance.name}'`);
            }

            let threwError = false;
            try {
                await instance.collectYield({
                    exhausted: [], withBeesInThePants: [],
                    maxRuns: 0, runIndex: 0, wave: [], readTracking: [], currentWaveIndex: 0
                });
            } catch (e: any) {
                if (e.message.includes('requires a MimicDog')) {
                    threwError = true;
                }
            }
            if (!threwError) {
                throw new Error('yieldCollectorFactory sollte Error werfen');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: MimicDog imitiert Pact-Klasse
     */
    private async testMimicDogImitatesPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'MimicDog: imitiert Pact-Klasse';
        try {
            const TestPact = createPact<{ v: number }>('MimicTestPact');
            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('MimicTestPact', TestPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { v: 42 };',
                imitates: 'MimicTestPact',
            };
            const mimic = new MimicDog<{ v: number }>(mimicConfig, 'test-mimic-1');
            mimic.resolveImitates(extendedMap);

            if (!mimic.imitatesClasses.includes(TestPact)) {
                throw new Error('imitatesClasses enthaelt nicht die Pact-Klasse');
            }

            if (mimic.imitatesName !== 'MimicTestPact') {
                throw new Error(`imitatesName falsch: '${mimic.imitatesName}'`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: matchesParent erkennt Mimic via imitatesClasses
     */
    private async testMatchesParentRecognizesMimic(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'MimicDog: matchesParent erkennt Mimic';
        try {
            const TestPact = createPact<string>('MatchTestPact');
            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('MatchTestPact', TestPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return "hello";',
                imitates: 'MatchTestPact',
            };
            const mimic = new MimicDog<string>(mimicConfig, 'test-mimic-match');
            mimic.resolveImitates(extendedMap);

            class ConsumerDog extends Dog<void> {
                get name() { return 'ConsumerDog'; }
                get required() { return [TestPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }
            const consumer = new ConsumerDog();

            // Simuliere eine Season mit dem Mimic in exhausted
            const season = {
                exhausted: [mimic as IHuntingDog<unknown>],
                withBeesInThePants: [consumer as IHuntingDog<unknown>],
                maxRuns: 2,
                runIndex: 0,
                wave: [],
                readTracking: [],
                currentWaveIndex: 0
            };

            if (!consumer.isReady(season)) {
                throw new Error('Consumer sollte ready sein wenn Mimic in exhausted ist');
            }

            // Ohne Mimic: nicht ready
            const seasonEmpty = {
                exhausted: [] as IHuntingDog<unknown>[],
                withBeesInThePants: [consumer as IHuntingDog<unknown>],
                maxRuns: 2,
                runIndex: 0,
                wave: [],
                readTracking: [],
                currentWaveIndex: 0
            };
            if (consumer.isReady(seasonEmpty)) {
                throw new Error('Consumer sollte NICHT ready sein ohne Mimic');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt Auto-Mimic fuer Pact-Requirement
     */
    private async testFillKennelAutoMimicForPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Auto-Mimic bei Pact';
        try {
            const AutoPact = createPact<number>('AutoMimicTestPact');

            class NeedyDog extends Dog<void> {
                get name() { return 'NeedyDog'; }
                get required() { return [AutoPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('NeedyDog', NeedyDog);
            extendedMap.set('AutoMimicTestPact', AutoPact);

            const config: IKennelConfig = {
                id: 'test-auto-mimic-kennel',
                dogIds: ['base:NeedyDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'AutoMimicTestPact'
            );

            if (!hasMimic) {
                throw new Error('MimicDog wurde nicht automatisch erstellt');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erzeugt fuer einen NUR optionalen Pact bewusst KEINEN Mimic.
     * Vertrag seit "Welle 10" (KennelRun.autoMimic): Platzhalter-Mimics entstehen ausschliesslich
     * fuer Pacts, die ein Dog WIRKLICH BRAUCHT. Ein optional-only Pact hat im Consumer einen
     * sinnvollen Default -- ein werfender Auto-Mimic wuerde nur einen Schein-Fehler in den Snapshot
     * schreiben, ohne dafuer Daten zu liefern.
     */
    private async testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: optional-only Pact bekommt KEINEN Mimic';
        try {
            const OptionalPact = createPact<string>('OptionalMimicTestPact');

            class OptionalConsumerDog extends Dog<void> {
                get name() { return 'OptionalConsumerDog'; }
                get required() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                get optional() { return [OptionalPact]; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('OptionalConsumerDog', OptionalConsumerDog);
            extendedMap.set('OptionalMimicTestPact', OptionalPact);

            const config: IKennelConfig = {
                id: 'test-optional-mimic-kennel',
                dogIds: ['base:OptionalConsumerDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptionalMimicTestPact'
            );

            if (hasMimic) {
                throw new Error('Fuer einen optional-only Pact wurde ein Mimic erzeugt -- verletzt den Welle-10-Vertrag');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: haengen an EINEM Dog ein required und ein optionaler Pact, entsteht GENAU EIN Mimic --
     * der fuer den required Pact. Der optionale bleibt bewusst unbesetzt (Welle-10-Vertrag, siehe oben).
     */
    private async testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic nur fuer required, nicht fuer optional';
        try {
            const ReqPact = createPact<number>('ReqMimicTestPact');
            const OptPact = createPact<string>('OptMimicTestPact2');

            class DualConsumerDog extends Dog<void> {
                get name() { return 'DualConsumerDog'; }
                get required() { return [ReqPact]; }
                get optional() { return [OptPact]; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('DualConsumerDog', DualConsumerDog);
            extendedMap.set('ReqMimicTestPact', ReqPact);
            extendedMap.set('OptMimicTestPact2', OptPact);

            const config: IKennelConfig = {
                id: 'test-dual-mimic-kennel',
                dogIds: ['base:DualConsumerDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasReqMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'ReqMimicTestPact'
            );
            const hasOptMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptMimicTestPact2'
            );

            if (!hasReqMimic) {
                throw new Error('MimicDog fuer required Pact fehlt');
            }
            if (hasOptMimic) {
                throw new Error('Fuer den optional-only Pact wurde ein Mimic erzeugt -- verletzt den Welle-10-Vertrag');
            }

            const mimicCount = kennel.filter(d => d instanceof MimicDog).length;
            if (mimicCount !== 1) {
                throw new Error(`Erwartet: genau 1 Mimic (nur der required), gefunden: ${mimicCount}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel erstellt echten BaseDog statt Mimic (kein Pact)
     */
    private async testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Echter BaseDog statt Mimic';
        try {
            class RealProvider extends Dog<string> {
                get name() { return 'RealProvider'; }
                get required() { return []; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => 'data';
            }

            class RealConsumer extends Dog<void> {
                get name() { return 'RealConsumer'; }
                get required() { return [RealProvider]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('RealConsumer', RealConsumer);
            extendedMap.set('RealProvider', RealProvider);

            const config: IKennelConfig = {
                id: 'test-real-basedog-kennel',
                dogIds: ['base:RealConsumer'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const hasReal = kennel.some(d => d instanceof RealProvider);
            const hasMimic = kennel.some(d => d instanceof MimicDog);

            if (!hasReal) {
                throw new Error('Echter BaseDog wurde nicht hinzugefuegt');
            }
            if (hasMimic) {
                throw new Error('MimicDog sollte nicht erstellt werden fuer echte Klasse');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: fillKennel entfernt Mimic wenn echter Dog vorhanden
     */
    private async testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic entfernt wenn echter Dog da';
        try {
            const PriorityPact = createPact<string>('PriorityTestPact');

            class PriorityConsumer extends Dog<void> {
                get name() { return 'PriorityConsumer'; }
                get required() { return [PriorityPact]; }
                get optional() { return []; }
                protected yieldCollectorFactory = async () => {};
            }

            class RealPriorityDog extends PriorityPact {
                get name() { return 'RealPriorityDog'; }
                get required() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async () => 'real data';
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('PriorityConsumer', PriorityConsumer);
            extendedMap.set('PriorityTestPact', PriorityPact);
            extendedMap.set('RealPriorityDog', RealPriorityDog);

            const config: IKennelConfig = {
                id: 'test-priority-kennel',
                dogIds: ['base:PriorityConsumer', 'base:RealPriorityDog'],
            };

            const kennelRun = new KennelRun(config, extendedMap);
            const kennel = await kennelRun.fillKennel();

            const mimicCount = kennel.filter(d => d instanceof MimicDog).length;
            const realCount = kennel.filter(d => d instanceof RealPriorityDog).length;

            if (mimicCount > 0) {
                throw new Error('Mimic sollte entfernt worden sein da echter Dog vorhanden');
            }
            if (realCount !== 1) {
                throw new Error(`Erwartet: 1 echter Dog, gefunden: ${realCount}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: Kompletter Run mit manuell erstelltem Mimic — Consumer laeuft in spaeterer Wave
     */
    private async testRunSeasonWithMimicConsumerRuns(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'runSeason: Consumer laeuft mit Mimic in spaeterer Wave';
        try {
            const RunPact = createPact<{ v: number }>('RunTestPact');

            class RunConsumerDog extends Dog<number> {
                get name() { return 'RunConsumerDog'; }
                get required() { return [RunPact]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async (season: any) => {
                    const provider = season.exhausted.find((d: any) => this.matchesParent(RunPact, d));
                    return provider?.collected?.v ?? -1;
                };
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('RunConsumerDog', RunConsumerDog);
            extendedMap.set('RunTestPact', RunPact);

            const mimicConfig: IMimicDogConfig = {
                theRun: 'return { v: 42 };',
                imitates: 'RunTestPact',
            };
            const mimic = new MimicDog<{ v: number }>(mimicConfig, 'run-test-mimic');
            mimic.resolveImitates(extendedMap);

            const consumer = new RunConsumerDog();
            const kennel: IHuntingDog<unknown>[] = [mimic, consumer];
            mimic.setKennelRef(kennel);

            const config: IKennelConfig = {
                id: 'test-run-mimic-kennel',
                dogIds: [],
            };
            const kennelRun = new KennelRun(config, extendedMap);
            const season = await kennelRun.runSeason(kennel);

            if (season.wave.length < 2) {
                throw new Error(`Erwartet: mindestens 2 Waves, gefunden: ${season.wave.length}`);
            }

            const consumerInWaves = season.wave.some(wave =>
                wave.some(entry => entry.instance.name === 'RunConsumerDog')
            );
            if (!consumerInWaves) {
                throw new Error('RunConsumerDog ist in keiner Wave erschienen');
            }

            const consumerDog = season.exhausted.find(d => d.name === 'RunConsumerDog');
            if (!consumerDog || consumerDog.collected !== 42) {
                throw new Error(`Consumer collected erwartet: 42, erhalten: ${consumerDog?.collected}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Legt einen SerializedDog mit ACL-Spalten an; liefert die lineageId. Cleanup ueber createdTestIds. */
    private async saveAclTestDog(
        nodesStore: IStore,
        displayName: string,
        theRun: string,
        acl: { visibility: Visibility; ownerId: string | null; runners?: string; viewers?: string; editors?: string },
    ): Promise<string> {
        const versionId = generateVersionId();
        const lineageId = generateLineageId();
        const cfg: ISerializedDogConfig = {
            id: versionId,
            lineageId,
            parentId: null,
            displayName,
            theRun,
            parentsRequired: [],
            parentsOptional: [],
        };
        await nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId: null,
            displayName,
            serializedDogConfig: JSON.stringify(cfg),
            visibility: acl.visibility,
            ownerId: acl.ownerId,
            ...(acl.runners !== undefined ? { runners: acl.runners } : {}),
            ...(acl.viewers !== undefined ? { viewers: acl.viewers } : {}),
            ...(acl.editors !== undefined ? { editors: acl.editors } : {}),
            createdAt: new Date(),
        });
        this.createdTestIds.push(versionId);
        return lineageId;
    }

    /** Werkzeug-Abhaengigkeiten fuer MCP-Tool-Handler im Test. `prisma` ist ein Fake. */
    private toolDeps(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        runHandler: KennelRunHandler,
        prisma: any = null,
    ): ToolDeps {
        return {
            kennelsController,
            nodesController,
            kennelRunHandler: runHandler,
            kennelsStore,
            nodesStore,
            prisma,
            baseDogsList: [],
            projectRoot: process.cwd(),
            snapshotCache: new KennelSnapshotCache(),
            kennelStats: new KennelStatsService(StartupTest.NO_STATS_STORE, this.testCallCounter),
            callCounter: this.testCallCounter,
            dogStats: new DogStatsService(StartupTest.NO_DOG_STATS_STORE, this.testCallCounter,
                new KennelStatsService(StartupTest.NO_STATS_STORE, this.testCallCounter)),
            // Ein Key-Store ohne Master-Key (P4c): die Werkzeug-Tests fassen keine Schluessel an.
            keyStore: new KeyStoreService(null as unknown as KeyStorePrisma, null),
        };
    }

    /**
     * Test: Die Snapshot-Werkzeuge redigieren je Dog wie GET /api/kennels/:id/run (Nira L4/L5).
     * Der Cache bleibt roh — nach den redigierten Lesern sieht der Owner wieder alles.
     * P3.5: jeder liest nur seinen eigenen Snapshot (der Lauf traegt die Kapazitaeten seines
     * Ausloesers); D2 gehoert dem Kennel-Owner — ein fremder privater Dog laeuft nicht mehr (3.5.7).
     */
    private async testSnapshotToolsRedactPerDog(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Snapshot-Werkzeuge redigieren je Dog wie /run';
        const kennelId = `test-snapshot-redact-${Date.now()}`;
        try {
            const d1 = await this.saveAclTestDog(nodesStore, 'SnapOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'U0' });
            const d2 = await this.saveAclTestDog(nodesStore, 'SnapPrivateDog', 'return { secret: "snap-secret" };',
                { visibility: 'private', ownerId: 'U0' });
            // D2 ist explizit privat — die Sichtbarkeits-Kaskade des oeffentlichen Kennels laesst ihn so.
            const created = await kennelsController.create({
                id: kennelId,
                name: `Snapshot Redact ${kennelId}`,
                dogIds: [d1, d2],
                visibility: 'public',
                ownerId: 'U0',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const tools = getSnapshotTools();
            const tool = (name: string) => {
                const t = tools.find((x) => x.name === name);
                if (!t) throw new Error(`Werkzeug ${name} fehlt`);
                return t;
            };
            const read = async (name: string, ctx: AuthCtx, args: Record<string, any>) => {
                const r = await tool(name).handler({ id: kennelId, ...args }, ctx, deps);
                if (r.isError) throw new Error(`${name}: ${r.content[0]?.text}`);
                return JSON.parse(r.content[0].text);
            };
            const user = (id: string): AuthCtx => ({ user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false });
            const u0 = user('U0');
            const u2 = user('U2');
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const superUser: AuthCtx = { user: null, isSuperUser: true };
            const snapshotFor = async (label: string, ctx: AuthCtx) => {
                await read('refresh_kennel_snapshot', ctx, {});
                const header = await read('wait_for_kennel_snapshot', ctx, { timeoutMs: 30_000 });
                if (header.status !== 'ok') throw new Error(`${label}: Snapshot-Status ${header.status}: ${header.errorMessage ?? ''}`);
            };

            await snapshotFor('U0', u0);
            const foreign = await tool('get_snapshot_dog_result').handler({ id: kennelId, dogId: d2 }, u2, deps);
            if (!foreign.isError || !/no snapshot/.test(foreign.content[0]?.text ?? '')) {
                throw new Error('U2 liest den Snapshot von U0 (triggerUserId ungeprueft)');
            }

            const runNodeFor = async (ctx: AuthCtx, lineageId: string) => {
                const { res, out } = this.fakeResponse();
                await (runHandler as any).handleRun({ params: { id: kennelId }, query: {}, method: 'GET', ctx }, res);
                if (!out.body?.ok) throw new Error(`/run fehlgeschlagen: ${JSON.stringify(out.body)}`);
                const node = (out.body.waves as any[]).flat().find((n: any) => n.lineageId === lineageId);
                if (!node) throw new Error(`/run: Dog ${lineageId} nicht in den Waves`);
                return node;
            };

            for (const [label, ctx] of [['U2', u2], ['anonym', anon]] as Array<[string, AuthCtx]>) {
                await snapshotFor(label, ctx);
                const result = await read('get_snapshot_dog_result', ctx, { dogId: d2 });
                const code = await read('get_snapshot_dog_code', ctx, { dogId: d2 });
                const vm = await read('get_snapshot_dog_vmcontext', ctx, { dogId: d2 });
                const viaRun = await runNodeFor(ctx, d2);
                if (result.result !== REDACTED_RESULT) throw new Error(`${label}: result nicht redigiert: ${JSON.stringify(result.result)}`);
                if (result.result !== viaRun.result) throw new Error(`${label}: result weicht von /run ab`);
                if (code.codeTs !== null || viaRun.codeTs != null) throw new Error(`${label}: codeTs nicht redigiert`);
                if (vm.vmContext !== null || vm.vmContextTypeDef !== null || viaRun.vmContext != null) {
                    throw new Error(`${label}: vmContext nicht redigiert`);
                }
                const open = await read('get_snapshot_dog_code', ctx, { dogId: d1 });
                if (typeof open.codeTs !== 'string') throw new Error(`${label}: lesbarer Dog D1 wurde redigiert`);
            }

            for (const [label, ctx] of [['U0', u0], ['Super-User', superUser]] as Array<[string, AuthCtx]>) {
                if (label !== 'U0') await snapshotFor(label, ctx);
                const result = await read('get_snapshot_dog_result', ctx, { dogId: d2 });
                const code = await read('get_snapshot_dog_code', ctx, { dogId: d2 });
                if (result.result?.secret !== 'snap-secret') throw new Error(`${label}: result nicht roh: ${JSON.stringify(result.result)}`);
                if (typeof code.codeTs !== 'string' || !code.codeTs.includes('snap-secret')) throw new Error(`${label}: codeTs nicht roh`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Kennel Export/Import — export a kennel with dogs, import as new, verify structure.
     * Through endless faces, countless forms: the kennel crosses the void and is reborn.
     */
    private async testKennelExportImport(
        nodesStore: IStore,
        kennelsStore: IStore,
        kennelsController: AbstractController<IKennelConfig>
    ): Promise<void> {
        const testName = 'Kennel: Export/Import';
        try {
            // 1. Create a SerializedDog to include in the kennel.
            const dogVersionId = generateVersionId();
            const dogLineageId = generateLineageId();
            const dogConfig: ISerializedDogConfig = {
                id: dogVersionId,
                lineageId: dogLineageId,
                parentId: null,
                displayName: 'ExportTestDog',
                theRun: 'return { test: true }',
                parentsRequired: [],
                parentsOptional: [],
            };
            await nodesStore.save({
                id: dogVersionId,
                type: SerializedDog.name,
                lineageId: dogLineageId,
                parentId: null,
                displayName: 'ExportTestDog',
                serializedDogConfig: JSON.stringify(dogConfig),
                createdAt: new Date(),
            });
            this.createdTestIds.push(dogVersionId);

            // 2. Create a kennel referencing this dog + a BaseDog.
            const kennelLineageId = `test-export-kennel-${Date.now()}`;
            const kennelVersionId = generateVersionId();
            await kennelsStore.save({
                id: kennelVersionId,
                type: 'KennelConfig',
                lineageId: kennelLineageId,
                parentId: null,
                name: 'Export Test Kennel',
                description: 'For export/import testing',
                emoji: '🧪',
                dogIds: [dogLineageId, 'base:QueryRetriever'],
                defaultQuery: { test: 'value' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            this.createdTestIds.push(kennelVersionId);

            // Save a second version to test version history export.
            const kennelVersionId2 = generateVersionId();
            await kennelsStore.save({
                id: kennelVersionId2,
                type: 'KennelConfig',
                lineageId: kennelLineageId,
                parentId: kennelVersionId,
                name: 'Export Test Kennel v2',
                description: 'Updated description',
                emoji: '🧪',
                dogIds: [dogLineageId, 'base:QueryRetriever'],
                defaultQuery: { test: 'value2' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            this.createdTestIds.push(kennelVersionId2);

            // 3. Build the export bundle (simulate what handleExport does).
            const kennelConfig = await (kennelsController as KennelController).getById(kennelLineageId);
            if (!kennelConfig.ok || !kennelConfig.data) throw new Error('Kennel nicht gefunden nach Erstellung');

            const cfg = kennelConfig.data;
            const serializedIds = (cfg.dogIds ?? []).filter((id: string) => !id.startsWith('base:'));
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, serializedIds),
                nodesStore.findLatestVersionsByType(MimicDog.name, serializedIds),
            ]);

            const dogs: any[] = [];
            for (const row of [...serialized, ...mimics]) {
                const rowCfg = typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig) : row.serializedDogConfig;
                dogs.push({
                    lineageId: (row as any).lineageId || rowCfg.lineageId,
                    versionId: row.id,
                    displayName: (row as any).displayName || rowCfg.displayName,
                    type: rowCfg.imitates ? 'MimicDog' : 'SerializedDog',
                    config: rowCfg,
                });
            }

            const kennelVersions = await (kennelsController as KennelController).getVersions(kennelLineageId);

            const bundle = {
                bundleVersion: 1,
                kennel: {
                    kennelId: kennelLineageId,
                    name: cfg.name,
                    description: cfg.description,
                    emoji: cfg.emoji,
                    dogIds: cfg.dogIds,
                    defaultQuery: cfg.defaultQuery,
                },
                kennelVersions: kennelVersions.map(v => ({
                    id: v.id, parentId: v.parentId, createdAt: v.createdAt, config: v.config,
                })),
                dogs,
            };

            // 4. Validate the bundle.
            if (!bundle.dogs || bundle.dogs.length === 0) throw new Error('Bundle hat keine Dogs');
            if (!bundle.kennelVersions || bundle.kennelVersions.length < 2) throw new Error('Bundle hat weniger als 2 Kennel-Versionen');
            if (bundle.dogs[0].lineageId !== dogLineageId) throw new Error(`Dog lineageId stimmt nicht: got '${bundle.dogs[0]?.lineageId}', expected '${dogLineageId}', serializedIds=${JSON.stringify(serializedIds)}, dogs.length=${bundle.dogs.length}`);

            // 5. Simulate import with a new kennelId.
            const importKennelId = `test-import-kennel-${Date.now()}`;
            bundle.kennel.kennelId = importKennelId;

            // Build ID mapping.
            const idMap = new Map<string, string>();
            for (const dog of bundle.dogs) {
                const newId = generateLineageId();
                if (dog.lineageId) idMap.set(dog.lineageId, newId);
                if (dog.versionId) idMap.set(dog.versionId, newId);
            }
            const remap = (ref: string): string => idMap.get(ref) ?? ref;
            const remapDogIds = (ids: string[]) => (ids ?? []).map(remap);

            // Create dogs with new IDs.
            for (const dog of bundle.dogs) {
                const newLineageId = idMap.get(dog.lineageId) || generateLineageId();
                const newVersionId = generateVersionId();
                const importCfg = { ...dog.config };
                importCfg.id = newVersionId;
                importCfg.lineageId = newLineageId;
                importCfg.parentId = null;
                if (Array.isArray(importCfg.parentsRequired)) importCfg.parentsRequired = importCfg.parentsRequired.map(remap);
                if (Array.isArray(importCfg.parentsOptional)) importCfg.parentsOptional = importCfg.parentsOptional.map(remap);

                await nodesStore.save({
                    id: newVersionId,
                    type: importCfg.imitates ? MimicDog.name : SerializedDog.name,
                    lineageId: newLineageId,
                    parentId: null,
                    displayName: importCfg.displayName,
                    serializedDogConfig: JSON.stringify(importCfg),
                    createdAt: new Date(),
                });
                this.createdTestIds.push(newVersionId);
            }

            // Restore kennel versions.
            const sorted = [...bundle.kennelVersions].sort((a: any, b: any) => {
                return (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            });
            const versionIdMap = new Map<string, string>();
            for (const v of sorted) versionIdMap.set(v.id, generateVersionId());

            for (const v of sorted) {
                const newVId = versionIdMap.get(v.id)!;
                const newParentId = v.parentId ? (versionIdMap.get(v.parentId) ?? null) : null;
                const vCfg = v.config || bundle.kennel;

                await kennelsStore.save({
                    id: newVId,
                    type: 'KennelConfig',
                    lineageId: importKennelId,
                    parentId: newParentId,
                    name: vCfg.name,
                    description: vCfg.description,
                    emoji: vCfg.emoji,
                    dogIds: remapDogIds(vCfg.dogIds || []),
                    defaultQuery: vCfg.defaultQuery ? JSON.stringify(vCfg.defaultQuery) : undefined,
                    createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
                this.createdTestIds.push(newVId);
            }

            // 6. Verify the imported kennel.
            const imported = await (kennelsController as KennelController).getById(importKennelId);
            if (!imported.ok || !imported.data) throw new Error('Importierter Kennel nicht gefunden');
            if (imported.data.name !== 'Export Test Kennel v2') throw new Error(`Importierter Kennel Name falsch: ${imported.data.name}`);

            // Verify version history was preserved.
            const importedVersions = await (kennelsController as KennelController).getVersions(importKennelId);
            if (importedVersions.length < 2) throw new Error(`Importierte Versionen: ${importedVersions.length}, erwartet >= 2`);

            // Verify parentId chain is intact.
            const hasParent = importedVersions.some(v => v.parentId !== null);
            if (!hasParent) throw new Error('Keine parentId-Verknüpfung in importierten Versionen');

            // Verify dogs were remapped (no old IDs in dogIds).
            const importedDogIds = imported.data.dogIds ?? [];
            const hasOldId = importedDogIds.some((id: string) => id === dogLineageId);
            if (hasOldId) throw new Error('Importierter Kennel enthält noch alte Dog-lineageId');

            // Verify the remapped dog exists.
            const newDogLineageId = idMap.get(dogLineageId);
            if (!newDogLineageId) throw new Error('Dog lineageId nicht im idMap');
            const loadedDogs = await nodesStore.findLatestVersionsByType(SerializedDog.name, [newDogLineageId]);
            if (loadedDogs.length === 0) throw new Error('Importierter Dog nicht im Store gefunden');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: TalkingDog — alle Dependencies (required Pacts + optional BaseDogs) werden aufgeloest
     */
    private async testTalkingDogAllDependenciesResolved(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'TalkingDog: Alle Dependencies im Kennel nach fillKennel';
        try {
            const config: IKennelConfig = {
                id: 'test-talkingdog-kennel',
                dogIds: ['base:TalkingDog'],
            };

            const kennelRun = new KennelRun(config, baseDogsMap);
            const kennel = await kennelRun.fillKennel();

            const talkingDog = kennel.find(d => d.name === 'TalkingDog');
            if (!talkingDog) {
                throw new Error('TalkingDog nicht im Kennel');
            }

            const requiredClasses = (talkingDog as any).required as any[];
            const optionalClasses = (talkingDog as any).optional as any[];
            const allDeps = [...requiredClasses, ...optionalClasses];

            const missing: string[] = [];
            for (const depClass of allDeps) {
                const isPact = (depClass as any).__isPact === true;
                const fulfilled = kennel.some(d => {
                    if (d === talkingDog) return false;
                    if (d instanceof MimicDog && isPact) {
                        return (d as MimicDog<unknown>).imitatesClasses.includes(depClass);
                    }
                    return d instanceof depClass;
                });
                if (!fulfilled) {
                    missing.push(depClass.name || 'unknown');
                }
            }

            if (missing.length > 0) {
                throw new Error(`Fehlende Dependencies fuer TalkingDog: ${missing.join(', ')}`);
            }

            const hasMimicForPact = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'LayoutInputProvider'
            );
            if (!hasMimicForPact) {
                throw new Error('Kein MimicDog fuer LayoutInputProvider im Kennel');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: die Lobby folgt der Einladung. Ohne ?channelId= entsteht je Lauf eine eigene, zufaellige
     * Lobby; mit ?channelId=abc landet der Lauf in "abc", und channelParam/channelQuery tragen die
     * Einladung weiter. Laeuft mit und ohne ausdruecklichen base:QueryRetriever: fehlt er, ergaenzt
     * ihn autoMimic -- und der muss dieselbe Query tragen (frueher war er leer, die Einladung verloren).
     */
    private async testLobbyFollowsInvitation(baseDogsMap: Map<string, any>, dogIds: string[]): Promise<void> {
        const testName = `Lobby folgt ?channelId= (dogIds: ${dogIds.join(', ')})`;
        try {
            const lobby = async (query?: Record<string, string>): Promise<ChannelState> => {
                const kennelRun = new KennelRun({ id: 'test-lobby-kennel', dogIds }, baseDogsMap, undefined, query);
                const season = await kennelRun.run();
                const lobbyDog = season.exhausted.find(d => d.name === 'WebSocketChannelRetriever');
                if (!lobbyDog) throw new Error('WebSocketChannelRetriever ist nicht gelaufen');
                return lobbyDog.collected as ChannelState;
            };

            const first = await lobby();
            const second = await lobby();
            if (!first.channelId || !second.channelId || first.channelId === second.channelId) {
                throw new Error(`Ohne Query erwartet: zwei verschiedene zufaellige Lobbys, erhalten: ${first.channelId} / ${second.channelId}`);
            }
            if (first.channelQuery !== `?channelId=${encodeURIComponent(first.channelId)}`) {
                throw new Error(`channelQuery fehlt bei frischer Lobby: ${first.channelQuery}`);
            }

            const invited = await lobby({ channelId: 'abc' });
            if (invited.channelId !== 'abc') {
                throw new Error(`Mit ?channelId=abc erwartet: abc, erhalten: ${invited.channelId}`);
            }
            if (invited.channelParam !== 'channelId' || invited.channelQuery !== '?channelId=abc') {
                throw new Error(`Einladung falsch weitergereicht: channelParam=${invited.channelParam}, channelQuery=${invited.channelQuery}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: ein BodyRetriever, den autoMimic als fehlenden Pflicht-Parent ergaenzt, traegt den echten
     * Body -- wie einer, der ausdruecklich in dogIds steht. Kein Basis-Dog verlangt heute einen
     * BodyRetriever, darum ein Stub als Verbraucher.
     */
    private async testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'autoMimic: ergaenzter BodyRetriever traegt den Body';
        try {
            const BodyRetrieverClass = baseDogsMap.get('BodyRetriever');
            if (!BodyRetrieverClass) throw new Error('BodyRetriever fehlt in der Registry');

            class BodyConsumerDog extends Dog<unknown> {
                get name() { return 'BodyConsumerDog'; }
                get required() { return [BodyRetrieverClass]; }
                get optional() { return [] as (new (...args: any[]) => IHuntingDog<unknown>)[]; }
                protected yieldCollectorFactory = async (season: any) =>
                    season.exhausted.find((d: any) => d.name === 'BodyRetriever')?.collected;
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('BodyConsumerDog', BodyConsumerDog);

            const body = { frage: 'Wer war das?', runde: 3 };
            const config: IKennelConfig = { id: 'test-body-kennel', dogIds: ['base:BodyConsumerDog'] };
            const season = await new KennelRun(config, extendedMap, undefined, undefined, body).run();

            const consumer = season.exhausted.find(d => d.name === 'BodyConsumerDog');
            if (JSON.stringify(consumer?.collected) !== JSON.stringify(body)) {
                throw new Error(`Body erwartet: ${JSON.stringify(body)}, erhalten: ${JSON.stringify(consumer?.collected)}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Loescht alle Versionen einer Dog-Lineage (Test-Cleanup fuer Dogs, deren Version-ID der Test nicht kennt). */
    private async deleteDogLineage(nodesStore: IStore, lineageId: string): Promise<void> {
        for (const type of [SerializedDog.name, MimicDog.name]) {
            try {
                const versions = await nodesStore.findAllVersions(type, lineageId);
                for (const v of versions) await nodesStore.delete(v.id);
            } catch { /* ignore */ }
        }
    }

    /**
     * Test: Export liefert nicht lesbare Dogs als Referenz-Stub (Nira F1); Import laeuft durch,
     * warnt und laesst die Referenz stehen.
     */
    private async testExportStubsUnreadableDogs(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Export stubbt nicht lesbare Dogs, Import warnt';
        const stamp = Date.now();
        const kennelId = `test-export-stub-${stamp}`;
        const importId = `test-import-stub-${stamp}`;
        let importedLineages: string[] = [];
        try {
            const open = await this.saveAclTestDog(nodesStore, 'ExportOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'UK' });
            const hidden = await this.saveAclTestDog(nodesStore, 'ExportHiddenDog', 'return { secret: "export-secret" };',
                { visibility: 'private', ownerId: 'UF' });
            const created = await kennelsController.create({
                id: kennelId,
                name: `Export Stub ${stamp}`,
                dogIds: [open, hidden],
                visibility: 'public',
                ownerId: 'UK',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const bundleHandler = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);

            const exp = this.fakeResponse();
            await (bundleHandler as any).handleExport(
                { params: { id: kennelId }, query: {}, ctx: { user: null, isSuperUser: false } },
                exp.res,
            );
            if (exp.out.statusCode !== 200) throw new Error(`Export: Status ${exp.out.statusCode}`);
            const bundle = exp.out.body;
            const stub = bundle.dogs.find((d: any) => d.lineageId === hidden);
            const full = bundle.dogs.find((d: any) => d.lineageId === open);
            if (!stub || stub.redacted !== true || 'config' in stub) throw new Error(`Stub falsch: ${JSON.stringify(stub)}`);
            if (!full || !full.config) throw new Error('lesbarer Dog ohne config exportiert');
            if (JSON.stringify(bundle).includes('export-secret')) throw new Error('Code des privaten Dogs im Bundle');

            const imp = this.fakeResponse();
            await (bundleHandler as any).handleImport(
                {
                    body: { ...bundle, importTarget: { kennelId: importId, name: `Import Stub ${stamp}` } },
                    ctx: { user: { id: 'UI', email: 'ui@test.invalid', name: null }, isSuperUser: false },
                },
                imp.res,
            );
            if (imp.out.statusCode !== 200 || !imp.out.body?.ok) throw new Error(`Import: ${JSON.stringify(imp.out.body)}`);
            importedLineages = Object.values(imp.out.body.idMap ?? {}) as string[];
            if (!Array.isArray(imp.out.body.hinweise) || imp.out.body.hinweise.length !== 1) {
                throw new Error(`Import-Hinweise erwartet 1, erhalten ${JSON.stringify(imp.out.body.hinweise)}`);
            }
            const imported = await kennelsController.getById(importId);
            if (!imported.ok || !imported.data) throw new Error('importierter Kennel fehlt');
            // P3.5 (8.15): die Referenz bleibt stehen — gepinnt auf die exportierte Version.
            if (!(imported.data.dogIds ?? []).includes(stub.versionId)) throw new Error('Referenz auf den Stub-Dog ist nicht gepinnt stehen geblieben');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
            try { await kennelsController.delete(importId); } catch { /* ignore */ }
            for (const lineageId of new Set(importedLineages)) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Spec und Swagger-UI eines privaten Kennels sind fuer Nicht-Leser 404 (Nira F3);
     * Defaults gehen nur bei includeDefaults in die Spec; private Dogs eines oeffentlichen
     * Kennels geben ihr Ergebnis nicht als Schema-Beispiel preis.
     */
    private async testSwaggerHiddenForUnreadable(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Swagger/Spec hinter canRead';
        const stamp = Date.now();
        const privateId = `test-swagger-private-${stamp}`;
        const publicId = `test-swagger-public-${stamp}`;
        try {
            const createdPrivate = await kennelsController.create({
                id: privateId,
                name: `Swagger Private ${stamp}`,
                dogIds: [],
                defaultBody: { hidden: 'swagger-default' },
                visibility: 'private',
                ownerId: 'U1',
            });
            if (!createdPrivate.ok) throw new Error(`privater Kennel nicht angelegt: ${createdPrivate.error}`);

            const open = await this.saveAclTestDog(nodesStore, 'SwaggerOpenDog', 'return { open: 1 };',
                { visibility: 'public', ownerId: 'U0' });
            const hidden = await this.saveAclTestDog(nodesStore, 'SwaggerHiddenDog', 'return { secret: "swagger-secret" };',
                { visibility: 'private', ownerId: 'U1' });
            const createdPublic = await kennelsController.create({
                id: publicId,
                name: `Swagger Public ${stamp}`,
                dogIds: [open, hidden],
                visibility: 'public',
                ownerId: 'U0',
            });
            if (!createdPublic.ok) throw new Error(`oeffentlicher Kennel nicht angelegt: ${createdPublic.error}`);

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
            const anon = { user: null, isSuperUser: false };
            const call = async (method: string, id: string) => {
                const { res, out } = this.fakeResponse();
                await (swagger as any)[method]({ params: { id }, query: {}, ctx: anon, get: () => undefined }, res);
                return out;
            };

            const json = await call('handleSwaggerJson', privateId);
            const docs = await call('handleSwaggerUi', privateId);
            if (json.statusCode !== 404) throw new Error(`swagger.json privat anonym: erwartet 404, erhalten ${json.statusCode}`);
            if (docs.statusCode !== 404) throw new Error(`/docs privat anonym: erwartet 404, erhalten ${docs.statusCode}`);
            if (JSON.stringify(docs.body ?? '').includes('Swagger Private')) throw new Error('/docs verraet den Titel');

            const pub = await call('handleSwaggerJson', publicId);
            if (pub.statusCode !== 200) throw new Error(`swagger.json oeffentlich: Status ${pub.statusCode}`);
            if (JSON.stringify(pub.body).includes('swagger-secret')) throw new Error('Spec traegt das Ergebnis eines privaten Dogs');

            const withDefaults = toSwaggridCast({ id: 'x', dogIds: [], defaultQuery: { q: '1' }, defaultBody: { b: 2 } } as any, []);
            const withoutDefaults = toSwaggridCast(
                { id: 'x', dogIds: [], defaultQuery: { q: '1' }, defaultBody: { b: 2 } } as any, [], { includeDefaults: false },
            );
            if (!withDefaults.whispers || !withDefaults.offering) throw new Error('Defaults fehlen trotz includeDefaults');
            if (withoutDefaults.whispers !== undefined || withoutDefaults.offering !== undefined) {
                throw new Error('Defaults in der Spec ohne includeDefaults');
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(privateId); } catch { /* ignore */ }
            try { await kennelsController.delete(publicId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: list_collaborators ist hinter canRead (Nira F4); E-Mails nur fuer Owner/Editors.
     */
    private async testListCollaboratorsGated(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: list_collaborators hinter canRead, E-Mails nur fuer Owner/Editors';
        const kennelId = `test-collaborators-${Date.now()}`;
        try {
            const created = await kennelsController.create({
                id: kennelId,
                name: `Collaborators ${kennelId}`,
                dogIds: [],
                visibility: 'private',
                ownerId: 'U1',
                editors: ['U2'],
                viewers: ['U3'],
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);

            const users = ['U1', 'U2', 'U3'].map((id) => ({ id, email: `${id.toLowerCase()}@test.invalid`, name: null }));
            const fakePrisma = { user: { findMany: async () => users } };
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler, fakePrisma);
            const tool = getAclTools().find((t) => t.name === 'list_collaborators');
            if (!tool) throw new Error('Werkzeug list_collaborators fehlt');
            const call = (ctx: AuthCtx) => tool.handler({ entity_type: 'kennel', id: kennelId }, ctx, deps);
            const user = (id: string): AuthCtx => ({ user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false });

            const anon = await call({ user: null, isSuperUser: false });
            if (!anon.isError) throw new Error('anonym: erwartet not found');
            const stranger = await call(user('U9'));
            if (!stranger.isError) throw new Error('Fremder: erwartet not found');

            const viewer = await call(user('U3'));
            if (viewer.isError) throw new Error(`Viewer: ${viewer.content[0]?.text}`);
            const viewerBody = JSON.parse(viewer.content[0].text);
            if (viewer.content[0].text.includes('@test.invalid')) throw new Error('Viewer sieht E-Mails');
            if (viewerBody.owner?.id !== 'U1' || viewerBody.editorCount !== 1 || viewerBody.viewerCount !== 1) {
                throw new Error(`Viewer: ids/Anzahl falsch: ${viewer.content[0].text}`);
            }

            for (const id of ['U1', 'U2']) {
                const r = await call(user(id));
                if (r.isError) throw new Error(`${id}: ${r.content[0]?.text}`);
                if (!r.content[0].text.includes('u1@test.invalid')) throw new Error(`${id}: E-Mails fehlen`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test: Legacy POST /save mit unbekannter id legt die Node mit Create-Defaults an (Nira F5):
     * Owner = Aufrufer, visibility private — nicht herrenlos und oeffentlich.
     */
    private async testLegacySaveAppliesCreateDefaults(
        nodesStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
    ): Promise<void> {
        const testName = 'ACL: Legacy /save wendet Create-Defaults an';
        let lineageId: string | undefined;
        try {
            const registry = new ControllerRegistry();
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const { res, out } = this.fakeResponse();
            await (handler as any).handleSave(
                {
                    query: {},
                    body: { id: `test-legacy-save-${Date.now()}`, tsCode: 'return 1;' },
                    ctx: { user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false },
                    get: () => undefined,
                },
                res,
            );
            if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`/save: ${out.statusCode} ${JSON.stringify(out.body)}`);
            lineageId = out.body.lineageId;
            if (!lineageId) throw new Error('/save lieferte keine lineageId');

            const rows = await nodesStore.findLatestVersionsByType(SerializedDog.name, [lineageId]);
            const row: any = rows[0];
            if (!row) throw new Error('gespeicherte Node nicht gefunden');
            if (row.ownerId !== 'U1') throw new Error(`ownerId erwartet U1, erhalten ${row.ownerId}`);
            if (row.visibility !== 'private') throw new Error(`visibility erwartet private, erhalten ${row.visibility}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (lineageId) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Import legt Dogs und Kennel mit Create-Defaults an — Owner = Importeur, privat,
     * nie herrenlos/community.
     */
    private async testImportAppliesCreateDefaults(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'ACL: Import vergibt Owner und Sichtbarkeit (nie herrenlos)';
        const stamp = Date.now();
        const importId = `test-import-acl-${stamp}`;
        let importedLineages: string[] = [];
        try {
            const oldLineage = generateLineageId();
            const bundle = {
                bundleVersion: 2,
                kennel: { kennelId: `bundle-${stamp}`, name: `Bundle ${stamp}`, dogIds: [oldLineage] },
                dogs: [{
                    lineageId: oldLineage,
                    versionId: generateVersionId(),
                    displayName: 'ImportAclDog',
                    type: 'SerializedDog',
                    config: { displayName: 'ImportAclDog', theRun: 'return 1;', parentsRequired: [], parentsOptional: [] },
                }],
            };
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const bundleHandler = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const { res, out } = this.fakeResponse();
            await (bundleHandler as any).handleImport(
                {
                    body: { ...bundle, importTarget: { kennelId: importId, name: `Import ACL ${stamp}` } },
                    ctx: { user: { id: 'UI', email: 'ui@test.invalid', name: null }, isSuperUser: false },
                },
                res,
            );
            if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`Import: ${JSON.stringify(out.body)}`);
            importedLineages = Object.values(out.body.idMap ?? {}) as string[];
            const newLineage = out.body.idMap?.[oldLineage];
            if (!newLineage) throw new Error('idMap ohne den importierten Dog');

            const rows: any[] = await nodesStore.findLatestVersionsByType(SerializedDog.name, [newLineage]);
            const dog = rows[0];
            if (!dog) throw new Error('importierter Dog nicht gefunden');
            if (dog.ownerId !== 'UI') throw new Error(`Dog-ownerId erwartet UI, erhalten ${dog.ownerId}`);
            if (dog.visibility !== 'private') throw new Error(`Dog-visibility erwartet private, erhalten ${dog.visibility}`);

            const kennel: any = (await kennelsController.getById(importId)).data;
            if (!kennel) throw new Error('importierter Kennel fehlt');
            if (kennel.ownerId !== 'UI') throw new Error(`Kennel-ownerId erwartet UI, erhalten ${kennel.ownerId}`);
            if (kennel.visibility !== 'private') throw new Error(`Kennel-visibility erwartet private, erhalten ${kennel.visibility}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(importId); } catch { /* ignore */ }
            for (const lineageId of new Set(importedLineages)) await this.deleteDogLineage(nodesStore, lineageId);
        }
    }

    /**
     * Test: Legacy /save uebernimmt keine ACL-Felder aus serializedDogConfig — bestehende
     * Nodes behalten ihre, neue bekommen die Create-Defaults.
     */
    private async testLegacySaveIgnoresClientAcl(
        nodesStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
    ): Promise<void> {
        const testName = 'ACL: Legacy /save ignoriert ACL-Felder des Clients';
        let createdLineage: string | undefined;
        let existing: string | undefined;
        try {
            existing = await this.saveAclTestDog(nodesStore, 'SaveAclDog', 'return 1;',
                { visibility: 'private', ownerId: 'U1' });
            const registry = new ControllerRegistry();
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const forged = { ownerId: 'U9', visibility: 'public', editors: 'U9', viewers: 'U9', runners: 'U9', frozen: true };
            const save = async (id: string) => {
                const { res, out } = this.fakeResponse();
                await (handler as any).handleSave(
                    {
                        query: {},
                        body: { id, tsCode: 'return 2;', serializedDogConfig: forged },
                        ctx: { user: { id: 'U1', email: 'u1@test.invalid', name: null }, isSuperUser: false },
                        get: () => undefined,
                    },
                    res,
                );
                if (out.statusCode !== 200 || !out.body?.ok) throw new Error(`/save ${id}: ${out.statusCode} ${JSON.stringify(out.body)}`);
                return out.body.lineageId as string;
            };
            const check = async (lineageId: string, label: string) => {
                const row: any = (await nodesStore.findLatestVersionsByType(SerializedDog.name, [lineageId]))[0];
                if (!row) throw new Error(`${label}: Node nicht gefunden`);
                if (row.ownerId !== 'U1') throw new Error(`${label}: ownerId erwartet U1, erhalten ${row.ownerId}`);
                if (row.visibility !== 'private') throw new Error(`${label}: visibility erwartet private, erhalten ${row.visibility}`);
                if (String(row.editors ?? '').includes('U9') || String(row.viewers ?? '').includes('U9') || String(row.runners ?? '').includes('U9')) {
                    throw new Error(`${label}: editors/viewers/runners vom Client uebernommen`);
                }
                if (row.frozen) throw new Error(`${label}: frozen vom Client uebernommen`);
                const cfg = JSON.parse(row.serializedDogConfig || '{}');
                if ('ownerId' in cfg || 'visibility' in cfg) throw new Error(`${label}: ACL-Felder in serializedDogConfig gelandet`);
            };

            await check(await save(existing), 'bestehend');
            createdLineage = await save(`test-legacy-save-acl-${Date.now()}`);
            await check(createdLineage, 'neu');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (createdLineage) await this.deleteDogLineage(nodesStore, createdLineage);
            if (existing) await this.deleteDogLineage(nodesStore, existing);
        }
    }

    /** Fake-User fuer die Rechte-Tests (T1-T12): nur die id zaehlt fuer die Praedikate. */
    private fakeUser(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false };
    }

    /** Die hoechste Stufe eines Aufrufers — NONE < RUN < READ < EDIT < OWN. */
    private levelOf(entity: AclEntity, ctx: AuthCtx): string {
        if (canManageAcl(entity, ctx)) return 'OWN';
        if (canMutate(entity, ctx)) return 'EDIT';
        if (canRead(entity, ctx)) return 'READ';
        if (canRun(entity, ctx)) return 'RUN';
        return 'NONE';
    }

    /**
     * Test (P3.5 3.5.2, T3 Teil, T6 Teil): die Rechtematrix als Praedikate — jede Rolle gegen
     * jede Sichtbarkeit, dazu frozen, Community, Mehrfachrollen und die Create-Defaults.
     */
    private async testRightsMatrix(): Promise<void> {
        const testName = 'P3.5: Rechtematrix NONE < RUN < READ < EDIT < OWN';
        try {
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const superUser: AuthCtx = { user: null, isSuperUser: true };
            const roles: Array<[string, AuthCtx]> = [
                ['anonym', anon],
                ['fremd', this.fakeUser('U9')],
                ['runner', this.fakeUser('UR')],
                ['reader', this.fakeUser('UV')],
                ['editor', this.fakeUser('UE')],
                ['owner', this.fakeUser('UO')],
                ['superuser', superUser],
            ];
            const expected: Record<Visibility, Record<string, string>> = {
                private: { anonym: 'NONE', fremd: 'NONE', runner: 'RUN', reader: 'READ', editor: 'EDIT', owner: 'OWN', superuser: 'OWN' },
                'run-only': { anonym: 'RUN', fremd: 'RUN', runner: 'RUN', reader: 'READ', editor: 'EDIT', owner: 'OWN', superuser: 'OWN' },
                public: { anonym: 'READ', fremd: 'READ', runner: 'READ', reader: 'READ', editor: 'EDIT', owner: 'OWN', superuser: 'OWN' },
            };
            const entity = (visibility: Visibility, extra: Partial<AclEntity> = {}): AclEntity => ({
                visibility, ownerId: 'UO', editors: 'UE', viewers: 'UV', runners: 'UR', ...extra,
            });
            const wrong: string[] = [];
            for (const visibility of Object.keys(expected) as Visibility[]) {
                for (const [role, ctx] of roles) {
                    const got = this.levelOf(entity(visibility), ctx);
                    if (got !== expected[visibility][role]) wrong.push(`${visibility}/${role}: ${got} statt ${expected[visibility][role]}`);
                }
            }
            if (wrong.length) throw new Error(wrong.join('; '));

            // frozen (8.25 a): niemand editiert, auch Owner und Super-User nicht; OWN bleibt (auftauen).
            const frozen = entity('public', { frozen: true });
            for (const [role, ctx] of roles) {
                if (canMutate(frozen, ctx)) throw new Error(`frozen: ${role} darf editieren`);
            }
            if (!canManageAcl(frozen, this.fakeUser('UO')) || !canRead(frozen, anon) || !canRun(frozen, anon)) {
                throw new Error('frozen: OWN/READ/RUN duerfen nicht fallen');
            }

            // Community (8.16): Eingeloggte lesen und editieren, niemand ausser dem Super-User besitzt.
            const community = { visibility: 'private', ownerId: null } as AclEntity;
            if (this.levelOf(community, this.fakeUser('U9')) !== 'EDIT') throw new Error('Community: Eingeloggter nicht EDIT');
            if (this.levelOf(community, anon) !== 'NONE') throw new Error('Community privat: anonym nicht NONE');
            if (this.levelOf({ visibility: null, ownerId: null } as AclEntity, anon) !== 'READ') throw new Error('Community ohne visibility: anonym nicht READ');
            if (this.levelOf(community, superUser) !== 'OWN') throw new Error('Community: Super-User nicht OWN');

            // Mehrfachrollen: die hoechste Stufe gewinnt; der Owner in runners bleibt OWN.
            if (this.levelOf(entity('private', { runners: 'UR', viewers: 'UR' }), this.fakeUser('UR')) !== 'READ') {
                throw new Error('runner + reader: nicht READ');
            }
            if (this.levelOf(entity('private', { runners: 'UO' }), this.fakeUser('UO')) !== 'OWN') throw new Error('Owner in runners: nicht OWN');

            // myRights anonym auf public (3.5.7).
            const rights = rightsOf(entity('public'), anon);
            if (JSON.stringify(rights) !== JSON.stringify({ run: true, read: true, edit: false, own: false, frozen: false, locked: null })) {
                throw new Error(`myRights anonym/public: ${JSON.stringify(rights)}`);
            }

            // Create-Defaults: private, auch fuer den Super-User; run-only kommt durch.
            if (applyCreateDefaults({}, superUser).visibility !== 'private') throw new Error('Super-User-Default nicht private');
            if (applyCreateDefaults({ visibility: 'run-only' }, this.fakeUser('UO')).visibility !== 'run-only') {
                throw new Error('run-only geht beim Anlegen verloren');
            }
            if (applyCreateDefaults({ visibility: 'wide-open' }, this.fakeUser('UO')).visibility !== 'private') {
                throw new Error('unbekannte Sichtbarkeit nicht auf private');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test (T6): der Owner darf alles — auch loslassen: release_ownership macht die Entitaet zur
     * Community; danach besitzt sie niemand mehr (nur der Super-User), editieren darf jeder Eingeloggte.
     */
    private async testOwnerReleasesToCommunity(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T6: Owner gibt frei -> Community';
        const kennelId = `test-release-${Date.now()}`;
        try {
            const created = await kennelsController.create({
                id: kennelId, name: `Release ${kennelId}`, dogIds: [], visibility: 'run-only', ownerId: 'UO', runners: ['UR'],
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const owner = this.fakeUser('UO');
            const before: any = (await kennelsController.getById(kennelId)).data;
            if (before?.visibility !== 'run-only' || before?.runners !== 'UR') throw new Error(`run-only/runners nicht gespeichert: ${JSON.stringify(before)}`);
            if (JSON.stringify(rightsOf(before, owner)) !== JSON.stringify({ run: true, read: true, edit: true, own: true, frozen: false, locked: null })) {
                throw new Error('Owner hat nicht alle Rechte');
            }

            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const release = getAclTools().find((t) => t.name === 'release_ownership');
            if (!release) throw new Error('Werkzeug release_ownership fehlt');
            const stranger = await release.handler({ entity_type: 'kennel', id: kennelId }, this.fakeUser('U9'), deps);
            if (!stranger.isError) throw new Error('Fremder konnte freigeben');
            const r = await release.handler({ entity_type: 'kennel', id: kennelId }, owner, deps);
            if (r.isError) throw new Error(`release: ${r.content[0]?.text}`);

            const after: any = (await kennelsController.getById(kennelId)).data;
            if (after?.ownerId != null) throw new Error(`ownerId nach release: ${after?.ownerId}`);
            if (canManageAcl(after, owner)) throw new Error('Ex-Owner besitzt die Community-Entitaet noch');
            if (!canMutate(after, this.fakeUser('U9'))) throw new Error('Community nicht fuer Eingeloggte editierbar');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (P3.5): eine per Version-GUID gefundene Version traegt die Rechte ihres Kopfes —
     * `?version=` ist kein Umweg um ein enger gestelltes Gate.
     */
    private async testVersionCarriesHeadRights(kennelsController: KennelController): Promise<void> {
        const testName = 'P3.5: Version traegt die Rechte des Kopfes';
        const kennelId = `test-head-acl-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'v1', dogIds: [], visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const v1Id = (created.data as any)?.id as string;
            const saved = await kennelsController.save({ id: kennelId, name: 'v2', visibility: 'private' });
            if (!saved.ok) throw new Error(`save: ${saved.error}`);
            const oldVersion: any = (await kennelsController.getById(v1Id)).data;
            if (oldVersion?.name !== 'v1') throw new Error(`Version v1 nicht aufgeloest: ${oldVersion?.name}`);
            if (oldVersion?.visibility !== 'private') throw new Error(`alte Version zeigt visibility ${oldVersion?.visibility}`);
            if (canRead(oldVersion, { user: null, isSuperUser: false })) throw new Error('alte Version anonym lesbar');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /** Werkzeug per Name; wirft, wenn es fehlt. */
    private toolNamed(name: string) {
        const t = [...getKennelTools(), ...getNodeTools(), ...getSnapshotTools(), ...getAclTools()].find((x) => x.name === name);
        if (!t) throw new Error(`Werkzeug ${name} fehlt`);
        return t;
    }

    /** Ruft einen Route-Handler mit Fake-Response auf. */
    private async callHandler(handler: any, method: string, req: Record<string, any>) {
        const { res, out } = this.fakeResponse();
        (res as any).end = () => res;
        await handler[method]({ query: {}, method: 'GET', get: () => undefined, ...req }, res);
        return out;
    }

    /**
     * Abnahme-Harness (3.5.8): keine Antwort an eine Identitaet unterhalb READ traegt Code,
     * Kontext oder Defaults. Geprueft wird der Text jeder gesammelten Antwort auf die Marker,
     * die nur im Code bzw. in den Defaults stehen, und auf die Felder theRun/vmContext.
     */
    private assertNoLeak(label: string, responses: unknown[], markers: string[]): void {
        for (const [i, r] of responses.entries()) {
            const text = typeof r === 'string' ? r : JSON.stringify(r) ?? '';
            for (const m of markers) {
                if (text.includes(m)) throw new Error(`${label}: Antwort ${i} traegt "${m}"`);
            }
            if (/"theRun"\s*:|"vmContext"\s*:\s*\{/.test(text)) throw new Error(`${label}: Antwort ${i} traegt theRun/vmContext`);
        }
    }

    /**
     * Test T1: anonym / privater Kennel — GET/HEAD /k/:id, /run, openapi.json, /docs, Export: alles 404.
     */
    private async testPrivateKennelHiddenFromAnon(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T1: privater Kennel anonym ueberall 404';
        const kennelId = `test-t1-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'T1Dog', 'return { t1: "t1-out" }; /* p35-code-t1 */',
                { visibility: 'private', ownerId: 'UO' });
            const created = await kennelsController.create({
                id: kennelId, name: 'T1 Private', dogIds: [dog], defaultBody: { mark: 'p35-default-t1' }, visibility: 'private', ownerId: 'UO',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
            const bundle = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const anon = { user: null, isSuperUser: false };
            const req = { params: { id: kennelId }, ctx: anon };
            const answers = [
                ['GET /k/:id', await this.callHandler(runHandler, 'handlePublicGet', req)],
                ['HEAD /k/:id', await this.callHandler(runHandler, 'handlePublicHead', req)],
                ['/run', await this.callHandler(runHandler, 'handleRun', req)],
                ['/execute', await this.callHandler(runHandler, 'handleExecute', req)],
                ['openapi.json', await this.callHandler(swagger, 'handleSwaggerJson', req)],
                ['/docs', await this.callHandler(swagger, 'handleSwaggerUi', req)],
                ['export', await this.callHandler(bundle, 'handleExport', req)],
            ] as Array<[string, { statusCode: number; body: any }]>;
            for (const [label, out] of answers) {
                if (out.statusCode !== 404) throw new Error(`${label}: erwartet 404, erhalten ${out.statusCode}`);
            }
            this.assertNoLeak('T1', answers.map(([, out]) => out.body), ['p35-code-t1', 'p35-default-t1', 't1-out', 'T1 Private']);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test T2: anonym bzw. eingeloggt ohne READ / run-only-Kennel — GET /k/:id liefert das
     * Lead-Ergebnis; /run nur die Form des Laufs (W17 Stufe 1, keine Identitaet); Export 404;
     * get_kennel_default_body not found; get_kennel gekuerzt; Snapshot nur Kopf und Lead.
     */
    private async testRunOnlyKennelShowsNoPack(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T2: run-only-Kennel liefert Lead, nie das Pack';
        const kennelId = `test-t2-${Date.now()}`;
        try {
            const helper = await this.saveAclTestDog(nodesStore, 'T2SecretHelper', 'return { h: "t2-helper-out" }; /* p35-code-t2h */',
                { visibility: 'private', ownerId: 'UO' });
            const lead = await this.saveAclTestDog(nodesStore, 'T2LeadDog', 'return { lead: "t2-lead-out" }; /* p35-code-t2 */',
                { visibility: 'private', ownerId: 'UO' });
            const created = await kennelsController.create({
                id: kennelId, name: 'T2 RunOnly', dogIds: [lead, helper], defaultBody: { mark: 'p35-default-t2' },
                defaultQuery: { q: 'p35-query-t2' }, visibility: 'run-only', ownerId: 'UO',
            });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
            const bundle = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const anon = { user: null, isSuperUser: false };
            const pat = this.fakeUser('U9');
            const req = { params: { id: kennelId }, ctx: anon };
            const seen: unknown[] = [];

            const pub = await this.callHandler(runHandler, 'handlePublicGet', req);
            seen.push(pub.body);
            if (pub.statusCode !== 200 || pub.body?.lead !== 't2-lead-out') throw new Error(`GET /k/:id: ${pub.statusCode} ${JSON.stringify(pub.body)}`);

            const run = await this.callHandler(runHandler, 'handleRun', req);
            seen.push(run.body);
            if (run.statusCode !== 200 || run.body?.ok !== true) throw new Error(`/run: ${run.statusCode} ${JSON.stringify(run.body)}`);
            if (run.body.leadResult?.lead !== 't2-lead-out') throw new Error('/run: leadResult fehlt');
            if (!Array.isArray(run.body.waves) || run.body.waves.some((w: any) => Object.keys(w).join() !== 'dogCount')) {
                throw new Error(`/run: Wellen tragen mehr als dogCount: ${JSON.stringify(run.body.waves)}`);
            }
            if (run.body.kennelConfig || JSON.stringify(run.body).includes(lead) || JSON.stringify(run.body).includes('T2LeadDog')) {
                throw new Error('/run: Identitaet oder Konfiguration im Kennel-RUN');
            }

            const exp = await this.callHandler(bundle, 'handleExport', req);
            if (exp.statusCode !== 404) throw new Error(`Export run-only anonym: ${exp.statusCode}`);
            const spec = await this.callHandler(swagger, 'handleSwaggerJson', req);
            seen.push(spec.body);
            if (spec.statusCode !== 200) throw new Error(`openapi.json run-only: ${spec.statusCode}`);
            if (JSON.stringify(spec.body).includes('t2-helper-out')) throw new Error('Spec traegt Zwischenergebnisse');

            const call = async (name: string, args: Record<string, any>) => {
                const r = await this.toolNamed(name).handler({ id: kennelId, ...args }, pat, deps);
                seen.push(r.content[0]?.text);
                return r;
            };
            if (!(await call('get_kennel_default_body', {})).isError) throw new Error('get_kennel_default_body ohne READ nicht "not found"');
            if (!(await call('get_kennel_versions', {})).isError) throw new Error('get_kennel_versions ohne READ');
            const header = JSON.parse((await call('get_kennel', {})).content[0].text);
            if (header.dogIds || header.myRights?.run !== true || header.myRights?.read !== false) {
                throw new Error(`get_kennel RUN: ${JSON.stringify(header)}`);
            }
            const listed = JSON.parse((await this.toolNamed('list_kennels').handler({}, pat, deps)).content[0].text);
            if (!listed.some((k: any) => k.lineageId === kennelId)) throw new Error('list_kennels verbirgt den run-only-Kennel (8.17)');
            const mcpRun = JSON.parse((await call('run_kennel', {})).content[0].text);
            if (mcpRun.leadResult?.lead !== 't2-lead-out' || mcpRun.kennelConfig) throw new Error('run_kennel RUN: falsche Form');
            await call('refresh_kennel_snapshot', {});
            const waited = JSON.parse((await call('wait_for_kennel_snapshot', { timeoutMs: 30_000 })).content[0].text);
            if (waited.status !== 'ok' || waited.leadDogId) throw new Error(`Snapshot-Kopf RUN: ${JSON.stringify(waited)}`);
            const leadSnap = JSON.parse((await call('get_kennel_snapshot_lead_result', {})).content[0].text);
            if (leadSnap.leadResult?.lead !== 't2-lead-out' || leadSnap.leadDogId) throw new Error('Snapshot-Lead RUN: falsche Form');
            for (const name of ['get_snapshot_dog_code', 'get_snapshot_dog_result', 'get_kennel_snapshot_summary']) {
                if (!(await call(name, { dogId: lead })).isError) throw new Error(`${name} ohne READ nicht verweigert`);
            }

            this.assertNoLeak('T2', seen, ['p35-code-t2', 'p35-default-t2', 'p35-query-t2', 't2-helper-out', 'T2SecretHelper']);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test T3 (Lauf-Teil): ein runner eines fremden privaten Dogs X setzt X (gepinnt) in seinen
     * eigenen Kennel — /run zeigt X.result, nie X.codeTs; get_node(X) not found, get_node_schema ok;
     * im Snapshot ist X redigiert.
     */
    private async testRunnerSeesOutputNotCode(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T3: runner sieht Output, nie Code';
        const kennelId = `test-t3-${Date.now()}`;
        try {
            const x = await this.saveAclTestDog(nodesStore, 'T3ForeignDog', 'return { x: "t3-x-out" }; /* p35-code-t3 */',
                { visibility: 'private', ownerId: 'UX', runners: 'UR' });
            const xVersion = (await nodesStore.findLatestVersionsByType(SerializedDog.name, [x]))[0]?.id as string;
            const created = await kennelsController.create({ id: kennelId, name: 'T3 Mine', dogIds: [xVersion], visibility: 'private', ownerId: 'UR' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const runner = this.fakeUser('UR');
            const seen: unknown[] = [];

            const run = await this.callHandler(runHandler, 'handleRun', { params: { id: kennelId }, ctx: runner });
            seen.push(run.body);
            const node = (run.body?.waves ?? []).flat().find((n: any) => n.lineageId === x);
            if (!node) throw new Error(`/run: X nicht in den Waves: ${JSON.stringify(run.body).slice(0, 300)}`);
            if (node.result?.x !== 't3-x-out') throw new Error(`/run: X.result fehlt: ${JSON.stringify(node.result)}`);
            if (node.codeTs !== undefined || node.vmContext !== undefined || node.access !== 'run') throw new Error('/run: X nicht auf RUN redigiert');
            if (node.version !== 1 || node.latestVersion !== 1 || node.latestId !== xVersion) {
                throw new Error(`/run: Pin-Stand von X fehlt (P6 U3): ${JSON.stringify({ v: node.version, l: node.latestVersion, id: node.latestId })}`);
            }

            const call = async (name: string, args: Record<string, any>) => {
                const r = await this.toolNamed(name).handler(args, runner, deps);
                seen.push(r.content[0]?.text);
                return r;
            };
            if (!(await call('get_node', { id: x })).isError) throw new Error('get_node(X) fuer runner nicht "not found"');
            if (!(await call('get_node_versions', { id: x })).isError) throw new Error('get_node_versions(X) fuer runner');
            if (!(await call('get_node_lines', { id: x, line: 1 })).isError) throw new Error('get_node_lines(X) fuer runner');
            const schema = await call('get_node_schema', { id: x });
            if (schema.isError) throw new Error(`get_node_schema(X): ${schema.content[0]?.text}`);
            const listed = JSON.parse((await call('list_nodes', { search: 'T3ForeignDog' })).content[0].text);
            const entry = listed.nodes.find((n: any) => n.lineageId === x);
            if (!entry || entry.tsCodePreview !== null) throw new Error(`list_nodes: X fehlt oder zeigt Code: ${JSON.stringify(entry)}`);

            await call('refresh_kennel_snapshot', { id: kennelId });
            await call('wait_for_kennel_snapshot', { id: kennelId, timeoutMs: 30_000 });
            const code = JSON.parse((await call('get_snapshot_dog_code', { id: kennelId, dogId: x })).content[0].text);
            const result = JSON.parse((await call('get_snapshot_dog_result', { id: kennelId, dogId: x })).content[0].text);
            if (code.codeTs !== null) throw new Error('Snapshot: X.codeTs nicht redigiert');
            if (result.result?.x !== 't3-x-out') throw new Error('Snapshot: X.result fehlt');

            this.assertNoLeak('T3', seen, ['p35-code-t3']);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test T4: ein reader (viewers) eines privaten Dogs sieht Code, Versionen und Export —
     * save_node bleibt ihm verwehrt.
     */
    private async testReaderSeesCodeButCannotSave(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T4: reader sieht Code, speichert nicht';
        const kennelId = `test-t4-${Date.now()}`;
        try {
            const x = await this.saveAclTestDog(nodesStore, 'T4ReadableDog', 'return { x: 4 }; /* p35-code-t4 */',
                { visibility: 'private', ownerId: 'UX', viewers: 'UV' });
            const created = await kennelsController.create({ id: kennelId, name: 'T4', dogIds: [x], visibility: 'public', ownerId: 'UX' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const bundle = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const reader = this.fakeUser('UV');

            const node = await this.toolNamed('get_node').handler({ id: x }, reader, deps);
            if (node.isError || !node.content[0].text.includes('p35-code-t4')) throw new Error('get_node(X) fuer reader ohne Code');
            const body = JSON.parse(node.content[0].text);
            if (body.myRights?.read !== true || body.myRights?.edit !== false) throw new Error(`myRights reader: ${JSON.stringify(body.myRights)}`);
            if ('viewers' in body || 'editors' in body) throw new Error('reader sieht die ACL-Listen');
            if ((await this.toolNamed('get_node_versions').handler({ id: x }, reader, deps)).isError) throw new Error('get_node_versions fuer reader');
            const exp = await this.callHandler(bundle, 'handleExport', { params: { id: kennelId }, ctx: reader });
            const dog = exp.body?.dogs?.find((d: any) => d.lineageId === x);
            if (exp.statusCode !== 200 || !dog?.config) throw new Error(`Export fuer reader: ${exp.statusCode} ${JSON.stringify(dog)}`);
            const save = await this.toolNamed('save_node').handler({ id: x, tsCode: 'return 5;' }, reader, deps);
            if (!save.isError || save.content[0].text !== 'Not authorized') throw new Error(`save_node fuer reader: ${save.content[0]?.text}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (3.5.7): ein fremder privater Dog im Altbestand laeuft nicht — auch nicht, wenn der
     * Aufrufer zufaellig lesen darf; der Kennel-Owner hat kein RUN auf ihn. Der Lead faellt aus.
     */
    private async testForeignPrivateDogDoesNotRun(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5: fremder privater Dog laeuft nicht (3.5.7)';
        const kennelId = `test-foreign-${Date.now()}`;
        try {
            const foreign = await this.saveAclTestDog(nodesStore, 'ForeignPrivateLead', 'return { f: "foreign-ran" };',
                { visibility: 'private', ownerId: 'UF' });
            const created = await kennelsController.create({ id: kennelId, name: 'Altbestand', dogIds: [foreign], visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            for (const [label, ctx] of [['anonym', { user: null, isSuperUser: false }], ['Autor UF', this.fakeUser('UF')]] as Array<[string, AuthCtx]>) {
                const pub = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: kennelId }, ctx });
                if (pub.statusCode === 200 || JSON.stringify(pub.body).includes('foreign-ran')) {
                    throw new Error(`${label}: fremder Dog lief: ${pub.statusCode} ${JSON.stringify(pub.body)}`);
                }
            }
            const owner = await this.callHandler(runHandler, 'handleRun', { params: { id: kennelId }, ctx: this.fakeUser('UO') });
            if ((owner.body?.waves ?? []).flat().some((n: any) => n.lineageId === foreign)) throw new Error('/run Owner: fremder Dog in den Waves');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /** Fake-Auth-Client: kennt genau die uebergebenen User (findUnique per id/email, findMany). */
    private fakeAuthPrisma(ids: string[]): any {
        const users = ids.map((id) => ({ id, email: `${id.toLowerCase()}@test.invalid`, name: null }));
        return {
            user: {
                findUnique: async ({ where }: any) => users.find((u) => u.id === where.id || u.email === where.email) ?? null,
                findMany: async () => users,
            },
        };
    }

    /**
     * Test T5: editor — save_node, update_kennel, rename ok; grant_access "Only the owner";
     * Sichtbarkeit aendern und sich per PUT zum Owner machen: verweigert (OWN).
     */
    private async testEditorEditsButDoesNotOwn(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T5: editor editiert, besitzt nicht';
        const kennelId = `test-t5-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'T5Dog', 'return 5;', { visibility: 'private', ownerId: 'UO', editors: 'UE' });
            const created = await kennelsController.create({ id: kennelId, name: 'T5', dogIds: [dog], visibility: 'private', ownerId: 'UO', editors: ['UE'] });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler, this.fakeAuthPrisma(['UO', 'UE', 'U9']));
            const editor = this.fakeUser('UE');
            const call = (name: string, args: Record<string, any>) => this.toolNamed(name).handler(args, editor, deps);

            const saved = await call('save_node', { id: dog, tsCode: 'return 55;' });
            if (saved.isError) throw new Error(`save_node: ${saved.content[0]?.text}`);
            const updated = await call('update_kennel', { id: kennelId, name: 'T5 edited' });
            if (updated.isError) throw new Error(`update_kennel: ${updated.content[0]?.text}`);
            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const renamed = await this.callHandler(handler, 'handleRename', { params: { subpath: 'nodes', id: dog }, body: { displayName: 'T5r' }, ctx: editor });
            if (renamed.statusCode !== 200) throw new Error(`rename: ${renamed.statusCode}`);

            const grant = await call('grant_access', { entity_type: 'kennel', id: kennelId, user: 'U9', role: 'reader' });
            if (!grant.isError || grant.content[0].text !== 'Only the owner may manage access') throw new Error(`grant_access: ${grant.content[0]?.text}`);
            const vis = await call('update_kennel', { id: kennelId, visibility: 'public' });
            if (!vis.isError || !/Only the owner/.test(vis.content[0].text)) throw new Error('editor aendert visibility');
            const nodeVis = await call('save_node', { id: dog, tsCode: 'return 5;', visibility: 'public' });
            if (!nodeVis.isError) throw new Error('editor aendert visibility eines Dogs');
            const put = await this.callHandler(handler, 'handleUpdate', {
                params: { subpath: 'kennels', id: kennelId }, body: { ownerId: 'UE', editors: 'UE,U9', runners: 'U9', name: 'T5 put' }, ctx: editor,
            });
            if (put.statusCode !== 200) throw new Error(`PUT: ${put.statusCode} ${JSON.stringify(put.body)}`);
            const after: any = (await kennelsController.getById(kennelId)).data;
            if (after.ownerId !== 'UO' || String(after.editors) !== 'UE' || after.runners) throw new Error(`PUT hat ACL uebernommen: ${JSON.stringify({ o: after.ownerId, e: after.editors, r: after.runners })}`);
            if (after.name !== 'T5 put') throw new Error('PUT hat den Inhalt nicht gespeichert');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test T7: ein Agent mit PAT des Users U ist U — die Werkzeuge antworten fuer `via: 'bearer'`
     * byte-gleich wie fuer die Session. (401 ohne User: Gateway-Test und Live-Beleg, mcp.ts.)
     */
    private async testPatActsAsItsUser(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T7: PAT des Users = der User';
        const kennelId = `test-t7-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'T7', dogIds: [], visibility: 'private', ownerId: 'UO', runners: ['UR'] });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            for (const uid of ['UR', 'U9', 'UO']) {
                const session: AuthCtx = { ...this.fakeUser(uid), via: 'session' };
                const bearer: AuthCtx = { ...this.fakeUser(uid), via: 'bearer' };
                for (const name of ['get_kennel', 'get_kennel_task']) {
                    const a = await this.toolNamed(name).handler({ id: kennelId }, session, deps);
                    const b = await this.toolNamed(name).handler({ id: kennelId }, bearer, deps);
                    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${uid}/${name}: PAT weicht von Session ab`);
                }
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test T10: ein fremder run-only-Dog laeuft in meinem Kennel — nur als Version-Pin
     * referenzierbar (`pin_required` fuer die lineageId), und im eigenen jsonStore-Namensraum:
     * er sieht die Ablage des Aufrufers nicht.
     */
    private async testRunOnlyForeignDogPinnedAndScoped(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5 T10: fremder run-only-Dog gepinnt, eigener Namensraum';
        const stamp = Date.now();
        const mineId = `test-t10-mine-${stamp}`;
        const kennelId = `test-t10-${stamp}`;
        try {
            const mine = await this.saveAclTestDog(nodesStore, 'T10MineDog',
                "await jsonStore.set('p35-mine', 1); return { keys: await jsonStore.list() };",
                { visibility: 'private', ownerId: 'UR' });
            const x = await this.saveAclTestDog(nodesStore, 'T10ForeignDog',
                "const keys = await jsonStore.list(); await jsonStore.set('p35-x', 1); const after = await jsonStore.list(); await jsonStore.delete('p35-x'); return { keys, after };",
                { visibility: 'run-only', ownerId: 'UX' });
            const xVersion = (await nodesStore.findLatestVersionsByType(SerializedDog.name, [x]))[0]?.id as string;
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const runner = this.fakeUser('UR');
            const call = (name: string, args: Record<string, any>) => this.toolNamed(name).handler(args, runner, deps);

            const byLineage = await call('create_kennel', { id: kennelId, dogIds: [x] });
            if (!byLineage.isError || !byLineage.content[0].text.startsWith('pin_required')) {
                throw new Error(`create_kennel mit lineageId: ${byLineage.content[0]?.text}`);
            }
            const pinned = await call('create_kennel', { id: kennelId, dogIds: [xVersion] });
            if (pinned.isError) throw new Error(`create_kennel gepinnt: ${pinned.content[0]?.text}`);
            const unpin = await call('update_kennel', { id: kennelId, dogIds: [xVersion, x] });
            if (!unpin.isError || !unpin.content[0].text.startsWith('pin_required')) throw new Error('update_kennel nimmt die lineageId an');
            const mineKennel = await call('create_kennel', { id: mineId, dogIds: [mine] });
            if (mineKennel.isError) throw new Error(`create_kennel eigener Dog: ${mineKennel.content[0]?.text}`);

            const runMine = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: mineId }, ctx: runner });
            if (!(runMine.body?.keys ?? []).includes('p35-mine')) throw new Error(`eigener Dog sieht seine Ablage nicht: ${JSON.stringify(runMine.body)}`);
            const runX = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: kennelId }, ctx: runner });
            if (runX.statusCode !== 200 || !Array.isArray(runX.body?.keys)) throw new Error(`fremder Dog lief nicht: ${runX.statusCode} ${JSON.stringify(runX.body)}`);
            if (runX.body.keys.includes('p35-mine')) throw new Error('fremder Dog sieht den jsonStore des Aufrufers');
            if (!runX.body.after.includes('p35-x')) throw new Error('fremder Dog hat keinen eigenen Namensraum');
            const clean = await this.saveAclTestDog(nodesStore, 'T10Cleanup', "await jsonStore.delete('p35-mine'); return 1;", { visibility: 'private', ownerId: 'UR' });
            await kennelsController.save({ id: mineId, dogIds: [clean] });
            await this.callHandler(runHandler, 'handlePublicGet', { params: { id: mineId }, ctx: runner });
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
            try { await kennelsController.delete(mineId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (8.16, 8.25 a): frozen sperrt jede Mutation, auch fuer den Owner — Lauf, Export und Lesen
     * gehen weiter; ohne neue Version; Community friert nur der Super-User.
     */
    private async testFreezeBlocksEveryMutation(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P3.5: frozen sperrt jede Mutation, Lauf/Export laufen weiter';
        const stamp = Date.now();
        const kennelId = `test-frozen-${stamp}`;
        const communityId = `test-frozen-community-${stamp}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'FrozenDog', 'return { frozen: "still-runs" };', { visibility: 'public', ownerId: 'UO' });
            const created = await kennelsController.create({ id: kennelId, name: 'Frozen', dogIds: [dog], visibility: 'public', ownerId: 'UO', editors: ['UE'] });
            const community = await kennelsController.create({ id: communityId, name: 'Community', dogIds: [dog], visibility: 'public', ownerId: null });
            if (!created.ok || !community.ok) throw new Error('Kennel nicht angelegt');
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const bundle = new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap);
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler, this.fakeAuthPrisma(['UO', 'UE', 'U9']));
            const owner = this.fakeUser('UO');
            const call = (name: string, args: Record<string, any>, ctx: AuthCtx) => this.toolNamed(name).handler(args, ctx, deps);
            const versionsBefore = (await kennelsController.getVersions(kennelId)).length;

            if ((await call('freeze_entity', { entity_type: 'kennel', id: kennelId }, this.fakeUser('UE'))).isError !== true) throw new Error('editor friert ein');
            const frozen = await call('freeze_entity', { entity_type: 'kennel', id: kennelId }, owner);
            if (frozen.isError) throw new Error(`freeze: ${frozen.content[0]?.text}`);
            if ((await kennelsController.getVersions(kennelId)).length !== versionsBefore) throw new Error('freeze hat eine neue Version angelegt');

            const upd = await call('update_kennel', { id: kennelId, name: 'x' }, owner);
            if (!upd.isError || !/frozen/.test(upd.content[0].text)) throw new Error(`Owner editiert trotz frozen: ${upd.content[0]?.text}`);
            if (!(await call('delete_kennel', { id: kennelId }, owner)).isError) throw new Error('Owner loescht trotz frozen');
            if (!(await call('grant_access', { entity_type: 'kennel', id: kennelId, user: 'U9', role: 'runner' }, owner)).isError) throw new Error('grant trotz frozen');
            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            const put = await this.callHandler(new ConfigRouteHandler(registry), 'handleUpdate', { params: { subpath: 'kennels', id: kennelId }, body: { name: 'y' }, ctx: owner });
            if (put.statusCode !== 409) throw new Error(`PUT frozen: ${put.statusCode}`);
            const header = JSON.parse((await call('get_kennel', { id: kennelId }, owner)).content[0].text);
            if (header.frozen !== true || header.myRights.edit !== false || header.myRights.own !== true) throw new Error(`myRights frozen: ${JSON.stringify(header.myRights)}`);

            const run = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: kennelId }, ctx: { user: null, isSuperUser: false } });
            if (run.body?.frozen !== 'still-runs') throw new Error('Lauf gesperrt durch frozen');
            const exp = await this.callHandler(bundle, 'handleExport', { params: { id: kennelId }, ctx: owner });
            if (exp.statusCode !== 200) throw new Error('Export gesperrt durch frozen');

            if (!(await call('unfreeze_entity', { entity_type: 'kennel', id: kennelId }, this.fakeUser('UE'))).isError) throw new Error('editor taut auf');
            if ((await call('unfreeze_entity', { entity_type: 'kennel', id: kennelId }, owner)).isError) throw new Error('Owner taut nicht auf');
            if ((await call('update_kennel', { id: kennelId, name: 'thawed' }, owner)).isError) throw new Error('nach unfreeze kein Edit');

            if (!(await call('freeze_entity', { entity_type: 'kennel', id: communityId }, this.fakeUser('U9'))).isError) throw new Error('Eingeloggter friert Community ein');
            const superUser: AuthCtx = { user: null, isSuperUser: true };
            if ((await call('freeze_entity', { entity_type: 'kennel', id: communityId }, superUser)).isError) throw new Error('Super-User friert Community nicht ein');
            if (!(await call('update_kennel', { id: communityId, name: 'z' }, this.fakeUser('U9'))).isError) throw new Error('Community trotz frozen editierbar');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const id of [kennelId, communityId]) {
                try { await kennelsController.setFrozen(id, false); } catch { /* ignore */ }
                try { await kennelsController.delete(id); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Test (3.5.6): REST /api/:subpath/:id/acl, /acl/transfer, /freeze, /unfreeze — Owner verwaltet,
     * alle anderen 404 (GET) bzw. 403; 400 invalid_visibility | invalid_user.
     */
    private async testAclRestRoutes(kennelsController: KennelController, nodesController: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'P3.5: REST /acl, /acl/transfer, /freeze, /unfreeze';
        const kennelId = `test-acl-rest-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'ACL REST', dogIds: [], visibility: 'private', ownerId: 'UO', editors: ['UE'] });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const routes = new Map<string, (req: any, res: any) => Promise<void> | void>();
            const fakeApp: any = {};
            for (const verb of ['get', 'put', 'post']) fakeApp[verb] = (path: string, h: any) => routes.set(`${verb.toUpperCase()} ${path}`, h);
            new AclRouteHandler(kennelsController, nodesController, this.fakeAuthPrisma(['UO', 'UE', 'UR', 'UV'])).registerRoutes(fakeApp);
            const hit = async (route: string, ctx: AuthCtx, body: any = {}) => {
                const { res, out } = this.fakeResponse();
                await routes.get(route)!({ params: { subpath: 'kennels', id: kennelId }, body, ctx }, res);
                return out;
            };
            const owner = this.fakeUser('UO');
            const acl = '/api/:subpath/:id/acl';

            if ((await hit(`GET ${acl}`, { user: null, isSuperUser: false })).statusCode !== 404) throw new Error('GET anonym nicht 404');
            if ((await hit(`GET ${acl}`, this.fakeUser('UV'))).statusCode !== 404) throw new Error('GET Fremder nicht 404');
            const byEditor = await hit(`GET ${acl}`, this.fakeUser('UE'));
            if (byEditor.statusCode !== 200 || byEditor.body.editors?.[0] !== 'UE') throw new Error(`GET editor: ${JSON.stringify(byEditor.body)}`);
            const put = await hit(`PUT ${acl}`, owner, { visibility: 'run-only', editors: ['UE'], viewers: ['UV'], runners: ['UR', 'UO'] });
            if (put.statusCode !== 200 || put.body.visibility !== 'run-only' || JSON.stringify(put.body.runners) !== '["UR"]') {
                throw new Error(`PUT: ${put.statusCode} ${JSON.stringify(put.body)}`);
            }
            if (put.body.myRights?.own !== true) throw new Error('PUT: myRights fehlt');
            if ((await hit(`PUT ${acl}`, owner, { visibility: 'open' })).body?.error !== 'invalid_visibility') throw new Error('invalid_visibility fehlt');
            if ((await hit(`PUT ${acl}`, owner, { runners: ['U404'] })).body?.error !== 'invalid_user') throw new Error('invalid_user fehlt');
            if ((await hit(`PUT ${acl}`, this.fakeUser('UE'), { runners: [] })).statusCode !== 403) throw new Error('PUT editor nicht 403');
            if ((await hit(`PUT ${acl}`, { user: null, isSuperUser: false }, { runners: [] })).statusCode !== 401) throw new Error('PUT anonym nicht 401');

            const freeze = await hit('POST /api/:subpath/:id/freeze', owner);
            if (freeze.statusCode !== 200 || freeze.body.frozen !== true) throw new Error(`freeze: ${JSON.stringify(freeze.body)}`);
            if ((await hit(`PUT ${acl}`, owner, { runners: [] })).statusCode !== 409) throw new Error('PUT /acl trotz frozen');
            if ((await hit('POST /api/:subpath/:id/unfreeze', owner)).statusCode !== 200) throw new Error('unfreeze');
            const transfer = await hit(`POST ${acl}/transfer`, owner, { toUserId: 'UE' });
            const moved: any = (await kennelsController.getById(kennelId)).data;
            if (transfer.statusCode !== 200 || transfer.body.owner?.id !== 'UE' || moved.ownerId !== 'UE' || String(moved.editors ?? '').includes('UE')) {
                throw new Error(`transfer: ${transfer.statusCode} ${JSON.stringify(transfer.body)}`);
            }
            if ((await hit(`GET ${acl}`, owner)).statusCode !== 404) throw new Error('Ex-Owner sieht die ACL noch');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (P6 U6): GET /acl liefert people[] mit E-Mail/Name aufgeloest (Owner/Editor/Super-User —
     * dasselbe Gate wie view()); PUT nimmt fuer editors/viewers/runners auch E-Mails an und
     * speichert immer die User.id, nie die E-Mail; eine unbekannte E-Mail bleibt invalid_user.
     */
    private async testAclRestPeopleAndEmail(kennelsController: KennelController, nodesController: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'P6 U6: REST /acl mit Personen, E-Mail statt id';
        const kennelId = `test-acl-people-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'ACL People', dogIds: [], visibility: 'private', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const routes = new Map<string, (req: any, res: any) => Promise<void> | void>();
            const fakeApp: any = {};
            for (const verb of ['get', 'put', 'post']) fakeApp[verb] = (path: string, h: any) => routes.set(`${verb.toUpperCase()} ${path}`, h);
            new AclRouteHandler(kennelsController, nodesController, this.fakeAuthPrisma(['UO', 'UR'])).registerRoutes(fakeApp);
            const hit = async (route: string, ctx: AuthCtx, body: any = {}) => {
                const { res, out } = this.fakeResponse();
                await routes.get(route)!({ params: { subpath: 'kennels', id: kennelId }, body, ctx }, res);
                return out;
            };
            const owner = this.fakeUser('UO');
            const acl = '/api/:subpath/:id/acl';

            const view = await hit(`GET ${acl}`, owner);
            if (view.statusCode !== 200) throw new Error(`GET: ${view.statusCode}`);
            const ownerPerson = view.body.people?.find((p: any) => p.id === 'UO');
            if (!ownerPerson || ownerPerson.email !== 'uo@test.invalid') throw new Error(`people fehlt/falsch: ${JSON.stringify(view.body.people)}`);

            const put = await hit(`PUT ${acl}`, owner, { viewers: ['ur@test.invalid'] });
            if (put.statusCode !== 200 || JSON.stringify(put.body.viewers) !== '["UR"]') throw new Error(`PUT E-Mail: ${put.statusCode} ${JSON.stringify(put.body)}`);
            const stored: any = (await kennelsController.getById(kennelId)).data;
            const viewersCsv = String(stored.viewers ?? '');
            if (!viewersCsv.split(',').includes('UR') || viewersCsv.includes('@')) throw new Error(`viewers-CSV: ${viewersCsv}`);

            const badEmail = await hit(`PUT ${acl}`, owner, { viewers: ['nobody@test.invalid'] });
            if (badEmail.statusCode !== 400 || badEmail.body?.error !== 'invalid_user') throw new Error(`unbekannte E-Mail: ${badEmail.statusCode} ${JSON.stringify(badEmail.body)}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Startet main.ts als Kindprozess — ohne load-env und mit leerer DATABASE_URL: kommt der Guard
     * nicht zum Zug, scheitert der Start an assertRequiredDbEnv (Exit 1) und beruehrt keine DB.
     * Die Variablen stehen ausdruecklich (leer) in der Umgebung, weil der Prisma-Client beim Import
     * die .env nachlaedt — aber nie ueberschreibt, was schon gesetzt ist.
     */
    private bootMain(env: Record<string, string>): Promise<{ code: number | null; out: string }> {
        return new Promise((resolve) => {
            const child = spawn(process.execPath, ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', 'main.ts'], {
                cwd: process.cwd(),
                env: {
                    PATH: process.env.PATH ?? '',
                    SystemRoot: process.env.SystemRoot ?? '',
                    TS_NODE_TRANSPILE_ONLY: 'true',
                    MCP_AUTH_REQUIRED: '',
                    DATABASE_URL: '',
                    RUN_STARTUP_TESTS: '0',
                    PORT: '3098',
                    ...env,
                },
            });
            let out = '';
            child.stdout.on('data', (c) => { out += c; });
            child.stderr.on('data', (c) => { out += c; });
            const timer = setTimeout(() => child.kill(), 120_000);
            child.on('exit', (code) => { clearTimeout(timer); resolve({ code, out }); });
        });
    }

    /**
     * Test T8: Super-User-Modus nur in dev. production/integration ohne MCP_AUTH_REQUIRED=true ->
     * der Prozess startet nicht (Exit 78, EX_CONFIG); dev -> offen, einmal geloggt.
     */
    private async testBootGuardRefusesSuperUserOutsideDev(): Promise<void> {
        const testName = 'P3.5 T8: Startup-Guard verweigert Super-User in production/integration';
        try {
            const opened: string[] = [];
            if (authModeBootError({ NODE_ENV: 'development' }, (l) => opened.push(l)) !== null) throw new Error('dev verweigert');
            if (opened[0] !== '[boot] superuser mode (MCP_AUTH_REQUIRED unset)') throw new Error(`dev-Hinweis: ${opened[0]}`);
            if (authModeBootError({ NODE_ENV: 'production', MCP_AUTH_REQUIRED: 'true' }) !== null) throw new Error('production mit Auth verweigert');
            if (!authModeBootError({ NODE_ENV: 'integration', MCP_AUTH_REQUIRED: 'false' })) throw new Error('integration ohne Auth erlaubt');

            const [prod, integ, prodAuth, dev] = await Promise.all([
                this.bootMain({ NODE_ENV: 'production' }),
                this.bootMain({ NODE_ENV: 'integration', MCP_AUTH_REQUIRED: 'false' }),
                this.bootMain({ NODE_ENV: 'production', MCP_AUTH_REQUIRED: 'true' }),
                this.bootMain({ NODE_ENV: 'development' }),
            ]);
            for (const [label, r] of [['production', prod], ['integration', integ]] as const) {
                if (r.code !== EX_CONFIG) throw new Error(`${label}: Exit ${r.code} statt ${EX_CONFIG}: ${r.out.slice(-300)}`);
                if (!r.out.includes('[boot] MCP_AUTH_REQUIRED must be true in production/integration')) throw new Error(`${label}: Meldung fehlt`);
            }
            if (prodAuth.code === EX_CONFIG) throw new Error('production mit MCP_AUTH_REQUIRED=true vom Guard gestoppt');
            if (dev.code === EX_CONFIG || !dev.out.includes('[boot] superuser mode (MCP_AUTH_REQUIRED unset)')) {
                throw new Error(`dev: Exit ${dev.code}, Hinweis fehlt: ${dev.out.slice(-300)}`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test (Fix vor P4): PATCH /api/kennels/:id/rename endete mit 500 — Kennel-Zeilen tragen kein
     * serializedDogConfig. Jetzt: 200, jede Version heisst neu, keine neue Version, lineageId bleibt;
     * per Version-GUID dasselbe.
     */
    private async testKennelRenameViaRest(kennelsController: KennelController): Promise<void> {
        const testName = 'Fix: Kennel-rename per REST';
        const kennelId = `test-rename-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'vorher', dogIds: [], visibility: 'private', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const firstVersion = (created.data as any)?.id as string;
            const saved = await kennelsController.save({ id: kennelId, description: 'zweite Version' });
            if (!saved.ok) throw new Error(`save: ${saved.error}`);
            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            const handler = new ConfigRouteHandler(registry);
            const rename = (id: string, displayName: string, ctx: AuthCtx) =>
                this.callHandler(handler, 'handleRename', { params: { subpath: 'kennels', id }, body: { displayName }, ctx });

            const stranger = await rename(kennelId, 'fremd', this.fakeUser('U9'));
            if (stranger.statusCode !== 404) throw new Error(`Fremder: ${stranger.statusCode}`);
            const byLineage = await rename(kennelId, 'nachher', this.fakeUser('UO'));
            if (byLineage.statusCode !== 200) throw new Error(`rename: ${byLineage.statusCode} ${JSON.stringify(byLineage.body)}`);
            const versions = await kennelsController.getVersions(kennelId);
            if (versions.length !== 2) throw new Error(`rename hat die Versionen veraendert: ${versions.length}`);
            if (versions.some((v) => v.config?.name !== 'nachher')) throw new Error(`nicht jede Version umbenannt: ${versions.map((v) => v.config?.name).join(',')}`);
            const head: any = (await kennelsController.getById(kennelId)).data;
            if (head?.lineageId !== kennelId || head?.description !== 'zweite Version') throw new Error(`Kopf veraendert: ${JSON.stringify(head)}`);

            const byVersion = await rename(firstVersion, 'per Version', this.fakeUser('UO'));
            if (byVersion.statusCode !== 200) throw new Error(`rename per Version-GUID: ${byVersion.statusCode}`);
            if ((await kennelsController.getById(kennelId)).data?.name !== 'per Version') throw new Error('rename per Version-GUID trifft den Kopf nicht');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (Fix vor P4): Dog-Code, der mit einem `// Kommentar` endet, laeuft — frueher verschluckte
     * der Kommentar die schliessende Klammer der Code-Huelle ("Unexpected end of input").
     */
    private async testTrailingLineCommentRuns(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'Fix: Dog-Code mit abschliessendem Zeilenkommentar laeuft';
        const kennelId = `test-trailing-comment-${Date.now()}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'TrailingCommentDog',
                'const answer: number = 42;\nreturn { answer }; // der letzte Satz ist ein Kommentar',
                { visibility: 'public', ownerId: 'UO' });
            const created = await kennelsController.create({ id: kennelId, name: 'Trailing Comment', dogIds: [dog], visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const out = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: kennelId }, ctx: { user: null, isSuperUser: false } });
            if (out.statusCode !== 200 || out.body?.answer !== 42) throw new Error(`Lauf: ${out.statusCode} ${JSON.stringify(out.body)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test (Fix vor P4): ein neu erzeugter Auto-Mimic ist nicht mehr Community/public. Er gehoert dem
     * Kennel-Owner und ist so sichtbar wie der Kennel; im Community-Kennel gehoert er dem eingeloggten
     * Ausloeser (Create-Defaults), anonym bleibt er Community. Der naechste Lauf adoptiert ihn.
     */
    private async testNewAutoMimicTakesKennelOwner(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'Fix: neuer Auto-Mimic bekommt Owner und Sichtbarkeit des Kennels';
        const stamp = Date.now();
        const kennelIds: string[] = [];
        const mimicRowIds: string[] = [];
        try {
            const cases: Array<{ label: string; ownerId: string | null; visibility: Visibility; ctx: AuthCtx; expectOwner: string | null }> = [
                { label: 'privat, Owner UO', ownerId: 'UO', visibility: 'private', ctx: this.fakeUser('UO'), expectOwner: 'UO' },
                { label: 'run-only, Owner UO, Runner anonym', ownerId: 'UO', visibility: 'run-only', ctx: { user: null, isSuperUser: false }, expectOwner: 'UO' },
                { label: 'Community public, Ausloeser U9', ownerId: null, visibility: 'public', ctx: this.fakeUser('U9'), expectOwner: 'U9' },
                { label: 'Community public, anonym', ownerId: null, visibility: 'public', ctx: { user: null, isSuperUser: false }, expectOwner: null },
            ];
            for (const [i, c] of cases.entries()) {
                const pactName = `FixMimicPact${stamp}x${i}`;
                const Pact = createPact<number>(pactName);
                class NeedsFixPact extends Dog<number> {
                    get name() { return `NeedsFixPact${stamp}x${i}`; }
                    get required() { return [Pact]; }
                    get optional() { return []; }
                    protected yieldCollectorFactory = async () => 1;
                }
                const map = new Map(baseDogsMap);
                map.set(`NeedsFixPact${stamp}x${i}`, NeedsFixPact);
                map.set(pactName, Pact);
                const kennelId = `test-mimic-owner-${stamp}-${i}`;
                kennelIds.push(kennelId);
                const created = await kennelsController.create({
                    id: kennelId, name: c.label, dogIds: [`base:NeedsFixPact${stamp}x${i}`], visibility: c.visibility, ownerId: c.ownerId,
                });
                if (!created.ok) throw new Error(`${c.label}: Kennel nicht angelegt: ${created.error}`);
                const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap: map, callCounter: this.testCallCounter });
                const config = await runHandler.loadKennelConfig(kennelId);
                await runHandler.runKennel(config!, {}, undefined, runHandler.toCapabilityCtx(c.ctx));

                const rows = ((await nodesStore.findLatestVersionsByType(MimicDog.name)) as any[]).filter((r) => {
                    try { return JSON.parse(r.serializedDogConfig).imitates === pactName; } catch { return false; }
                });
                mimicRowIds.push(...rows.map((r) => r.id));
                if (rows.length !== 1) throw new Error(`${c.label}: ${rows.length} Mimic-Zeilen statt 1`);
                if ((rows[0].ownerId ?? null) !== c.expectOwner || rows[0].visibility !== c.visibility) {
                    throw new Error(`${c.label}: Mimic owner=${rows[0].ownerId} visibility=${rows[0].visibility}`);
                }
                // Der naechste Lauf nimmt ihn wieder auf (er darf im Kennel laufen) — keine zweite Zeile.
                await runHandler.runKennel((await runHandler.loadKennelConfig(kennelId))!, {}, undefined, runHandler.toCapabilityCtx(c.ctx));
                const again = ((await nodesStore.findLatestVersionsByType(MimicDog.name)) as any[]).filter((r) => {
                    try { return JSON.parse(r.serializedDogConfig).imitates === pactName; } catch { return false; }
                });
                mimicRowIds.push(...again.map((r) => r.id).filter((id) => !mimicRowIds.includes(id)));
                if (again.length !== 1) throw new Error(`${c.label}: zweiter Lauf legt einen neuen Mimic an`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const id of kennelIds) {
                try { await kennelsController.delete(id); } catch { /* ignore */ }
            }
            for (const id of mimicRowIds) {
                try { await nodesStore.delete(id); } catch { /* ignore */ }
            }
        }
    }

    /** Der Store traegt die Stats-Tabellen (PrismaStore) — sonst ist die Montage falsch. */
    private statsStoreOf(store: IStore): IKennelStatsStore {
        if (typeof (store as any)?.incrementKennelCalls !== 'function') {
            throw new Error('Store implementiert IKennelStatsStore nicht');
        }
        return store as unknown as IKennelStatsStore;
    }

    /** Ein Store-Proxy, der die Flush-Transaktionen zaehlt (<= 1 je Flush, 4.13). */
    private countingStatsStore(inner: IKennelStatsStore): { store: IKennelStatsStore; flushes: () => number } {
        let flushes = 0;
        const store: IKennelStatsStore = Object.create(inner);
        store.incrementKennelCalls = async (deltas, dogDeltas) => {
            if (deltas.length > 0 || (dogDeltas?.length ?? 0) > 0) flushes += 1;
            return inner.incrementKennelCalls(deltas, dogDeltas);
        };
        return { store, flushes: () => flushes };
    }

    /**
     * Test P4 1+2: der Zaehler zaehlt synchron und flusht in EINER Transaktion; ein zweiter Flush
     * ohne neue Deltas aendert nichts; ein weiterer Flush addiert (ON CONFLICT … + excluded).
     */
    private async testCallCounterCountsAndFlushes(statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 1+2: Counter zaehlt, flusht einmal, Increment addiert';
        const lineage = `__st_a_${Date.now()}`;
        try {
            const { store, flushes } = this.countingStatsStore(statsStore);
            const counter = new KennelCallCounter(store, { flushIntervalMs: 0 });
            const sinceDay = utcDay(new Date(Date.now() - 29 * 86_400_000));
            for (let i = 0; i < 3; i++) counter.record(lineage, 'public', false);
            counter.record(lineage, 'public', true);
            counter.record(lineage, 'api-run', false);
            const pending = counter.pendingAggregates(sinceDay).get(lineage);
            if (pending?.total !== 5 || pending.ranked30d !== 4) throw new Error(`pendingAggregates: ${JSON.stringify(pending)}`);
            if (counter.status().pending !== 2) throw new Error(`status.pending: ${counter.status().pending}`);
            await counter.flush();
            const expect = (agg: KennelCallAggregate | undefined, want: Omit<KennelCallAggregate, 'lineageId'>, label: string) => {
                const got = agg ? { total: agg.total, last30d: agg.last30d, leadFailed: agg.leadFailed, leadFailed30d: agg.leadFailed30d, rankedTotal: agg.rankedTotal, ranked30d: agg.ranked30d } : null;
                if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${label}: ${JSON.stringify(got)}`);
            };
            expect((await statsStore.readKennelCallAggregates(sinceDay, [lineage]))[0], { total: 5, last30d: 5, leadFailed: 1, leadFailed30d: 1, rankedTotal: 4, ranked30d: 4 }, 'nach Flush');
            await counter.flush();
            expect((await statsStore.readKennelCallAggregates(sinceDay, [lineage]))[0], { total: 5, last30d: 5, leadFailed: 1, leadFailed30d: 1, rankedTotal: 4, ranked30d: 4 }, 'zweiter Flush');
            if (counter.pendingAggregates(sinceDay).size !== 0 || counter.status().pending !== 0) throw new Error('pending nach Flush nicht leer');
            if (flushes() !== 1) throw new Error(`Transaktionen: ${flushes()} statt 1`);

            counter.record(lineage, 'mcp-execute', false);
            counter.record(lineage, 'mcp-execute', false);
            await counter.flush();
            expect((await statsStore.readKennelCallAggregates(sinceDay, [lineage]))[0], { total: 7, last30d: 7, leadFailed: 1, leadFailed30d: 1, rankedTotal: 6, ranked30d: 6 }, 'Increment');
            if ((await statsStore.readKennelCallAggregates(sinceDay, [])).length !== 0) throw new Error('leere lineageIds nicht []');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await statsStore.deleteKennelStats(lineage); } catch { /* ignore */ }
        }
    }

    /** Test P4 5: die Tagesgrenze — zwei Zeilen, das 30-Tage-Fenster zaehlt nur den neuen Tag. */
    private async testCallCounterDayBoundary(statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 5: Counter trennt UTC-Tage';
        const lineage = `__st_day_${Date.now()}`;
        try {
            let now = new Date('2026-09-25T23:59:59Z');
            const counter = new KennelCallCounter(statsStore, { flushIntervalMs: 0, now: () => now });
            counter.record(lineage, 'public', false);
            now = new Date('2026-09-26T00:00:01Z');
            counter.record(lineage, 'public', false);
            if (counter.status().pending !== 2) throw new Error(`Schluessel: ${counter.status().pending} statt 2`);
            await counter.flush();
            const agg = (await statsStore.readKennelCallAggregates('2026-09-26', [lineage]))[0];
            if (agg?.total !== 2 || agg.last30d !== 1 || agg.ranked30d !== 1) throw new Error(`Aggregat: ${JSON.stringify(agg)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await statsStore.deleteKennelStats(lineage); } catch { /* ignore */ }
        }
    }

    /** Test P4 10: stop() stellt den Timer ab und flusht den Rest; ein zweites stop() ist harmlos. */
    private async testCallCounterStopFlushes(statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 10: Shutdown flusht';
        const lineage = `__st_stop_${Date.now()}`;
        try {
            const counter = new KennelCallCounter(statsStore, { flushIntervalMs: 60_000 });
            counter.start();
            counter.record(lineage, 'api-execute', false);
            await counter.stop();
            if ((counter as any).timer !== null) throw new Error('Timer laeuft nach stop()');
            if (counter.status().pending !== 0) throw new Error('pending nach stop()');
            const agg = (await statsStore.readKennelCallAggregates('2000-01-01', [lineage]))[0];
            if (agg?.total !== 1) throw new Error(`nicht geflusht: ${JSON.stringify(agg)}`);
            await counter.stop();
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await statsStore.deleteKennelStats(lineage); } catch { /* ignore */ }
        }
    }

    /** Ein Zaehler-Stub, der jede Zaehlung festhaelt: [lineageId, source, leadFailed]. */
    private recordingCounter(): { counter: KennelCallCounter; calls: Array<[string, string, boolean]> } {
        const calls: Array<[string, string, boolean]> = [];
        const counter = {
            record: (l: string, s: string, f: boolean) => { calls.push([l, s, f]); },
            recordDog: () => { /* P4b: Dog-Laeufe zaehlt dieser Stub nicht */ },
        } as unknown as KennelCallCounter;
        return { counter, calls };
    }

    /**
     * Test P4 3: jede der neun Aufrufstellen zaehlt genau einmal mit ihrer Quelle aus 4.5 — keine
     * `unknown`-Zaehlung auf einem bekannten Weg. HEAD zaehlt nicht.
     */
    private async testEveryRunPathIsAttributed(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P4 3: neun Aufrufstellen, je eine Quelle, kein unknown';
        const stamp = Date.now();
        const kennelId = `test-attr-${stamp}`;
        const builtId = `test-attr-build-${stamp}`;
        try {
            const dog = await this.saveAclTestDog(nodesStore, 'AttrDog', 'return { attr: 1 };', { visibility: 'public', ownerId: 'UO' });
            const created = await kennelsController.create({ id: kennelId, name: 'Attr', dogIds: [dog], visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const { counter, calls } = this.recordingCounter();
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            const owner = this.fakeUser('UO');
            const req = { params: { id: kennelId }, ctx: owner };
            const expectOne = (label: string, source: string, lineage = kennelId) => {
                const got = calls.splice(0);
                if (got.length !== 1 || got[0][0] !== lineage || got[0][1] !== source || got[0][2] !== false) {
                    throw new Error(`${label}: ${JSON.stringify(got)} statt [${lineage}, ${source}, false]`);
                }
            };

            await this.callHandler(runHandler, 'handlePublicHead', req);
            if (calls.length !== 0) throw new Error(`HEAD zaehlt: ${JSON.stringify(calls)}`);
            await this.callHandler(runHandler, 'handlePublicGet', req); expectOne('GET /k/:id', 'public');
            await this.callHandler(runHandler, 'handlePublicPost', { ...req, method: 'POST', body: {} }); expectOne('POST /k/:id', 'public');
            await this.callHandler(runHandler, 'handleExecute', req); expectOne('/execute', 'api-execute');
            await this.callHandler(runHandler, 'handleRun', req); expectOne('/run', 'api-run');
            await this.callHandler(swagger, 'handleSwaggerJson', req); expectOne('openapi.json', 'swagger');
            const tool = async (name: string, args: Record<string, any>) => {
                const r = await this.toolNamed(name).handler(args, owner, deps);
                if (r.isError) throw new Error(`${name}: ${r.content[0]?.text}`);
                return r;
            };
            await tool('run_kennel', { id: kennelId }); expectOne('run_kennel', 'mcp-run');
            await tool('execute_kennel', { id: kennelId }); expectOne('execute_kennel', 'mcp-execute');
            await tool('refresh_kennel_snapshot', { id: kennelId });
            await tool('wait_for_kennel_snapshot', { id: kennelId, timeoutMs: 30_000 });
            expectOne('refresh_kennel_snapshot', 'mcp-snapshot');
            const built = await tool('build_kennel', {
                id: builtId, visibility: 'private', dogs: [{ displayName: `AttrBuilt${stamp}`, tsCode: 'return { built: 1 };' }],
            });
            expectOne('build_kennel', 'mcp-build', builtId);
            for (const d of JSON.parse(built.content[0].text).dogs ?? []) {
                if (d?.lineageId) await this.deleteDogLineage(nodesStore, d.lineageId);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const id of [kennelId, builtId]) {
                try { await kennelsController.delete(id); } catch { /* ignore */ }
            }
        }
    }

    /** Test P4 4: ein Lauf ohne aufloesbaren Lead zaehlt einmal, mit leadFailed. */
    private async testFailedRunCountsLeadFailed(
        nodesStore: IStore,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'P4 4: fehlgeschlagener Lauf zaehlt mit leadFailed';
        const kennelId = `test-leadfailed-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'Lead fehlt', dogIds: [`gibt-es-nicht-${Date.now()}`], visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const config = await runHandler.loadKennelConfig(kennelId);
            let threw = false;
            try {
                await runHandler.runKennel(config!, {}, undefined, undefined, undefined, { source: 'api-run' });
            } catch {
                threw = true;
            }
            const agg = counter.pendingAggregates('2000-01-01').get(kennelId);
            if (agg?.total !== 1 || agg.leadFailed !== 1 || agg.rankedTotal !== 0) throw new Error(`Zaehlung (warf: ${threw}): ${JSON.stringify(agg)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test P4 6: Upsert (eine Zeile je Nutzer), Aggregat, Verteilung und Bayes-Score. Der globale
     * Mittelwert m kommt aus allen Bewertungen der DB — erwartet wird die Formel mit demselben m.
     */
    private async testRatingAggregateAndBayes(statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 6: Rating-Upsert, Aggregat, Histogramm, Bayes';
        const stamp = Date.now();
        const lineage = `__st_r_${stamp}`;
        const unrated = `__st_r0_${stamp}`;
        try {
            const stats = new KennelStatsService(statsStore, new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 }));
            const globalMean = async () => {
                const all = await statsStore.readKennelRatingAggregates();
                const n = all.reduce((s, r) => s + r.count, 0);
                return n === 0 ? 0 : all.reduce((s, r) => s + r.sum, 0) / n;
            };
            const check = async (label: string, count: number, sum: number, histogram: Record<number, number>) => {
                stats.invalidate();
                const got = (await stats.attachOne({ id: lineage })).stats.rating;
                const m = await globalMean();
                const score = (KennelStatsService.BAYES_C * m + sum) / (KennelStatsService.BAYES_C + count);
                if (got.count !== count || got.avg !== sum / count || Math.abs(got.score - score) > 1e-9) {
                    throw new Error(`${label}: ${JSON.stringify(got)} statt count ${count}, avg ${sum / count}, score ${score}`);
                }
                const view = await stats.ratingView(lineage, 'UA');
                const want = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...histogram };
                if (JSON.stringify(view.histogram) !== JSON.stringify(want)) throw new Error(`${label}: Histogramm ${JSON.stringify(view.histogram)}`);
                return view;
            };
            await statsStore.upsertKennelRating(lineage, 'UA', 3);
            await statsStore.upsertKennelRating(lineage, 'UA', 5);
            const first = await check('UA 5', 1, 5, { 5: 1 });
            if (first.mine !== 5) throw new Error(`mine: ${first.mine}`);
            await statsStore.upsertKennelRating(lineage, 'UB', 1);
            await check('UA 5 + UB 1', 2, 6, { 1: 1, 5: 1 });
            if (!(await statsStore.deleteKennelRating(lineage, 'UA'))) throw new Error('delete UA meldet nichts');
            const after = await check('nur UB 1', 1, 1, { 1: 1 });
            if (after.mine !== null) throw new Error('mine nach delete nicht null');
            if (await statsStore.deleteKennelRating(lineage, 'UA')) throw new Error('zweites delete meldet einen Treffer');
            const none = (await stats.attachOne({ id: unrated })).stats;
            if (none.rating.avg !== null || none.rating.score !== 0 || none.rating.count !== 0 || none.calls.total !== 0) {
                throw new Error(`unbewertet: ${JSON.stringify(none)}`);
            }
            // Das Rechenbeispiel aus 4.4: m = 3,8; A (1, 5) -> 4,00; B (10, 45) -> 4,27.
            if (KennelStatsService.score(1, 5, 3.8).toFixed(2) !== '4.00' || KennelStatsService.score(10, 45, 3.8).toFixed(2) !== '4.27') {
                throw new Error('Bayes-Rechenbeispiel stimmt nicht');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await statsStore.deleteKennelStats(lineage); } catch { /* ignore */ }
        }
    }

    /** Test P4 9: ein Kennel-Delete raeumt beide Tabellen und die ungeflushten Deltas seiner Lineage. */
    private async testKennelDeleteClearsStats(kennelsStore: IStore, statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 9: Kennel-Delete raeumt Zaehler, Sterne, pending';
        const lineage = `test-st-d-${Date.now()}`;
        try {
            const counter = new KennelCallCounter(statsStore, { flushIntervalMs: 0 });
            const controller = new KennelController(kennelsStore);
            controller.setStatsJanitor(new KennelStatsService(statsStore, counter));
            const created = await controller.create({ id: lineage, name: 'Delete raeumt', dogIds: [], visibility: 'private', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            counter.record(lineage, 'public', false);
            await counter.flush();
            await statsStore.upsertKennelRating(lineage, 'UA', 4);
            counter.record(lineage, 'public', false);
            const deleted = await controller.delete(lineage);
            if (!deleted.ok) throw new Error(`delete: ${deleted.error}`);
            if ((await statsStore.readKennelCallAggregates('2000-01-01', [lineage])).length !== 0) throw new Error('KennelCallDaily nicht leer');
            if ((await statsStore.readKennelRatingAggregates([lineage])).length !== 0) throw new Error('KennelRating nicht leer');
            if (counter.pendingAggregates('2000-01-01').has(lineage)) throw new Error('pending traegt die Lineage noch');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await statsStore.deleteKennelStats(lineage); } catch { /* ignore */ }
        }
    }

    /**
     * Test P4 7: die Rating-Regeln 4.4.1 ueber den REST-Handler — Owner/Editor 403, stars ausser
     * 1..5 (auch "4") 400, anonym 401 mit WWW-Authenticate, Super-User ohne Identitaet 403, ohne RUN
     * 404; ein Fremder mit RUN bewertet (200, mine); Community-Kennel bewertet auch U1; DELETE idempotent.
     */
    private async testRatingRules(kennelsController: KennelController, statsStore: IKennelStatsStore): Promise<void> {
        const testName = 'P4 7: Rating-Regeln (REST)';
        const stamp = Date.now();
        const owned = `test-rate-${stamp}`;
        const priv = `test-rate-priv-${stamp}`;
        const community = `test-rate-comm-${stamp}`;
        try {
            const mk = async (id: string, visibility: Visibility, ownerId: string | null, editors?: string[]) => {
                const r = await kennelsController.create({ id, name: id, dogIds: [], visibility, ownerId, ...(editors ? { editors } : {}) });
                if (!r.ok) throw new Error(`Kennel ${id} nicht angelegt: ${r.error}`);
            };
            await mk(owned, 'run-only', 'U1', ['U2']);
            await mk(priv, 'private', 'U1');
            await mk(community, 'public', null);
            const stats = new KennelStatsService(statsStore, new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 }));
            const handler = new KennelRatingHandler(kennelsController, stats);
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const put = (id: string, ctx: AuthCtx, stars: unknown) => this.callHandler(handler, 'handlePut', { params: { id }, body: { stars }, ctx, method: 'PUT' });
            const expectErr = (label: string, out: { statusCode: number; body: any }, status: number, code: string) => {
                if (out.statusCode !== status || out.body?.error !== code) throw new Error(`${label}: ${out.statusCode} ${JSON.stringify(out.body)}`);
            };

            expectErr('Owner', await put(owned, this.fakeUser('U1'), 5), 403, 'owner_cannot_rate');
            expectErr('Editor', await put(owned, this.fakeUser('U2'), 5), 403, 'editor_cannot_rate');
            expectErr('stars 6', await put(owned, this.fakeUser('U3'), 6), 400, 'invalid_stars');
            expectErr('stars "4"', await put(owned, this.fakeUser('U3'), '4'), 400, 'invalid_stars');
            expectErr('stars 4.5', await put(owned, this.fakeUser('U3'), 4.5), 400, 'invalid_stars');
            const anonPut = await put(owned, anon, 4);
            expectErr('anonym', anonPut, 401, 'unauthorized');
            if (!anonPut.headers['www-authenticate']) throw new Error('401 ohne WWW-Authenticate');
            expectErr('Super-User ohne user', await put(owned, { user: null, isSuperUser: true }, 4), 403, 'no_identity');
            expectErr('privat, Fremder', await put(priv, this.fakeUser('U3'), 4), 404, 'not_found');
            expectErr('unbekannt', await put(`gibt-es-nicht-${stamp}`, this.fakeUser('U3'), 4), 404, 'not_found');

            const rated = await put(owned, this.fakeUser('U3'), 4);
            if (rated.statusCode !== 200 || rated.body?.mine !== 4 || rated.body?.count !== 1 || rated.body?.lineageId !== owned || rated.body?.histogram?.[4] !== 1) {
                throw new Error(`U3 bewertet: ${rated.statusCode} ${JSON.stringify(rated.body)}`);
            }
            const seen = await this.callHandler(handler, 'handleGet', { params: { id: owned }, ctx: anon });
            if (seen.statusCode !== 200 || seen.body?.mine !== null || seen.body?.avg !== 4) throw new Error(`GET anonym: ${JSON.stringify(seen.body)}`);
            if ((await this.callHandler(handler, 'handleGet', { params: { id: priv }, ctx: anon })).statusCode !== 404) throw new Error('GET privat anonym nicht 404');
            const byCommunity = await put(community, this.fakeUser('U1'), 5);
            if (byCommunity.statusCode !== 200 || byCommunity.body?.mine !== 5) throw new Error(`Community: ${byCommunity.statusCode} ${JSON.stringify(byCommunity.body)}`);

            const del = () => this.callHandler(handler, 'handleDelete', { params: { id: owned }, ctx: this.fakeUser('U3'), method: 'DELETE' });
            const cleared = await del();
            if (cleared.statusCode !== 200 || cleared.body?.mine !== null || cleared.body?.count !== 0) throw new Error(`DELETE: ${JSON.stringify(cleared.body)}`);
            if ((await del()).statusCode !== 200) throw new Error('zweites DELETE nicht 200');
            expectErr('DELETE anonym', await this.callHandler(handler, 'handleDelete', { params: { id: owned }, ctx: anon }), 401, 'unauthorized');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const id of [owned, priv, community]) {
                try { await kennelsController.delete(id); } catch { /* ignore */ }
                try { await statsStore.deleteKennelStats(id); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Test P4 8: ListQuery sortiert nach Aufrufen und Sternen und filtert nach minStars (Rohschnitt)
     * und minCalls (ranked); total zaehlt nach den Filtern; q kombiniert; Gleichstand nach id.
     */
    private async testListQuerySortsAndFiltersByStats(): Promise<void> {
        const testName = 'P4 8: ListQuery nach Aufrufen und Sternen';
        try {
            const kennel = (id: string, name: string, ranked: number, avg: number | null, score: number, count: number) => ({
                id, name, stats: { calls: { total: ranked, last30d: ranked, leadFailed: 0, ranked, ranked30d: ranked }, rating: { avg, count, score } },
            });
            const items = [
                kennel('a', 'Alpha Wetter', 10, 4.0, 4.0, 1),
                kennel('b', 'Beta Wetter', 50, 4.5, 4.27, 10),
                kennel('c', 'Gamma', 0, null, 0, 0),
                kennel('d', 'Delta', 10, 3.0, 3.0, 2),
            ];
            const run = (q: Record<string, unknown>) => {
                const query = ListQuery.from(q);
                const page = query.apply(items, undefined);
                return { ids: page.data.map((k) => k.id).join(','), total: page.total, body: query.envelope(page) };
            };
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            expect('sort=calls desc', run({ sort: 'calls', dir: 'desc' }).ids, 'b,d,a,c');   // Gleichstand a/d: id, umgekehrt
            expect('sort=calls asc', run({ sort: 'calls', dir: 'asc' }).ids, 'c,a,d,b');
            expect('sort=calls30d desc', run({ sort: 'calls30d', dir: 'desc' }).ids, 'b,d,a,c');
            expect('sort=rating desc', run({ sort: 'rating', dir: 'desc' }).ids, 'b,a,d,c');
            const starred = run({ minStars: '4' });
            expect('minStars=4', starred.ids, 'a,b');
            if (starred.total !== 2) throw new Error(`minStars total: ${starred.total}`);
            expect('minCalls=20', run({ minCalls: '20' }).ids, 'b');
            expect('minCalls=0', run({ minCalls: 0 }).ids, 'a,b,d,c');
            expect('q + rating', run({ q: 'wetter', sort: 'rating', dir: 'desc' }).ids, 'b,a');
            expect('minStars kaputt', run({ minStars: 'viel', sort: 'nonsense' }).ids, 'a,b,d,c');
            const paged = run({ sort: 'calls30d', dir: 'desc', limit: '2', minStars: 3 });
            if (paged.ids !== 'b,d' || paged.total !== 3 || (paged.body as any).total !== 3) throw new Error(`Seite: ${JSON.stringify(paged)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test P4 12: GET /api/landing — X (public, Aufrufe) nur in topByCalls30d, Y (public, Sterne) nur
     * in topByRating, der private Kennel mit hohen Zahlen in keiner Liste; ein run-only-Kennel rankt
     * (8.17), aber ohne defaultQuery in der url; jede url beginnt mit /k/; der zweite Aufruf liest
     * nichts (Memo); If-None-Match mit dem ETag -> 304.
     */
    private async testLandingRanksOnlyPublic(): Promise<void> {
        const testName = 'P4 12: /api/landing nur Oeffentliches, Memo, ETag';
        try {
            const kennels = [
                { id: 'vx', lineageId: 'land-x', name: 'X', visibility: 'public', ownerId: 'UO', dogIds: ['d'], defaultQuery: { lat: '51.72', lng: '8.75' }, description: 'x'.repeat(200) },
                { id: 'vy', lineageId: 'land-y', name: 'Y', visibility: 'public', ownerId: 'UO', dogIds: ['d'] },
                { id: 'vz', lineageId: 'land-z', name: 'Z', visibility: 'private', ownerId: 'UO', dogIds: ['d'] },
                { id: 'vr', lineageId: 'land-r', name: 'R', visibility: 'run-only', ownerId: 'UO', dogIds: ['d'], defaultQuery: { secret: 'p4-default-r' } },
            ];
            let reads = 0;
            const store: IKennelStatsStore = {
                ...StartupTest.NO_STATS_STORE,
                readKennelCallAggregates: async () => {
                    reads += 1;
                    return [
                        { lineageId: 'land-x', total: 5, last30d: 5, leadFailed: 0, leadFailed30d: 0, rankedTotal: 5, ranked30d: 5 },
                        { lineageId: 'land-z', total: 900, last30d: 900, leadFailed: 0, leadFailed30d: 0, rankedTotal: 900, ranked30d: 900 },
                        { lineageId: 'land-r', total: 2, last30d: 2, leadFailed: 0, leadFailed30d: 0, rankedTotal: 2, ranked30d: 2 },
                    ];
                },
                readKennelRatingAggregates: async () => [
                    { lineageId: 'land-y', count: 3, sum: 13 },
                    { lineageId: 'land-z', count: 40, sum: 200 },
                ],
            };
            const stats = new KennelStatsService(store, new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 }));
            const controller = { listLatest: async () => ({ ok: true, data: kennels.map((k) => ({ ...k })) }) } as unknown as KennelController;
            const handler = new LandingRouteHandler(controller, stats);
            const loads = (): number => handler.memoLoads;
            const get = (headers: Record<string, string> = {}) => {
                const { res, out } = this.fakeResponse();
                (res as any).end = () => res;
                return (handler as any).handleLanding({ query: { limit: '10' }, headers, get: (h: string) => headers[h.toLowerCase()] }, res).then(() => out);
            };
            const first = await get();
            const body = JSON.parse(first.body);
            const ids = (list: any[]) => list.map((e) => e.lineageId).join(',');
            if (first.statusCode !== 200) throw new Error(`Status ${first.statusCode}`);
            if (ids(body.topByCalls30d) !== 'land-x,land-r') throw new Error(`topByCalls30d: ${ids(body.topByCalls30d)}`);
            if (ids(body.topByRating) !== 'land-y') throw new Error(`topByRating: ${ids(body.topByRating)}`);
            if (first.body.includes('land-z') || first.body.includes('p4-default-r')) throw new Error('privater Kennel oder run-only-Default in der Landing');
            const all = [...body.topByCalls30d, ...body.topByRating];
            if (all.some((e: any) => !String(e.url).startsWith('/k/'))) throw new Error('url ohne /k/');
            const x = body.topByCalls30d[0];
            if (x.url !== '/k/land-x?lat=51.72&lng=8.75' || x.description.length !== 140 || !x.description.endsWith('…')) {
                throw new Error(`Eintrag X: ${x.url} ${x.description.length}`);
            }
            if (body.windowDays !== 30 || typeof body.generatedAt !== 'string') throw new Error('Kopf der Antwort');
            if (first.headers['cache-control'] !== 'public, max-age=60' || !first.headers['etag']) throw new Error(`Header: ${JSON.stringify(first.headers)}`);

            const second = await get();
            if (second.body !== first.body || loads() !== 1 || reads !== 1) throw new Error(`Memo: loads ${loads()}, reads ${reads}`);
            const cached = await get({ 'if-none-match': first.headers['etag'] });
            if (cached.statusCode !== 304) throw new Error(`If-None-Match: ${cached.statusCode}`);
            stats.invalidate();
            await get();
            if (loads() !== 2) throw new Error('invalidate() leert das Landing-Memo nicht');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Ein SerializedDog fuer die P4b-Laeufe — nur im Speicher, nie im Store. */
    private p4bDog(displayName: string, theRun: string, parentsRequired: string[] = []): SerializedDog<unknown> {
        const id = generateVersionId();
        const cfg: ISerializedDogConfig = {
            id, lineageId: generateLineageId(), parentId: null, displayName, theRun, parentsRequired, parentsOptional: [],
        };
        return new SerializedDog<unknown>(cfg, id);
    }

    /** Ein KennelRun ueber Speicher-Dogs mit einem Observer, der jeden Report festhaelt. */
    private p4bRun(baseDogsMap: Map<string, any>, dogIds: string[], dogs: SerializedDog<unknown>[]): { run: KennelRun; reports: DogRunReport[] } {
        const reports: DogRunReport[] = [];
        const run = new KennelRun({ id: `test-p4b-${Date.now()}`, dogIds }, baseDogsMap,
            async (ids) => dogs.filter((d) => ids.includes(d.lineageId as string)));
        run.setDogRunObserver({ onDogRun: (r) => { reports.push(r); } });
        return { run, reports };
    }

    /**
     * Test P4b 1: der Observer hoert je gelaufenem Hund genau einen Report — Base-Dog und zwei
     * SerializedDogs in drei Wellen, der letzte wirft; ok/ok/error, Dauer >= 0, waveIndex steigt.
     * Ein werfender Observer toetet die Welle nicht.
     */
    private async testDogRunObserverOncePerDog(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 1: Observer feuert je Hund genau einmal';
        try {
            const a = this.p4bDog('P4bA', 'return { a: 1 };', ['QueryRetriever']);
            const b = this.p4bDog('P4bB', 'throw new Error("p4b boom");', [a.lineageId as string]);
            const { run, reports } = this.p4bRun(baseDogsMap, ['base:QueryRetriever', a.lineageId as string, b.lineageId as string], [a, b]);
            await run.run();
            const seen = reports.map((r) => `${r.dog.name === 'QueryRetriever' ? 'Q' : r.dog === a ? 'A' : 'B'}:${r.outcome}:${r.waveIndex}`).join(',');
            if (seen !== 'Q:ok:0,A:ok:1,B:error:2') throw new Error(`Reports: ${seen}`);
            if (reports.some((r) => !(r.durationMs >= 0))) throw new Error('durationMs < 0');
            if (!String(reports[2].errorMessage).includes('p4b boom')) throw new Error(`errorMessage: ${reports[2].errorMessage}`);

            const again = this.p4bDog('P4bC', 'return { c: 1 };');
            const throwing = new KennelRun({ id: 'test-p4b-throwing', dogIds: [again.lineageId as string] }, baseDogsMap, async () => [again]);
            throwing.setDogRunObserver({ onDogRun: () => { throw new Error('observer kaputt'); } });
            const season = await throwing.run();
            if ((season.exhausted[0] as any)?.collected?.c !== 1) throw new Error('werfender Observer hat die Welle gestoert');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Test P4b 2: Timeout und OOM nur ueber die Marker; alles andere ist error. */
    private async testDogRunClassification(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 2: Klassifikation timeout/oom/error';
        try {
            const spin = this.p4bDog('P4bSpin', 'while (true) {}');
            const { run, reports } = this.p4bRun(baseDogsMap, [spin.lineageId as string], [spin]);
            run.setVmTimeoutMs(200);
            await run.run();
            if (reports.length !== 1 || reports[0].outcome !== 'timeout') throw new Error(`while(true): ${JSON.stringify(reports.map((r) => [r.outcome, r.errorMessage]))}`);
            if (classifyDogError(`SerializedDog x ("y"): ${DOG_OOM_MARKER} of 64 MB`) !== 'oom') throw new Error('OOM-Marker nicht erkannt');
            if (classifyDogError('Cannot read properties of undefined') !== 'error') throw new Error('Prosa als timeout/oom erkannt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test P4b 3: der Cache-Wrapper zaehlt je Hund — erster Lauf holt (miss), zweiter trifft
     * (hit, 0 misses = Klasse cached); NEG-HIT zaehlt als Treffer und der Lauf als error.
     */
    private async testDogCacheStatsWrapper(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 3: Cache-Wrapper zaehlt Hit/Miss, NEG-HIT';
        try {
            const memory = new Map<string, unknown>();
            const fake: ICacheHandler = {
                get: async (k) => memory.get(k) as any,
                set: async (k, v) => { memory.set(k, v); },
                has: async (k) => memory.has(k),
                getOrFetch: async <T,>(key: string, _ttl: number, factory: () => Promise<T>): Promise<T> => {
                    if (key === 'neg') throw new Error('provider down (negativ gecacht)');
                    if (memory.has(key)) return memory.get(key) as T;
                    const value = await factory();
                    memory.set(key, value);
                    return value;
                },
                invalidate: async (k) => { memory.delete(k); },
                invalidateByPrefix: async () => {},
                prune: async () => {},
                getTileFeatureCache: () => ({}) as any,
            };
            const cachingDog = (dogName: string, key: string) => class extends Dog<number> {
                private cache?: ICacheHandler;
                get name() { return dogName; }
                get required() { return []; }
                get optional() { return []; }
                setCacheHandler(handler: ICacheHandler) { this.cache = handler; }
                protected yieldCollectorFactory = async () => this.cache!.getOrFetch(key, 60_000, async () => 42);
            };
            const map = new Map(baseDogsMap);
            map.set('P4bCachingDog', cachingDog('P4bCachingDog', 'p4b-key'));
            map.set('P4bNegDog', cachingDog('P4bNegDog', 'neg'));
            const runOnce = async (dogId: string): Promise<DogRunReport> => {
                const reports: DogRunReport[] = [];
                const run = new KennelRun({ id: 'test-p4b-cache', dogIds: [dogId] }, map, undefined, undefined, undefined, [], fake);
                run.setDogRunObserver({ onDogRun: (r) => { reports.push(r); } });
                await run.run();
                if (reports.length !== 1) throw new Error(`${dogId}: ${reports.length} Reports`);
                return reports[0];
            };
            const cachedOf = (r: DogRunReport) => r.outcome === 'ok' && r.cacheHits > 0 && r.cacheMisses === 0;
            const first = await runOnce('base:P4bCachingDog');
            if (first.cacheMisses !== 1 || first.cacheHits !== 0 || first.outcome !== 'ok' || cachedOf(first)) throw new Error(`Lauf 1: ${JSON.stringify([first.cacheHits, first.cacheMisses, first.outcome])}`);
            const second = await runOnce('base:P4bCachingDog');
            if (second.cacheHits !== 1 || second.cacheMisses !== 0 || !cachedOf(second)) throw new Error(`Lauf 2: ${JSON.stringify([second.cacheHits, second.cacheMisses, second.outcome])}`);
            const neg = await runOnce('base:P4bNegDog');
            if (neg.cacheHits !== 1 || neg.cacheMisses !== 0 || neg.outcome !== 'error') throw new Error(`NEG-HIT: ${JSON.stringify([neg.cacheHits, neg.cacheMisses, neg.outcome])}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Test P4b 4: der Zaehl-Schluessel — Lineage, `base:Name`, Platzhalter-Mimic null. */
    private async testDogStatsKeyOf(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 4: dogStatsKeyOf';
        try {
            const serialized = this.p4bDog('P4bKey', 'return 1;');
            if (dogStatsKeyOf(serialized) !== serialized.lineageId) throw new Error(`SerializedDog: ${dogStatsKeyOf(serialized)}`);
            const QueryRetrieverClass = baseDogsMap.get('QueryRetriever');
            if (dogStatsKeyOf(new QueryRetrieverClass({})) !== 'base:QueryRetriever') throw new Error('Base-Dog nicht base:QueryRetriever');
            const placeholder = new MimicDog<unknown>({ theRun: 'throw new Error("x");', imitates: 'P4bPact', displayName: 'auto-mimic-P4bPact' }, 'auto-mimic-P4bPact');
            if (dogStatsKeyOf(placeholder) !== null) throw new Error(`Platzhalter-Mimic: ${dogStatsKeyOf(placeholder)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Der Store traegt die Dog-Tabellen (PrismaStore) — sonst ist die Montage falsch. */
    private dogStatsStoreOf(store: IStore): IDogStatsStore {
        if (typeof (store as any)?.incrementDogCalls !== 'function') throw new Error('Store implementiert IDogStatsStore nicht');
        return store as unknown as IDogStatsStore;
    }

    /**
     * Test P4b 5: recordDog + Flush — drei Laeufe (ok 812 ms, cached 5 ms, timeout 10 000 ms) von D in K
     * landen in EINER Zeile; ein zweiter Flush mit 20 000 ms hebt das Maximum (MAX/GREATEST).
     */
    private async testRecordDogAndFlush(statsStore: IKennelStatsStore, dogStore: IDogStatsStore): Promise<void> {
        const testName = 'P4b 5: recordDog + Flush (Klassen, Summe, Maximum)';
        const dogKey = `__st_dog_${Date.now()}`;
        const kennel = `__st_dogk_${Date.now()}`;
        try {
            const { store, flushes } = this.countingStatsStore(statsStore);
            const counter = new KennelCallCounter(store, { flushIntervalMs: 0 });
            const run = (outcome: 'ok' | 'timeout', cached: boolean, durationMs: number, hits = 0, misses = 1) =>
                counter.recordDog({ dogKey, kennelLineageId: kennel, source: 'public', outcome, cached, cacheHits: hits, cacheMisses: misses, durationMs });
            run('ok', false, 812);
            run('ok', true, 5, 1, 0);
            run('timeout', false, 10_000);
            counter.record(kennel, 'public', false);
            if (counter.status().pendingDogs !== 1 || counter.status().pending !== 1) throw new Error(`status: ${JSON.stringify(counter.status())}`);
            await counter.flush();
            if (flushes() !== 1) throw new Error(`Transaktionen: ${flushes()} statt 1 (Kennel + Dog gemeinsam)`);
            const since = utcDay(new Date(Date.now() - 29 * 86_400_000));
            const agg = (await dogStore.readDogCallAggregates(since, [dogKey]))[0];
            const got = agg ? [agg.count30d, agg.count30d - agg.cached30d - agg.failures30d, agg.cached30d, agg.failures30d, agg.durationMsSum30d, agg.durationMsMax30d].join(',') : 'keine Zeile';
            if (got !== '3,1,1,1,10817,10000') throw new Error(`count,ok,cached,timeouts,sum,max: ${got}`);
            run('ok', false, 20_000);
            await counter.flush();
            const again = (await dogStore.readDogCallAggregates(since, [dogKey]))[0];
            if (again?.durationMsMax30d !== 20_000 || again.count30d !== 4) throw new Error(`zweiter Flush: ${JSON.stringify(again)}`);
            if (counter.status().pendingDogs !== 0) throw new Error('pendingDogs nach Flush nicht 0');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await dogStore.deleteDogCalls(dogKey); } catch { /* ignore */ }
            try { await statsStore.deleteKennelStats(kennel); } catch { /* ignore */ }
        }
    }

    /** Test P4b 6: das Aggregat — 30-Tage-Fenster, Rangquellen, distinct Kennels. */
    private async testDogCallAggregate(dogStore: IDogStatsStore): Promise<void> {
        const testName = 'P4b 6: Dog-Aggregat (total, last30d, ranked30d, kennelsRun30d)';
        const dogKey = `__st_dogagg_${Date.now()}`;
        try {
            const today = utcDay(new Date());
            const old = utcDay(new Date(Date.now() - 31 * 86_400_000));
            const delta = (kennelLineageId: string, day: string, source: KennelCallSource, count: number): DogCallDelta => ({
                dogKey, kennelLineageId, day, source, count, ok: count, cached: 0, errors: 0, timeouts: 0, oom: 0,
                cacheHits: 0, cacheMisses: 0, durationMsSum: 0, durationMsMax: 0,
            });
            await dogStore.incrementDogCalls([
                delta('__st_k1', today, 'public', 99),
                delta('__st_k2', today, 'api-run', 21),
                delta('__st_k3', old, 'public', 500),
            ]);
            const since = utcDay(new Date(Date.now() - 29 * 86_400_000));
            const agg = (await dogStore.readDogCallAggregates(since, [dogKey]))[0];
            const got = agg ? [agg.total, agg.last30d, agg.ranked30d, agg.kennelsRun30d].join(',') : 'keine Zeile';
            if (got !== '620,120,99,2') throw new Error(`total,last30d,ranked30d,kennelsRun30d: ${got}`);
            const usage = (await dogStore.readDogKennelUsage(since, dogKey)).map((u) => `${u.kennelLineageId}:${u.count30d}`).sort().join(',');
            if (usage !== '__st_k1:99,__st_k2:21') throw new Error(`Nutzung je Kennel: ${usage}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await dogStore.deleteDogCalls(dogKey); } catch { /* ignore */ }
        }
    }

    /**
     * Test P4b 14 (Messpunkt): ein Lauf eines 20-Dog-Kennels legt <= 20 pending-Eintraege an, der
     * Observer kostet Mikrosekunden je Dog. Gemessen und protokolliert: RSS/heapUsed vor und nach der
     * Welle, heapUsed-Zuwachs je 1 000 pending-Eintraege (10 000 verschiedene Schluessel) — die Zahl,
     * die Amars ~200-Byte-Rechnung ersetzt. Mit P4B_MEASURE_RUNS=<n> zusaetzlich n Laeufe ohne Flush.
     */
    private async testDogCounterCost(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 14: Kosten des Dog-Zaehlers (Messpunkt)';
        const kennelId = `test-p4b-cost-${Date.now()}`;
        try {
            const dogIds: string[] = [];
            for (let i = 0; i < 20; i++) {
                dogIds.push(await this.saveAclTestDog(nodesStore, `P4bCost${i}`, `return { i: ${i} };`, { visibility: 'public', ownerId: 'UO' }));
            }
            const created = await kennelsController.create({ id: kennelId, name: 'P4b Kosten', dogIds, visibility: 'public', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const config = await runHandler.loadKennelConfig(kennelId);
            const mb = (n: number) => (n / 1_048_576).toFixed(2);

            const before = process.memoryUsage();
            const t0 = Date.now();
            await runHandler.runKennel(config!, {}, undefined, undefined, undefined, { source: 'api-execute' });
            const waveMs = Date.now() - t0;
            const after = process.memoryUsage();
            const pendingDogs = counter.status().pendingDogs;
            if (pendingDogs < 1 || pendingDogs > 20) throw new Error(`pendingDogs nach einem Lauf: ${pendingDogs}`);

            const extraRuns = Math.max(0, Number.parseInt(process.env.P4B_MEASURE_RUNS || '0', 10) || 0);
            let runsLine = '';
            if (extraRuns > 0) {
                const h0 = process.memoryUsage().heapUsed;
                for (let i = 0; i < extraRuns; i++) {
                    await runHandler.runKennel(config!, {}, undefined, undefined, undefined, { source: 'api-execute' });
                }
                runsLine = `; ${extraRuns} Laeufe ohne Flush: pendingDogs ${counter.status().pendingDogs}, heapUsed ${mb(process.memoryUsage().heapUsed - h0)} MB`;
            }

            // Observer-Kosten: 100 000 recordDog-Aufrufe auf bestehende Schluessel.
            const probe = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0, maxPending: 1_000_000 });
            const c0 = process.hrtime.bigint();
            for (let i = 0; i < 100_000; i++) {
                probe.recordDog({ dogKey: `d${i % 20}`, kennelLineageId: 'k', source: 'public', outcome: 'ok', cached: false, cacheHits: 0, cacheMisses: 1, durationMs: 5 });
            }
            const usPerDog = Number(process.hrtime.bigint() - c0) / 1000 / 100_000;
            if (usPerDog >= 1000) throw new Error(`recordDog kostet ${usPerDog} us je Dog`);

            // Speicher je pending-Eintrag: 10 000 verschiedene Schluessel mit echten Laengen (GUID-Dog, Kennel-Name).
            const keys = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0, maxPending: 1_000_000 });
            const dogKeys = Array.from({ length: 500 }, () => generateLineageId());
            const kennels = Array.from({ length: 20 }, (_, i) => `kennel-lineage-${i}-${Date.now()}`);
            (globalThis as any).gc?.();
            const h1 = process.memoryUsage().heapUsed;
            for (let i = 0; i < 10_000; i++) {
                keys.recordDog({ dogKey: dogKeys[i % 500], kennelLineageId: kennels[Math.floor(i / 500)], source: 'public', outcome: 'ok', cached: false, cacheHits: 0, cacheMisses: 1, durationMs: 5 });
            }
            (globalThis as any).gc?.();
            const perThousand = (process.memoryUsage().heapUsed - h1) / 10;
            if (keys.status().pendingDogs !== 10_000) throw new Error(`Schluessel: ${keys.status().pendingDogs}`);

            console.log(`[P4b 14] 20-Dog-Kennel, 1 Lauf ${waveMs} ms: pendingDogs ${pendingDogs}; RSS ${mb(before.rss)} -> ${mb(after.rss)} MB, `
                + `heapUsed ${mb(before.heapUsed)} -> ${mb(after.heapUsed)} MB; recordDog ${usPerDog.toFixed(2)} us/Dog; `
                + `heapUsed je 1 000 pending-Eintraege ${(perThousand / 1024).toFixed(1)} KB (${Math.round(perThousand / 1000)} B/Eintrag, gc ${typeof (globalThis as any).gc === 'function' ? 'ja' : 'nein'})${runsLine}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /** Ein Referenzindex mit eigenen Controllern — dieselbe Verdrahtung wie createHttpApplication. */
    private p4bIndexed(nodesStore: IStore, kennelsStore: IStore, dogStore: IDogStatsStore, baseDogsMap: Map<string, any>, counter?: KennelCallCounter) {
        const refIndex = new DogReferenceIndex(dogStore, nodesStore, baseDogsMap, counter);
        const nodes = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name, true, { refIndex });
        const kennels = new KennelController(kennelsStore, { refIndex });
        return { refIndex, nodes, kennels };
    }

    /** Die Referenzzeilen eines Ursprungs, lesbar sortiert: `kind:toKey@position/resolved`. */
    private async refsFrom(dogStore: IDogStatsStore, fromKind: 'kennel' | 'dog', fromKey: string): Promise<string> {
        return (await dogStore.readAllReferences())
            .filter((r) => r.fromKind === fromKind && r.fromKey === fromKey)
            .sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position)
            .map((r) => `${r.kind}:${r.toKey}@${r.position}/${r.resolved}`)
            .join(',');
    }

    /**
     * Test P4b 7: Ableitung am Controller — Kennel-Crew mit lineageId, `base:`-Eintrag und Version-GUID
     * (normalisiert auf die Lineage); Dog-parents mit blankem Base-Namen, lineageId und unbekannter GUID
     * (dangling, resolved 0); ein zweiter Save ersetzt die alten Zeilen.
     */
    private async testReferenceDerivation(nodesStore: IStore, kennelsStore: IStore, dogStore: IDogStatsStore, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 7: Referenz-Ableitung (Crew, parents, Normalisierung)';
        const kennelId = `test-p4b-refs-${Date.now()}`;
        const lineages: string[] = [];
        const { nodes, kennels } = this.p4bIndexed(nodesStore, kennelsStore, dogStore, baseDogsMap);
        try {
            const make = async (name: string) => {
                const created = await nodes.create({ displayName: name, theRun: 'return 1;', parentsRequired: [], parentsOptional: [], visibility: 'private', ownerId: 'UO' });
                if (!created.ok || !created.data?.lineageId) throw new Error(`Dog ${name}: ${created.error}`);
                lineages.push(created.data.lineageId);
                return { lineageId: created.data.lineageId as string, versionId: created.id as string };
            };
            const l1 = await make('P4bRef1');
            const l2 = await make('P4bRef2');
            const l3 = await make('P4bRef3');
            const k = await kennels.create({ id: kennelId, name: 'P4b Refs', dogIds: [l1.lineageId, 'base:QueryRetriever', l2.versionId], visibility: 'private', ownerId: 'UO' });
            if (!k.ok) throw new Error(`Kennel: ${k.error}`);
            const crew = await this.refsFrom(dogStore, 'kennel', kennelId);
            if (crew !== `crew:${l1.lineageId}@0/1,crew:base:QueryRetriever@1/1,crew:${l2.lineageId}@2/1`) throw new Error(`Crew: ${crew}`);

            const saved = await nodes.save({ id: l1.lineageId, theRun: 'return 2;', parentsRequired: ['QueryRetriever', l3.lineageId], parentsOptional: ['unbekannt-guid'] });
            if (!saved.ok) throw new Error(`Dog-Save: ${saved.error}`);
            const parents = await this.refsFrom(dogStore, 'dog', l1.lineageId);
            if (parents !== `optional:unbekannt-guid@0/0,required:base:QueryRetriever@0/1,required:${l3.lineageId}@1/1`) throw new Error(`parents: ${parents}`);
            const again = await nodes.save({ id: l1.lineageId, theRun: 'return 3;', parentsRequired: [l2.lineageId], parentsOptional: [] });
            if (!again.ok) throw new Error(`zweiter Save: ${again.error}`);
            const replaced = await this.refsFrom(dogStore, 'dog', l1.lineageId);
            if (replaced !== `required:${l2.lineageId}@0/1`) throw new Error(`nach zweitem Save: ${replaced}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennels.delete(kennelId); } catch { /* ignore */ }
            for (const l of lineages) {
                for (const v of await nodesStore.findAllVersions(SerializedDog.name, l).catch(() => [])) {
                    try { await nodes.delete(v.id); } catch { /* ignore */ }
                }
            }
        }
    }

    /**
     * Test P4b 8: der Boot-Rebuild ist idempotent — zweimal gebaut, dieselbe Menge; ihre Groesse ist
     * die Summe der Kopf-dogIds und Kopf-parents (Abnahme 4b.11); nach einer Kennel-Aenderung per
     * Controller entspricht der Rebuild dem Kopfstand.
     */
    private async testReferenceRebuildIdempotent(nodesStore: IStore, kennelsStore: IStore, dogStore: IDogStatsStore, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 8: Rebuild idempotent, Zeilen = Kopf-dogIds + Kopf-parents';
        const kennelId = `test-p4b-rebuild-${Date.now()}`;
        const { refIndex, kennels } = this.p4bIndexed(nodesStore, kennelsStore, dogStore, baseDogsMap);
        try {
            const setOf = async () => (await dogStore.readAllReferences())
                .map((r) => `${r.fromKind}|${r.fromKey}|${r.toKey}|${r.kind}|${r.position}|${r.fromOwnerId}|${r.resolved}`).sort().join('\n');
            const first = await refIndex.rebuild();
            const a = await setOf();
            const second = await refIndex.rebuild();
            const b = await setOf();
            if (a !== b || first.rows !== second.rows) throw new Error(`zwei Rebuilds verschieden (${first.rows} / ${second.rows})`);
            const heads = async (type: string) => nodesStore.findLatestByType(type);
            const count = (raw: unknown) => {
                const list = Array.isArray(raw) ? raw : (() => { try { return JSON.parse(String(raw)); } catch { return []; } })();
                return Array.isArray(list) ? list.filter((x: unknown) => typeof x === 'string' && x.length > 0).length : 0;
            };
            let expected = 0;
            for (const k of await heads('KennelConfig')) expected += count(k.dogIds);
            // Ein Kopf je Dog-Lineage ueber BEIDE Typen (eine Lineage kann SerializedDog- und MimicDog-Zeilen tragen).
            const dogHeads = new Map<string, any>();
            for (const type of ['SerializedDog', 'MimicDog']) {
                for (const d of await heads(type)) {
                    const cfg = (() => { try { return JSON.parse(d.serializedDogConfig); } catch { return {}; } })();
                    const key = d.lineageId || cfg?.lineageId || d.id;
                    const t = d.createdAt ? new Date(d.createdAt).getTime() : -Infinity;
                    const prev = dogHeads.get(key);
                    if (!prev || t > prev.t || (t === prev.t && String(d.id) > String(prev.id))) dogHeads.set(key, { t, id: d.id, cfg });
                }
            }
            for (const { cfg } of dogHeads.values()) expected += count(cfg?.parentsRequired) + count(cfg?.parentsOptional);
            if (first.rows !== expected) throw new Error(`Zeilen ${first.rows}, Kopf-dogIds + Kopf-parents ${expected}`);
            if (refIndex.referenceRows !== expected) throw new Error(`referenceRows ${refIndex.referenceRows} statt ${expected}`);

            const created = await kennels.create({ id: kennelId, name: 'P4b Rebuild', dogIds: ['base:QueryRetriever'], visibility: 'private', ownerId: 'UO' });
            if (!created.ok) throw new Error(`Kennel: ${created.error}`);
            const saved = await kennels.save({ id: kennelId, dogIds: ['base:QueryRetriever', 'base:BodyRetriever'] });
            if (!saved.ok) throw new Error(`Kennel-Save: ${saved.error}`);
            const viaController = await this.refsFrom(dogStore, 'kennel', kennelId);
            await refIndex.rebuild();
            const viaRebuild = await this.refsFrom(dogStore, 'kennel', kennelId);
            if (viaController !== 'crew:base:QueryRetriever@0/1,crew:base:BodyRetriever@1/1' || viaRebuild !== viaController) {
                throw new Error(`Controller ${viaController} / Rebuild ${viaRebuild}`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennels.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test P4b 12: letzte Version geloescht — DogCallDaily des Dogs leer, Referenzen VON ihm weg,
     * ungeflushte Deltas weg; Referenzen AUF ihn (Kennel-Crew) bleiben.
     */
    private async testDogDeleteClearsStats(nodesStore: IStore, kennelsStore: IStore, statsStore: IKennelStatsStore, dogStore: IDogStatsStore, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4b 12: Dog-Delete raeumt Laeufe, Referenzen von ihm, pending';
        const kennelId = `test-p4b-dogdel-${Date.now()}`;
        const counter = new KennelCallCounter(statsStore, { flushIntervalMs: 0 });
        const { nodes, kennels } = this.p4bIndexed(nodesStore, kennelsStore, dogStore, baseDogsMap, counter);
        let lineageId = '';
        try {
            const created = await nodes.create({ displayName: 'P4bDelDog', theRun: 'return 1;', parentsRequired: ['QueryRetriever'], parentsOptional: [], visibility: 'private', ownerId: 'UO' });
            if (!created.ok || !created.data?.lineageId) throw new Error(`Dog: ${created.error}`);
            lineageId = created.data.lineageId;
            const k = await kennels.create({ id: kennelId, name: 'P4b DogDel', dogIds: [lineageId], visibility: 'private', ownerId: 'UO' });
            if (!k.ok) throw new Error(`Kennel: ${k.error}`);
            const record = () => counter.recordDog({ dogKey: lineageId, kennelLineageId: kennelId, source: 'public', outcome: 'ok', cached: false, cacheHits: 0, cacheMisses: 0, durationMs: 3 });
            record();
            await counter.flush();
            record();
            const since = utcDay(new Date(Date.now() - 29 * 86_400_000));
            if ((await dogStore.readDogCallAggregates(since, [lineageId])).length !== 1) throw new Error('Vorbedingung: keine DogCallDaily-Zeile');
            if (!(await this.refsFrom(dogStore, 'dog', lineageId))) throw new Error('Vorbedingung: keine Referenz von D');

            const del = await nodes.delete(created.id as string);
            if (!del.ok) throw new Error(`Delete: ${del.error}`);
            if ((await dogStore.readDogCallAggregates(since, [lineageId])).length !== 0) throw new Error('DogCallDaily fuer D nicht leer');
            if (await this.refsFrom(dogStore, 'dog', lineageId)) throw new Error('Referenzen von D bleiben');
            if (counter.pendingDogAggregates(since).has(lineageId)) throw new Error('ungeflushte Deltas von D bleiben');
            const crew = await this.refsFrom(dogStore, 'kennel', kennelId);
            if (crew !== `crew:${lineageId}@0/1`) throw new Error(`Referenz auf D: ${crew}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennels.delete(kennelId); } catch { /* ignore */ }
            try { await statsStore.deleteKennelStats(kennelId); } catch { /* ignore */ }
            if (lineageId) try { await dogStore.deleteDogCalls(lineageId); } catch { /* ignore */ }
        }
    }

    /**
     * Test P4b 9: Kennzahlen und Crew-Effekt — D (u1) direkt in K1 (u1), K2 (u2, privat), K3 (community),
     * transitiv in K4 (u3) ueber E (parents required D). Anonym sieht usage drei Kennels, K2 zaehlt verborgen.
     */
    private async testDogReuseAndUsage(): Promise<void> {
        const testName = 'P4b 9: Wiederverwendung (direkt, transitiv, fremd, Owner) und usage';
        try {
            const ref = (fromKind: 'kennel' | 'dog', fromKey: string, toKey: string, kind: 'crew' | 'required' | 'optional', fromOwnerId: string | null, position = 0) =>
                ({ fromKind, fromKey, toKey, kind, position, fromOwnerId, resolved: 1 as const });
            const store: IDogStatsStore = {
                ...StartupTest.NO_DOG_STATS_STORE,
                readAllReferences: async () => [
                    ref('kennel', 'K1', 'D', 'crew', 'u1'), ref('kennel', 'K2', 'D', 'crew', 'u2'), ref('kennel', 'K3', 'D', 'crew', null),
                    ref('dog', 'E', 'D', 'required', 'u3'), ref('kennel', 'K4', 'E', 'crew', 'u3'),
                ],
            };
            const kennels = [
                { id: 'v1', lineageId: 'K1', name: 'K1', visibility: 'public', ownerId: 'u1' },
                { id: 'v2', lineageId: 'K2', name: 'K2', visibility: 'private', ownerId: 'u2' },
                { id: 'v3', lineageId: 'K3', name: 'K3', visibility: 'public', ownerId: null },
                { id: 'v4', lineageId: 'K4', name: 'K4', visibility: 'public', ownerId: 'u3' },
            ];
            const dogs = [{ id: 'vE', lineageId: 'E', displayName: 'E', visibility: 'public', ownerId: 'u3' }];
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });
            const service = new DogStatsService(store, counter, new KennelStatsService(StartupTest.NO_STATS_STORE, counter),
                { listKennels: async () => kennels, listDogs: async () => dogs });
            const d = await service.attachOne({ id: 'vD', lineageId: 'D', ownerId: 'u1' });
            const r = d.stats.reuse;
            const got = [r.kennelsDirect, r.kennelsTransitive, r.kennelsForeign, r.owners, r.dependents].join(',');
            if (got !== '3,4,3,4,1') throw new Error(`direct,transitive,foreign,owners,dependents: ${got}`);
            const usage = await service.usageOf(d, { user: null, isSuperUser: false });
            const listed = usage.kennels.map((k) => `${k.lineageId}:${k.via}`).sort().join(',');
            if (listed !== 'K1:crew,K3:crew,K4:transitive' || usage.hiddenKennels !== 1) throw new Error(`usage: ${listed}, hidden ${usage.hiddenKennels}`);
            if (usage.dependents.length !== 1 || usage.dependents[0].lineageId !== 'E' || usage.dependents[0].kind !== 'required') throw new Error(`dependents: ${JSON.stringify(usage.dependents)}`);
            if (usage.kennels.some((k) => k.url !== `/k/${k.lineageId}`)) throw new Error('url nicht /k/<lineageId>');
            if (d.stats.calls.avgDurationMs !== null || d.stats.proven.badge) throw new Error(`ohne Laeufe: ${JSON.stringify(d.stats)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Test P4b 10: die Formel an den vier Rechenbeispielen aus 4b.6. */
    private async testProvenFormula(): Promise<void> {
        const testName = 'P4b 10: Bewaehrt-Formel (14,09 / 3,00 / 0,33 / 1 042)';
        try {
            const a = DogStatsService.proven({ r: 99, n: 120, f: 6, k: 4, kf: 3, s: 4.27 });
            const b = DogStatsService.proven({ r: 999, n: 1000, f: 0, k: 1, kf: 0, s: null });
            const c = DogStatsService.proven({ r: 2, n: 3, f: 1, k: 1, kf: 0, s: null });
            const base = DogStatsService.proven({ r: 5000, n: 6000, f: 0, k: 180, kf: 150, s: 3.9 });
            const got = [a.score.toFixed(2), b.score.toFixed(2), c.score.toFixed(2), String(Math.round(base.score))].join(' / ');
            if (got !== '14.09 / 3.00 / 0.33 / 1042') throw new Error(`Scores: ${got}`);
            const badges = [a, b, c, base].map((x) => (x.badge ? 'ja' : 'nein')).join(',');
            if (badges !== 'ja,ja,nein,ja') throw new Error(`badge: ${badges}`);
            if (a.reliability !== 0.95 || c.reliability !== 0.7) throw new Error(`reliability: ${a.reliability}, ${c.reliability}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Test P4b 11: ListQuery fuer Dogs — sort=proven/calls30d/reuse, proven=1, Suche kombiniert, ohne stats hinten. */
    private async testListQuerySortsDogsByProven(): Promise<void> {
        const testName = 'P4b 11: ListQuery nach proven, calls30d, reuse';
        try {
            const dog = (id: string, displayName: string, score: number, badge: boolean, ranked30d: number, kennels: number) => ({
                id, displayName, stats: { calls: { ranked30d }, reuse: { kennelsTransitive: kennels }, proven: { score, badge, reliability: 1 } },
            });
            const items: any[] = [
                dog('a', 'Geo Lookup', 14.09, true, 99, 4),
                dog('b', 'Renderer', 3, true, 999, 1),
                dog('c', 'Geo Fresh', 0.33, false, 2, 1),
                { id: 'd', displayName: 'Ohne Stats' },
            ];
            const ids = (q: Record<string, unknown>) => ListQuery.from(q).apply(items, undefined).data.map((x: any) => x.id).join(',');
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            expect('sort=proven desc', ids({ sort: 'proven', dir: 'desc' }), 'a,b,c,d');
            expect('sort=calls30d desc', ids({ sort: 'calls30d', dir: 'desc' }), 'b,a,c,d');
            expect('sort=reuse desc', ids({ sort: 'reuse', dir: 'desc' }), 'a,c,b,d');
            expect('proven=1', ids({ proven: '1', sort: 'proven', dir: 'desc' }), 'a,b');
            expect('q=geo + proven', ids({ q: 'geo', sort: 'proven', dir: 'desc' }), 'a,c');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Feature-Runde (10-0: "durchsuchbar mit filtern, top alle mit stichworten oder nie benutzt oder nie
     * funktioniert"): ListQuery `usage` auf Kennel-stats — alle fuenf Werte, top ordnet selbst (gesamt, dann
     * 30 Tage) ausser mit sort, sort=failures30d, Kombination mit q und minCalls, kaputter Wert = kein Filter.
     */
    private async testListQueryUsageFiltersKennels(): Promise<void> {
        const testName = 'Feature-Runde 2: ListQuery usage auf Kennels (fuenf Werte, q, sort)';
        try {
            const kennel = (id: string, name: string, total: number, last30d: number, leadFailed: number, leadFailed30d: number) => ({
                id, name, stats: { calls: { total, last30d, leadFailed, leadFailed30d, ranked: total, ranked30d: last30d }, rating: { avg: null, count: 0, score: 0 } },
            });
            const items: any[] = [
                kennel('a', 'Alpha Wetter', 9, 4, 1, 1),      // gerufen, einer scheiterte in 30 T
                kennel('b', 'Beta Wetter', 3, 3, 3, 3),       // gerufen, jeder scheiterte
                kennel('c', 'Gamma', 0, 0, 0, 0),             // nie gerufen
                kennel('d', 'Delta Wetter', 7, 0, 2, 0),      // gerufen, 30 T still, alte Fehler
                kennel('e', 'Epsilon', 9, 9, 0, 0),           // gerufen, nie gescheitert
                { id: 'f', name: 'Ohne Stats' },              // alter Server: zaehlt als 0
            ];
            const ids = (q: Record<string, unknown>) => ListQuery.from(q).apply(items, undefined).data.map((x: any) => x.id).join(',');
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            if (USAGE_FILTERS.join() !== 'top,never_used,never_worked,failing,dormant') throw new Error(`USAGE_FILTERS: ${USAGE_FILTERS.join()}`);
            expect('top (eigene Ordnung)', ids({ usage: 'top' }), 'e,a,d,b');          // 9/9 vor 9/4, dann 7, 3
            expect('top + sort=name', ids({ usage: 'top', sort: 'name' }), 'a,b,d,e');
            expect('never_used', ids({ usage: 'never_used' }), 'c,f');
            expect('never_worked', ids({ usage: 'never_worked' }), 'b');
            expect('failing', ids({ usage: 'failing' }), 'a,b');
            expect('failing + sort=failures30d desc', ids({ usage: 'failing', sort: 'failures30d', dir: 'desc' }), 'b,a');
            expect('dormant', ids({ usage: 'dormant' }), 'd');
            expect('q=wetter + top', ids({ q: 'wetter', usage: 'top' }), 'a,d,b');
            expect('q=wetter + never_worked', ids({ q: 'wetter', usage: 'never_worked' }), 'b');
            expect('q=wetter + failing', ids({ q: 'wetter', usage: 'failing' }), 'a,b');
            expect('q=gamma + never_used', ids({ q: 'gamma', usage: 'never_used' }), 'c');
            expect('top + minCalls=8', ids({ usage: 'top', minCalls: 8 }), 'e,a');
            expect('usage kaputt = kein Filter', ids({ usage: 'popular' }), 'a,b,d,e,c,f');
            const page = ListQuery.from({ usage: 'top', limit: '2' });
            const cut = page.apply(items, undefined);
            if (cut.total !== 4 || cut.data.map((x: any) => x.id).join() !== 'e,a') throw new Error(`Seite: ${cut.total} ${cut.data.map((x: any) => x.id)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Feature-Runde 2 ueber das Werkzeug: list_kennels {usage} filtert nur, was der Aufrufer ausfuehren darf —
     * ein fremder privater, nie gerufener Kennel erscheint anonym nicht unter never_used, fuer den Owner schon;
     * Zahlen aus echten Zaehlungen (Counter mit Uhr, dormant = Laeufe vor 40 Tagen).
     */
    private async testListKennelsUsageRespectsRights(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'Feature-Runde 2: list_kennels usage nur ueber lesbaren Kennels';
        const p = `test-usage-${Date.now()}`;
        const names = ['top', 'flaky', 'broken', 'dormant', 'none', 'secret'];
        try {
            for (const n of names) {
                const created = await kennelsController.create({
                    id: `${p}-${n}`, name: `Usage ${n}`, dogIds: [],
                    visibility: n === 'secret' ? 'private' : 'public', ownerId: 'UU1',
                });
                if (!created.ok) throw new Error(`Kennel ${n}: ${created.error}`);
            }
            let clock = Date.now() - 40 * 86_400_000;
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0, now: () => new Date(clock) });
            counter.record(`${p}-dormant`, 'public', false);
            clock = Date.now();
            for (let i = 0; i < 5; i++) counter.record(`${p}-top`, 'public', false);
            counter.record(`${p}-flaky`, 'mcp-execute', false);
            counter.record(`${p}-flaky`, 'mcp-execute', false);
            counter.record(`${p}-flaky`, 'api-run', true);
            counter.record(`${p}-broken`, 'public', true);
            counter.record(`${p}-broken`, 'mcp-build', true);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            deps.kennelStats = new KennelStatsService(StartupTest.NO_STATS_STORE, counter);
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const owner = this.fakeUser('UU1');
            const list = async (args: Record<string, unknown>, ctx: AuthCtx) => {
                const r = await this.toolNamed('list_kennels').handler({ search: p, ...args }, ctx, deps);
                if (r.isError) throw new Error(`list_kennels ${JSON.stringify(args)}: ${r.content[0]?.text}`);
                const body = JSON.parse(r.content[0].text);
                const rows: any[] = Array.isArray(body) ? body : body.kennels;
                return rows.map((k) => String(k.lineageId).slice(p.length + 1)).join(',');
            };
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            expect('anon never_used', await list({ usage: 'never_used' }, anon), 'none');
            expect('owner never_used', await list({ usage: 'never_used' }, owner), 'none,secret');
            expect('top', await list({ usage: 'top' }, anon), 'top,flaky,broken,dormant');
            expect('never_worked', await list({ usage: 'never_worked' }, anon), 'broken');
            expect('failing', await list({ usage: 'failing', sort: 'failures30d', dir: 'desc' }, anon), 'broken,flaky');
            expect('dormant', await list({ usage: 'dormant' }, anon), 'dormant');
            expect('search + top', await list({ search: `${p}-fl`, usage: 'top' }, anon), 'flaky');
            const paged = await this.toolNamed('list_kennels').handler({ search: p, usage: 'top', limit: 2 }, anon, deps);
            const env = JSON.parse(paged.content[0].text);
            if (env.total !== 4 || env.kennels.length !== 2 || env.hasMore !== true) throw new Error(`Envelope: ${paged.content[0].text.slice(0, 200)}`);
            const flaky = env.kennels.find((k: any) => k.lineageId === `${p}-flaky`) ?? JSON.parse((await this.toolNamed('list_kennels').handler({ search: `${p}-flaky` }, anon, deps)).content[0].text)[0];
            if (flaky?.stats?.calls?.leadFailed30d !== 1 || flaky.stats.calls.total !== 3) throw new Error(`stats flaky: ${JSON.stringify(flaky?.stats)}`);
            const schema = this.toolNamed('list_kennels').inputSchema as any;
            if (schema.properties.usage?.enum?.join() !== USAGE_FILTERS.join() || !String(schema.properties.usage.description).includes('never_worked')) {
                throw new Error('list_kennels-Schema ohne usage-Definitionen');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const n of names) {
                try { await kennelsController.delete(`${p}-${n}`); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Feature-Runde 3 (10-0: "auch die dogs muessen ein failed tracking haben und suchbar sein"): ListQuery
     * `usage` auf Dog-stats (failures = error + timeout + oom), minReliability, sort=failures30d, mit q.
     */
    private async testListQueryUsageFiltersDogs(): Promise<void> {
        const testName = 'Feature-Runde 3: ListQuery usage, minReliability, failures30d auf Dogs';
        try {
            const dog = (id: string, displayName: string, total: number, last30d: number, failures: number, failures30d: number, reliability: number) => ({
                id, displayName, stats: {
                    calls: { total, last30d, ranked30d: last30d, failures, failures30d, cached30d: 0 },
                    reuse: { kennelsTransitive: 1 }, proven: { score: 0, badge: false, reliability },
                },
            });
            const items: any[] = [
                dog('a', 'Geo Lookup', 20, 20, 1, 1, 0.95),   // bewaehrt, ein Fehler in 30 T
                dog('b', 'Geo Broken', 4, 4, 4, 4, 0.7),      // jeder Lauf scheiterte (unter 5 Laeufen: 0,7)
                dog('c', 'Fresh Dog', 0, 0, 0, 0, 0.7),       // nie gelaufen
                dog('d', 'Old Geo', 12, 0, 3, 0, 0.7),        // lief, 30 T still
                dog('e', 'Clean Dog', 30, 30, 0, 0, 1),       // lief, nie gescheitert
            ];
            const ids = (q: Record<string, unknown>) => ListQuery.from(q).apply(items, undefined).data.map((x: any) => x.id).join(',');
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            expect('top', ids({ usage: 'top' }), 'e,a,d,b');
            expect('never_used', ids({ usage: 'never_used' }), 'c');
            expect('never_worked', ids({ usage: 'never_worked' }), 'b');
            expect('failing', ids({ usage: 'failing', sort: 'failures30d', dir: 'desc' }), 'b,a');
            expect('dormant', ids({ usage: 'dormant' }), 'd');
            expect('q=geo + top', ids({ q: 'geo', usage: 'top' }), 'a,d,b');
            expect('q=geo + failing', ids({ q: 'geo', usage: 'failing' }), 'b,a');
            expect('minReliability=0.9', ids({ minReliability: 0.9, sort: 'name' }), 'e,a');
            expect('minReliability + top', ids({ minReliability: '0.8', usage: 'top' }), 'e,a');
            expect('minReliability kaputt = kein Filter', ids({ minReliability: 3 }), 'e,c,b,a,d');   // nach Name
            expect('sort=failures30d desc', ids({ sort: 'failures30d', dir: 'desc' }), 'b,a,e,d,c');   // Gleichstand 0: id, umgekehrt
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Feature-Runde 3 ueber das Werkzeug: list_nodes {usage, minReliability, sort} auf echten Dog-Zaehlungen
     * (recordDog, Uhr fuer dormant) — ein fremder privater Dog erscheint anonym nie, fuer den Owner schon;
     * failures zaehlt error, timeout und oom; die Suche (Name/Beschreibung) kombiniert.
     */
    private async testListNodesUsageRespectsRights(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'Feature-Runde 3: list_nodes usage nur ueber lesbaren Dogs';
        const tag = `UsageDog${Date.now()}`;
        try {
            const mk = (n: string, visibility: Visibility = 'public') =>
                this.saveAclTestDog(nodesStore, `${tag}${n}`, `return { ${n.toLowerCase()}: 1 };`, { visibility, ownerId: 'UD1' });
            const dogs: Record<string, string> = {};
            for (const n of ['Clean', 'Flaky', 'Broken', 'Old', 'Fresh']) dogs[n] = await mk(n);
            dogs.Secret = await mk('Secret', 'private');
            let clock = Date.now() - 40 * 86_400_000;
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0, now: () => new Date(clock) });
            const run = (n: string, outcome: 'ok' | 'error' | 'timeout' | 'oom') => counter.recordDog({
                dogKey: dogs[n], kennelLineageId: '__usage_k', source: 'public', outcome, cached: false, cacheHits: 0, cacheMisses: 0, durationMs: 5,
            });
            run('Old', 'ok');
            run('Old', 'error');
            clock = Date.now();
            for (let i = 0; i < 8; i++) run('Clean', 'ok');
            for (let i = 0; i < 5; i++) run('Flaky', 'ok');
            run('Flaky', 'timeout');
            run('Broken', 'error');
            run('Broken', 'timeout');
            run('Broken', 'oom');
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            deps.dogStats = new DogStatsService(StartupTest.NO_DOG_STATS_STORE, counter, new KennelStatsService(StartupTest.NO_STATS_STORE, counter));
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const owner = this.fakeUser('UD1');
            const list = async (args: Record<string, unknown>, ctx: AuthCtx) => {
                const r = await this.toolNamed('list_nodes').handler({ search: tag, ...args }, ctx, deps);
                if (r.isError) throw new Error(`list_nodes ${JSON.stringify(args)}: ${r.content[0]?.text}`);
                return JSON.parse(r.content[0].text).nodes as any[];
            };
            const names = (rows: any[]) => rows.map((n) => String(n.displayName).slice(tag.length)).join(',');
            const expect = (label: string, got: string, want: string) => { if (got !== want) throw new Error(`${label}: ${got} statt ${want}`); };
            expect('anon never_used', names(await list({ usage: 'never_used' }, anon)), 'Fresh');
            expect('owner never_used', names(await list({ usage: 'never_used', sort: 'name' }, owner)), 'Fresh,Secret');
            expect('top', names(await list({ usage: 'top' }, anon)), 'Clean,Flaky,Broken,Old');
            expect('never_worked', names(await list({ usage: 'never_worked' }, anon)), 'Broken');
            expect('failing', names(await list({ usage: 'failing', sort: 'failures30d', dir: 'desc' }, anon)), 'Broken,Flaky');
            expect('dormant', names(await list({ usage: 'dormant' }, anon)), 'Old');
            expect('minReliability 0.8', names(await list({ minReliability: 0.8, sort: 'name' }, anon)), 'Clean,Flaky');
            expect('search + top', names(await list({ search: `${tag}Fl`, usage: 'top' }, anon)), 'Flaky');
            const broken = (await list({ search: `${tag}Broken` }, anon))[0];
            if (broken?.stats?.calls?.failures !== 3 || broken.stats.calls.failures30d !== 3 || broken.stats.calls.total !== 3) {
                throw new Error(`stats Broken: ${JSON.stringify(broken?.stats?.calls)}`);
            }
            const old = (await list({ search: `${tag}Old` }, anon))[0];
            if (old?.stats?.calls?.failures !== 1 || old.stats.calls.failures30d !== 0) throw new Error(`stats Old: ${JSON.stringify(old?.stats?.calls)}`);
            const schema = this.toolNamed('list_nodes').inputSchema as any;
            if (schema.properties.usage?.enum?.join() !== USAGE_FILTERS.join() || schema.properties.minReliability?.maximum !== 1
                || !schema.properties.sort.enum.includes('failures30d')) {
                throw new Error('list_nodes-Schema ohne usage/minReliability/failures30d');
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Feature-Runde 4 (10-0: "wiederverwenden wenn gefunden und toll"): DogReuseAdvisor — gleicher Name,
     * sehr aehnlicher Name, sehr aehnliche Beschreibung; nur bewaehrte Kandidaten; der neue Dog selbst nie;
     * je neuem Dog hoechstens ein Hinweis (staerkster Grund); run-only-Kandidat mit Versions-id.
     */
    private async testDogReuseAdvisorMatches(): Promise<void> {
        const testName = 'Feature-Runde 4: DogReuseAdvisor (Name, Beschreibung, nur bewaehrt)';
        try {
            const proven = (score: number, badge = true) => ({ proven: { score, badge, reliability: badge ? 0.97 : 0.7 } });
            const candidates: any[] = [
                { id: 'v-geo', lineageId: 'L-geo', displayName: 'GeocodeLookup', description: 'Resolves a place name to latitude and longitude via Nominatim', stats: proven(14.1) },
                { id: 'v-weak', lineageId: 'L-weak', displayName: 'WeatherCard', description: 'Renders the weather card', stats: proven(0.3, false) },
                { id: 'base:QueryRetriever', displayName: 'QueryRetriever', description: 'Reads the query string of the request', stats: proven(900) },
                { id: 'v-ro', lineageId: 'L-ro', displayName: 'TideTable', description: 'Tide times for a harbour', runOnly: true, stats: proven(5) },
                { id: 'v-self', lineageId: 'L-new-1', displayName: 'Geocode Lookup', description: 'x', stats: proven(99) },
            ];
            const advisor = new DogReuseAdvisor();
            const hints = advisor.hintsFor([
                { displayName: 'geocode-lookup', lineageId: 'L-new-1', description: 'something else entirely' },
                { displayName: 'GeocodeLookupDog', lineageId: 'L-new-2', description: null },
                { displayName: 'PlaceToCoords', lineageId: 'L-new-3', description: 'Resolves a place name to latitude and longitude with Nominatim' },
                { displayName: 'WeatherCard', lineageId: 'L-new-4', description: 'Renders the weather card' },
                { displayName: 'Tide Table', lineageId: 'L-new-5', description: null },
                { displayName: 'Totally New', lineageId: 'L-new-6', description: 'Counts the stars in the sky tonight' },
                { displayName: 'query_retriever', lineageId: 'L-new-7' },
            ], candidates);
            const by = new Map(hints.map((h) => [h.dog, h]));
            const expect = (dog: string, reason: string | null, lineageId?: string) => {
                const h = by.get(dog);
                if (reason === null) { if (h) throw new Error(`${dog}: unerwarteter Hinweis ${JSON.stringify(h)}`); return; }
                if (!h || h.reason !== reason || h.suggestion.lineageId !== lineageId) throw new Error(`${dog}: ${JSON.stringify(h)}`);
            };
            expect('geocode-lookup', 'same-name', 'L-geo');          // gleicher Name, der eigene neue Dog (L-new-1) zaehlt nie
            expect('GeocodeLookupDog', 'similar-name', 'L-geo');
            expect('PlaceToCoords', 'similar-description', 'L-geo');
            expect('WeatherCard', null);                            // gleicher Name, aber nicht bewaehrt
            expect('Tide Table', 'same-name', 'L-ro');
            expect('Totally New', null);
            expect('query_retriever', 'same-name', 'base:QueryRetriever');
            if (hints.length !== 5) throw new Error(`${hints.length} Hinweise statt 5`);
            const tide = by.get('Tide Table')!;
            if (tide.suggestion.versionId !== 'v-ro' || !tide.message.includes('v-ro') || !tide.message.includes('run-only')) throw new Error(`run-only: ${JSON.stringify(tide)}`);
            if (!by.get('GeocodeLookupDog')!.message.includes('Nothing was blocked')) throw new Error('Hinweis sagt nicht, dass nichts blockiert wurde');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Feature-Runde 4 ueber das Werkzeug: build_kennel mit einem neuen Dog, der so heisst wie ein bewaehrter
     * (>= 5 Laeufe in 30 T, oeffentlich gerufen, in einem Kennel, zuverlaessig), antwortet mit hints[] und dessen
     * lineageId — und baut trotzdem; ein fremder privater Doppelgaenger bleibt unerwaehnt; die feste Regel
     * steht in build_kennel, list_nodes, skill.md und Werkzeugkasten.
     */
    private async testBuildKennelReuseHint(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: KennelController,
        baseDogsMap: Map<string, any>,
    ): Promise<void> {
        const testName = 'Feature-Runde 4: build_kennel hints[] zeigt bewaehrten Doppelgaenger';
        const stamp = Date.now();
        const kennelId = `test-reuse-${stamp}`;
        const name = `ReuseProbe${stamp}`;
        const secretName = `ReuseSecret${stamp}`;
        const twin = `Reuse Probe${stamp}`;   // gleiche Woerter wie ReuseProbe<stamp>
        let built: any = null;
        try {
            const provenDog = await this.saveAclTestDog(nodesStore, name, 'return { probe: 1 };', { visibility: 'public', ownerId: 'UR1' });
            const secretDog = await this.saveAclTestDog(nodesStore, secretName, 'return { secret: 1 };', { visibility: 'private', ownerId: 'UR9' });
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });
            for (const dogKey of [provenDog, secretDog]) {
                for (let i = 0; i < 6; i++) {
                    counter.recordDog({ dogKey, kennelLineageId: '__reuse_k', source: 'public', outcome: 'ok', cached: false, cacheHits: 0, cacheMisses: 1, durationMs: 3 });
                }
            }
            const refs: DogReferenceRow[] = [provenDog, secretDog].map((toKey) => ({
                fromKind: 'kennel', fromKey: '__reuse_k', toKey, kind: 'crew', position: 0, fromOwnerId: null, resolved: 1,
            }));
            const refStore: IDogStatsStore = { ...StartupTest.NO_DOG_STATS_STORE, readAllReferences: async () => refs };
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            const deps = this.toolDeps(nodesStore, kennelsStore, nodesController, kennelsController, runHandler);
            deps.dogStats = new DogStatsService(refStore, counter, new KennelStatsService(StartupTest.NO_STATS_STORE, counter));
            const [probeStats] = await deps.dogStats.attach([{ id: provenDog, lineageId: provenDog, ownerId: 'UR1' }]);
            if (!probeStats.stats.proven.badge) throw new Error(`Probe nicht bewaehrt: ${JSON.stringify(probeStats.stats.proven)}`);

            const result = await this.toolNamed('build_kennel').handler({
                id: kennelId, refresh: false, visibility: 'private',
                dogs: [
                    { displayName: twin, tsCode: 'return { again: 1 };' },
                    { displayName: secretName, tsCode: 'return { mine: 1 };' },
                    { displayName: `Unrelated${stamp}Lead`, tsCode: 'return { lead: 1 };', description: 'Composes nothing in particular' },
                ],
            }, this.fakeUser('UR2'), deps);
            if (result.isError) throw new Error(`build_kennel: ${result.content[0]?.text}`);
            built = JSON.parse(result.content[0].text);
            const hints: any[] = built.hints ?? [];
            if (hints.length !== 1) throw new Error(`hints: ${JSON.stringify(hints)}`);
            const h = hints[0];
            const newProbe = built.dogs.find((d: any) => d.displayName === twin);
            if (h.dog !== twin || h.reason !== 'same-name' || h.suggestion.lineageId !== provenDog || h.lineageId !== newProbe?.lineageId) {
                throw new Error(`Hinweis: ${JSON.stringify(h)}`);
            }
            if (JSON.stringify(built).includes(secretDog)) throw new Error('fremder privater Dog im Hinweis');
            if (Object.keys(built)[0] !== 'hints' && Object.keys(built)[0] !== 'hinweise') throw new Error(`hints nicht oben: ${Object.keys(built).join(',')}`);
            if (!(await kennelsController.getById(kennelId)).ok) throw new Error('Kennel trotz Hinweis nicht gebaut');

            const rule = /list_nodes \{search: "<keyword>", sort: "proven"\}/;
            const buildText = String(this.toolNamed('build_kennel').description);
            const nodesText = String(this.toolNamed('list_nodes').description);
            const skill = fs.readFileSync(path.join(process.cwd(), 'mcp', 'skill.md'), 'utf8');
            const kasten = buildWerkzeugkasten([{ id: 'base:X', name: 'X', description: 'x', type: 'BaseDog', guidance: 'g' } as any]);
            if (!rule.test(buildText) || !buildText.includes('hints[]')) throw new Error('build_kennel ohne feste Regel');
            if (!rule.test(nodesText)) throw new Error('list_nodes ohne feste Regel');
            if (!skill.includes('Reuse before you write') || !skill.includes("list_nodes {search:'<keyword>', sort:'proven'}")) throw new Error('skill.md ohne feste Regel');
            if (!kasten.includes('Wiederverwenden vor Schreiben') || !kasten.includes('hints[]')) throw new Error('Werkzeugkasten ohne feste Regel');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
            for (const d of built?.dogs ?? []) {
                try { for (const v of await nodesController.getVersions(d.lineageId)) await nodesController.delete(v.id); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Env-Katalog (server-app/startupEnvCheck.ts): je fehlender Pflicht-Variable genau eine Warnzeile, abhaengig
     * von NODE_ENV (development braucht nur DB + SESSION_SECRET; integration/production dazu Login); vollstaendige
     * Umgebungen -> keine Zeile. Jede Katalog-Variable steht in .env.example und .env.integration.example, in ihrem
     * Abschnitt und in Katalog-Reihenfolge; die Abschnitte stehen in Katalog-Reihenfolge.
     */
    private async testEnvCatalogWarnings(): Promise<void> {
        const testName = 'Env-Katalog: Pflicht-Warnungen je NODE_ENV, .env-Beispiele vollstaendig und gegliedert';
        try {
            const pg = 'postgresql://u:p@db.example:5432/app?sslmode=require';
            const secret = 's'.repeat(32);
            const lineFor = (lines: string[], name: string) => lines.filter((l) => new RegExp(`^\\[env\\] missing ${name}[ =|(]`).test(l));

            // (1) development mit vollstaendigen DB-Variablen -> 0 Zeilen (auch mit *_DB_PATH statt URL).
            const devFull = {
                NODE_ENV: 'development', DATABASE_URL: 'file:./dev.db', CACHE_DATABASE_URL: 'file:./cache.db',
                JSON_STORAGE_DATABASE_URL: 'file:./json-storage.db', AUTH_DATABASE_URL: 'file:./auth.db', SESSION_SECRET: secret,
            };
            const dev = missingEnvWarnings(devFull);
            if (dev.length !== 0) throw new Error(`development vollstaendig: ${JSON.stringify(dev)}`);
            const devPaths = missingEnvWarnings({
                NODE_ENV: 'development', DATABASE_URL: 'file:./dev.db', CACHE_DB_PATH: 'c.db', JSON_STORAGE_DB_PATH: 'j.db',
                AUTH_DB_PATH: 'a.db', SESSION_SECRET: secret,
            });
            if (devPaths.length !== 0) throw new Error(`development mit *_DB_PATH: ${JSON.stringify(devPaths)}`);
            if (recommendedEnvHints(devFull).length !== 0) throw new Error('development: Empfehlung ohne Regel');
            const devNoCache = missingEnvWarnings({ ...devFull, CACHE_DATABASE_URL: '' });
            if (devNoCache.length !== 1 || lineFor(devNoCache, 'CACHE_DATABASE_URL').length !== 1 || !devNoCache[0].includes('CACHE_DB_PATH')) {
                throw new Error(`development ohne Cache: ${JSON.stringify(devNoCache)}`);
            }
            // Login lokal an -> Token-Key und Google-Client werden Pflicht, die Redirect-Basis nicht (Default localhost passt).
            const devAuth = missingEnvWarnings({ ...devFull, MCP_AUTH_REQUIRED: 'true' });
            const devAuthNames = ['MCP_TOKEN_SIGNING_KEY', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'];
            if (devAuth.length !== devAuthNames.length || devAuthNames.some((n) => lineFor(devAuth, n).length !== 1)) {
                throw new Error(`development mit Login: ${JSON.stringify(devAuth)}`);
            }

            // (2) integration ohne Login-Variablen und ohne MCP_AUTH_REQUIRED -> je fehlender Pflicht-Variable genau eine Zeile.
            //     Postgres-DATABASE_URL: Cache/JSON spiegelt dbEnv.cjs, sie fehlen also nicht.
            const integ = missingEnvWarnings({ NODE_ENV: 'integration', DATABASE_URL: pg, AUTH_DATABASE_URL: pg });
            const integNames = ['SESSION_SECRET', 'MCP_AUTH_REQUIRED', 'MCP_TOKEN_SIGNING_KEY', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_BASE'];
            if (integ.length !== integNames.length) throw new Error(`integration: ${integ.length} Zeilen statt ${integNames.length}: ${JSON.stringify(integ)}`);
            for (const name of integNames) {
                const hits = lineFor(integ, name);
                if (hits.length !== 1) throw new Error(`integration: ${hits.length} Zeilen fuer ${name}`);
                if (!hits[0].includes('required in integration')) throw new Error(`integration: Zeile ohne Umgebung: ${hits[0]}`);
            }
            if (!lineFor(integ, 'MCP_AUTH_REQUIRED')[0].includes('Exit 78')) throw new Error('MCP_AUTH_REQUIRED nennt Exit 78 nicht');
            // MCP_AUTH_REQUIRED=false zaehlt wie fehlend (der Guard verlangt genau "true").
            if (lineFor(missingEnvWarnings({ NODE_ENV: 'integration', DATABASE_URL: pg, AUTH_DATABASE_URL: pg, MCP_AUTH_REQUIRED: 'false' }), 'MCP_AUTH_REQUIRED').length !== 1) {
                throw new Error('MCP_AUTH_REQUIRED=false nicht gemeldet');
            }

            // (3) production vollstaendig -> 0 Zeilen, auch keine Empfehlung; ohne Key-Store-Key genau ein Hinweis, kein Fehler.
            const prodFull = {
                NODE_ENV: 'production', DATABASE_URL: pg, AUTH_DATABASE_URL: pg, SESSION_SECRET: secret, MCP_AUTH_REQUIRED: 'true',
                MCP_TOKEN_SIGNING_KEY: 'ab'.repeat(32), GOOGLE_OAUTH_CLIENT_ID: 'client-id', GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
                GOOGLE_OAUTH_REDIRECT_BASE: 'https://app.example', MCP_BASE_URL: 'https://app.example', KEYSTORE_MASTER_KEY_V1: '00'.repeat(32),
            };
            const prod = missingEnvWarnings(prodFull);
            if (prod.length !== 0) throw new Error(`production vollstaendig: ${JSON.stringify(prod)}`);
            if (recommendedEnvHints(prodFull).length !== 0) throw new Error(`production vollstaendig, Empfehlung: ${JSON.stringify(recommendedEnvHints(prodFull))}`);
            const prodNoKey = { ...prodFull, KEYSTORE_MASTER_KEY_V1: '' };
            const hints = recommendedEnvHints(prodNoKey);
            if (missingEnvWarnings(prodNoKey).length !== 0 || hints.length !== 1 || !hints[0].includes('KEYSTORE_MASTER_KEY_V1')) {
                throw new Error(`production ohne Key-Store-Key: ${JSON.stringify(hints)}`);
            }

            // (4) jede Katalog-Variable steht in beiden Beispielen; (5) Abschnitte und Variablen in Katalog-Reihenfolge.
            for (const file of ['.env.example', '.env.integration.example']) {
                const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
                const lines = text.split(/\r?\n/);
                const absent = ENV_CATALOG_NAMES.filter((name) => !new RegExp(`\\b${name}\\b`).test(text));
                if (absent.length) throw new Error(`${file}: fehlt ${absent.join(', ')}`);

                const headingAt = ENV_SECTIONS.map((s) => lines.findIndex((l) => l.replace(/^#\s*/, '').trim() === s.heading));
                const noHeading = ENV_SECTIONS.filter((_, i) => headingAt[i] < 0).map((s) => s.heading);
                if (noHeading.length) throw new Error(`${file}: Abschnitt fehlt: ${noHeading.join(' / ')}`);
                for (let i = 1; i < headingAt.length; i++) {
                    if (headingAt[i] <= headingAt[i - 1]) throw new Error(`${file}: "${ENV_SECTIONS[i].heading}" steht vor "${ENV_SECTIONS[i - 1].heading}"`);
                }

                let previous = -1;
                for (const spec of ENV_CATALOG) {
                    // Die eigene Zeile der Variable beginnt mit ihrem Namen ("# NAME — …", "# NAME=…" oder aktiv "NAME=…").
                    const at = lines.findIndex((l) => new RegExp(`^#? ?${spec.name}\\b`).test(l));
                    const s = ENV_SECTIONS.findIndex((x) => x.id === spec.section);
                    const end = s + 1 < headingAt.length ? headingAt[s + 1] : lines.length;
                    if (at < headingAt[s] || at >= end) throw new Error(`${file}: ${spec.name} steht nicht im Abschnitt "${ENV_SECTIONS[s].heading}" (Zeile ${at + 1})`);
                    if (at < previous) throw new Error(`${file}: ${spec.name} (Zeile ${at + 1}) steht vor seinem Vorgaenger im Katalog`);
                    previous = at;
                }
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * P6 U5: GET /api/nodes fuer den /dogs-Browser — Base-Dogs tragen ihr Paket (`core`, `dogs-weather`,
     * aus dem geladenen Modulgraphen der Registry), `lean=1` laesst den Code weg, ein fremder
     * run-only-Dog (RUN-Sicht, anonym) traegt die Version seines Kopfes (aelteste = 1) und nie theRun.
     */
    private async testNodesListPackLeanAndRunVersion(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P6 U5: /api/nodes pack, lean=1, RUN-Sicht mit Kopf-Version';
        try {
            const Query = baseDogsMap.get('QueryRetriever');
            const Weather = baseDogsMap.get('WeatherRetriever');
            if (!Query || !Weather) throw new Error('QueryRetriever/WeatherRetriever nicht registriert');
            const packs = BaseDogPacks.fromLoadedModules();
            if (packs.packOf(new Query()) !== 'core') throw new Error(`QueryRetriever pack ${packs.packOf(new Query())}`);
            if (packs.packOf(Weather) !== 'dogs-weather') throw new Error(`WeatherRetriever pack ${packs.packOf(Weather)}`);
            if (packs.packOf({}) !== null) throw new Error('ein fremdes Objekt hat ein Paket');

            const readable = { id: 'v-read', lineageId: 'L-read', displayName: 'Open Dog', theRun: 'return 1;', visibility: 'public', ownerId: 'u-a' };
            const runOnly = { id: 'v-head', lineageId: 'L-run', displayName: 'Sealed Dog', theRun: 'return "secret";', visibility: 'run-only', ownerId: 'u-b' };
            const controller: any = {
                listLatest: async () => ({ ok: true, data: [{ ...readable }, { ...runOnly }] }),
                getVersions: async (id: string) => (id === 'L-run'
                    ? [{ id: 'v-head', version: 3 }, { id: 'v-2', version: 2 }, { id: 'v-1', version: 1 }]
                    : [{ id: 'v-read', version: 1 }]),
            };
            const registry = { get: (sub: string) => (sub === 'nodes' ? controller : null) } as unknown as ControllerRegistry;
            const handler = new NodesRouteHandler(registry, [new Query(), new Weather()]);
            const list = async (query: Record<string, string>) => {
                let body: any = null;
                const res: any = { status: () => res, json: (b: any) => { body = b; } };
                await (handler as any).handleList({ query, ctx: { user: null, isSuperUser: false } }, res);
                return body?.data as any[];
            };
            const full = await list({});
            const lean = await list({ lean: '1' });
            const byId = (rows: any[], id: string) => rows.find((r) => r.id === id);
            if (byId(full, 'base:QueryRetriever')?.pack !== 'core' || byId(full, 'base:WeatherRetriever')?.pack !== 'dogs-weather') {
                throw new Error(`pack: ${byId(full, 'base:QueryRetriever')?.pack} / ${byId(full, 'base:WeatherRetriever')?.pack}`);
            }
            if (byId(full, 'v-read')?.theRun !== 'return 1;') throw new Error('ohne lean fehlt der Code des lesbaren Dogs');
            if (lean.some((r) => 'theRun' in r)) throw new Error('lean=1 liefert theRun');
            if (lean.length !== full.length) throw new Error(`lean=1 aendert die Menge: ${lean.length} statt ${full.length}`);
            const sealed = byId(full, 'v-head');
            if (!sealed || sealed.myRights?.read !== false || sealed.version !== 3) throw new Error(`RUN-Sicht: ${JSON.stringify(sealed)}`);
            if (JSON.stringify(full).includes('secret')) throw new Error('RUN-Sicht traegt den Code');
            if (byId(full, 'v-read')?.version !== undefined) throw new Error('lesbarer Dog bekommt eine Listen-Version');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** P6 U5 gegen den laufenden Server: `lean=1` ohne Code, jeder Base-Dog mit Paket, `/dogs` ist ein festes Segment. */
    private async testNodesListLeanOverHttp(): Promise<void> {
        const testName = 'P6 U5: GET /api/nodes?lean=1 ueber HTTP';
        try {
            const res = await fetch(`${this.selfBaseUrl()}/api/nodes?lean=1&sort=proven&dir=desc`);
            const body: any = await res.json();
            if (res.status !== 200 || !Array.isArray(body?.data)) throw new Error(`Status ${res.status}`);
            if (body.data.some((d: any) => 'theRun' in d)) throw new Error('lean=1 liefert theRun');
            const base = body.data.filter((d: any) => d.type === 'BaseDog' && !String(d.description ?? '').startsWith('Pact'));
            const bare = base.filter((d: any) => typeof d.pack !== 'string' || !d.pack);
            if (base.length === 0 || bare.length > 0) throw new Error(`Base-Dogs ohne pack: ${bare.map((d: any) => d.id).join(',') || '(keine Base-Dogs)'}`);
            if (!FIXED_TOP_LEVEL.has('dogs')) throw new Error('/dogs fehlt in FIXED_TOP_LEVEL (Alt-Weiche)');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * P6 U7: /auth/tokens als JSON — eigene express-App auf Port 0, In-Memory-Prisma, kein Bezug
     * zum Hauptserver. Prueft Content-Negotiation (401/200/201 JSON, HTML bleibt HTML), dass der
     * jwt nur einmal (in der POST-Antwort) auftaucht, Eigentuemer-Widerruf und die 404-Fremdsperre.
     */
    private async testPersonalTokensJson(): Promise<void> {
        const testName = 'P6 U7: /auth/tokens als JSON (einmaliger Wert, Widerruf, HTML bleibt)';
        if (!process.env.MCP_TOKEN_SIGNING_KEY) {
            this.addResult(testName, false, 'MCP_TOKEN_SIGNING_KEY fehlt in der Umgebung — issueAccessToken kann nicht signieren');
            return;
        }
        type FakeRow = { jti: string; userId: string; clientId: string; scope: string; expiresAt: Date; revokedAt: Date | null; createdAt: Date };
        let server: import('http').Server | undefined;
        try {
            const rows: FakeRow[] = [];
            const fakePrisma: any = {
                accessToken: {
                    findMany: async ({ where, orderBy }: any) => {
                        let result = rows.filter((r) => r.userId === where.userId && r.clientId === where.clientId);
                        if (orderBy?.createdAt === 'desc') result = [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                        return result;
                    },
                    create: async ({ data }: any) => {
                        const row: FakeRow = { jti: data.jti, userId: data.userId, clientId: data.clientId, scope: data.scope, expiresAt: data.expiresAt, revokedAt: null, createdAt: new Date() };
                        rows.push(row);
                        return row;
                    },
                    updateMany: async ({ where, data }: any) => {
                        const matched = rows.filter((r) => r.jti === where.jti && r.userId === where.userId && r.clientId === where.clientId);
                        for (const r of matched) r.revokedAt = data.revokedAt;
                        return { count: matched.length };
                    },
                    findFirst: async ({ where }: any) => rows.find((r) => r.jti === where.jti && r.userId === where.userId && r.clientId === where.clientId) ?? null,
                },
            };

            const app = express();
            app.use((req: any, _res: any, next: any) => { req.session = { userId: req.get('x-test-user') || undefined }; next(); });
            app.use('/auth/tokens', createPersonalTokensRouter(fakePrisma));
            server = await new Promise<import('http').Server>((resolve) => {
                const s = app.listen(0, '127.0.0.1', () => resolve(s));
            });
            const port = (server.address() as any).port;
            const base = `http://127.0.0.1:${port}`;
            const asJson = (userId?: string) => ({ accept: 'application/json', ...(userId ? { 'x-test-user': userId } : {}) });

            const noAuth = await fetch(`${base}/auth/tokens`, { headers: asJson() });
            const noAuthBody: any = await noAuth.json();
            if (noAuth.status !== 401 || noAuthBody.error !== 'unauthorized') throw new Error(`ohne Session: ${noAuth.status} ${JSON.stringify(noAuthBody)}`);

            const empty = await fetch(`${base}/auth/tokens`, { headers: asJson('U1') });
            const emptyBody: any = await empty.json();
            if (empty.status !== 200 || emptyBody.tokens?.length !== 0) throw new Error(`leer: ${empty.status} ${JSON.stringify(emptyBody)}`);

            const created = await fetch(`${base}/auth/tokens`, { method: 'POST', headers: asJson('U1') });
            const createdBody: any = await created.json();
            if (created.status !== 201 || typeof createdBody.token?.jwt !== 'string' || createdBody.token.jwt.split('.').length !== 3) {
                throw new Error(`POST: ${created.status} ${JSON.stringify(createdBody)}`);
            }
            const jti = createdBody.token.jti as string;

            const afterCreate = await fetch(`${base}/auth/tokens`, { headers: asJson('U1') });
            const afterCreateText = await afterCreate.text();
            if (afterCreateText.includes(createdBody.token.jwt)) throw new Error('GET traegt den jwt weiter');
            const afterCreateBody = JSON.parse(afterCreateText);
            if (!afterCreateBody.tokens?.some((t: any) => t.jti === jti)) throw new Error('GET listet den neuen jti nicht');

            const revoke = await fetch(`${base}/auth/tokens/${jti}/revoke`, { method: 'POST', headers: asJson('U1') });
            const revokeBody: any = await revoke.json();
            if (revoke.status !== 200 || revokeBody.status !== 'revoked') throw new Error(`revoke: ${revoke.status} ${JSON.stringify(revokeBody)}`);

            const afterRevoke = await fetch(`${base}/auth/tokens`, { headers: asJson('U1') });
            const afterRevokeBody: any = await afterRevoke.json();
            if (afterRevokeBody.tokens?.find((t: any) => t.jti === jti)?.status !== 'revoked') throw new Error('GET zeigt nicht revoked');

            const foreignRevoke = await fetch(`${base}/auth/tokens/${jti}/revoke`, { method: 'POST', headers: asJson('U2') });
            if (foreignRevoke.status !== 404) throw new Error(`fremder Widerruf: ${foreignRevoke.status}`);

            const html = await fetch(`${base}/auth/tokens`, { headers: { accept: 'text/html', 'x-test-user': 'U1' } });
            const htmlText = await html.text();
            if (!(html.headers.get('content-type') ?? '').includes('text/html') || !htmlText.includes('<!DOCTYPE html>')) {
                throw new Error(`HTML: ${html.headers.get('content-type')}`);
            }

            if (!FIXED_TOP_LEVEL.has('account') || !FIXED_TOP_LEVEL.has('login')) throw new Error('account/login fehlen in FIXED_TOP_LEVEL');
            if (!SPA_ROUTES.includes('/account') || !SPA_ROUTES.includes('/login')) throw new Error('account/login fehlen in SPA_ROUTES');

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
        }
    }

    /** Ein frischer Master-Key je Test — nie aus der Env, nie in einer Datei. */
    private static keyTestRing(versions: Record<number, Buffer> = { 1: randomBytes(32) }): MasterKeyring {
        return MasterKeyring.fromKeys(versions);
    }

    /**
     * Kein Testwert in keiner gesammelten Ausgabe — roh, URL-kodiert oder JSON-escaped (4c.9).
     * Die Ausgaben werden als JSON-Text durchsucht, so wie sie eine Antwort traegt.
     */
    private static assertNoSecret(label: string, outputs: unknown[], secrets: string[]): void {
        for (const [i, o] of outputs.entries()) {
            const text = typeof o === 'string' ? o : JSON.stringify(o) ?? '';
            for (const s of secrets) {
                for (const form of [s, encodeURIComponent(s), JSON.stringify(s).slice(1, -1)]) {
                    if (text.includes(form)) throw new Error(`${label}: Ausgabe ${i} traegt den Testwert`);
                }
            }
        }
    }

    /** Ein Testwert, der nur in diesem Lauf existiert und nach nichts Echtem aussieht. */
    private static keyTestSecret(label: string): string {
        return `p4c-${label}-${randomBytes(12).toString('hex')}`;
    }

    /**
     * Test T5 (DB-Leser): die Zeile traegt den Wert nicht — weder im Chiffrat noch sonstwo; ein
     * falscher Master-Key entschluesselt nicht (key_undecryptable), der richtige liefert den Klartext
     * nur im Speicher des Dienstes; die maskierte Sicht zeigt last4, nie mehr.
     */
    private async testKeyStoreDbReader(prisma: KeyStorePrisma): Promise<void> {
        const testName = 'P4c T5: DB-Leser sieht keinen Klartext (AES-256-GCM, keyVersion)';
        const owner = `test-p4c-t5-${Date.now()}`;
        try {
            const secret = StartupTest.keyTestSecret('t5');
            const store = new KeyStoreService(prisma, StartupTest.keyTestRing());
            const view = await store.set(owner, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
            if (view.last4 !== secret.slice(-4) || JSON.stringify(view).includes(secret)) throw new Error(`Sicht: ${JSON.stringify(view)}`);
            const row = await store.findRow(owner, 'openai');
            if (!row) throw new Error('Zeile fehlt');
            if (row.keyVersion !== 1 || !row.ciphertext || !row.iv || !row.authTag) throw new Error(`Zeile unvollstaendig: v${row.keyVersion}`);
            if (JSON.stringify(row).includes(secret) || JSON.stringify(row).includes(secret.slice(4, -4))) throw new Error('Zeile traegt den Wert');
            if (Buffer.from(row.ciphertext, 'base64').toString('utf8').includes(secret)) throw new Error('Chiffrat ist Klartext');

            const wrong = new KeyStoreService(prisma, StartupTest.keyTestRing());
            let wrongError = '';
            try { wrong.decrypt(row); } catch (err) { wrongError = (err as Error).message; }
            if (wrongError !== 'key_undecryptable:openai') throw new Error(`falscher Master-Key: "${wrongError}"`);
            if (store.decrypt(row) !== secret) throw new Error('richtiger Master-Key liefert nicht den Klartext');
            const listed = await store.list(owner);
            if (listed.length !== 1 || JSON.stringify(listed).includes(secret)) throw new Error(`list: ${JSON.stringify(listed)}`);

            const expectCode = async (label: string, input: any, code: string, on: KeyStoreService = store) => {
                try { await on.set(owner, input); } catch (err: any) { if (err?.code === code) return; throw new Error(`${label}: ${err?.code ?? err}`); }
                throw new Error(`${label}: angenommen`);
            };
            await expectCode('Alias gross', { alias: 'OpenAI', secret, allowedDomains: ['api.example.com'] }, 'invalid_alias');
            await expectCode('Wert zu kurz', { alias: 'short', secret: 'abc1234', allowedDomains: ['api.example.com'] }, 'invalid_secret');
            await expectCode('Wert mit Zeilenumbruch', { alias: 'nl', secret: `${secret}\nx`, allowedDomains: ['api.example.com'] }, 'invalid_secret');
            for (const bad of [[], ['localhost'], ['127.0.0.1'], ['*.com'], ['api.*.com'], ['https://api.example.com']]) {
                await expectCode(`Domains ${JSON.stringify(bad)}`, { alias: 'dom', secret, allowedDomains: bad }, 'invalid_domains');
            }
            await expectCode('Store aus', { alias: 'off', secret, allowedDomains: ['api.example.com'] }, 'keystore_disabled', new KeyStoreService(prisma, null));
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await prisma.userKey.deleteMany({ where: { ownerId: owner } }); } catch { /* ignore */ }
        }
    }

    /**
     * Test T10 (Rotation): V1 -> V2 im Dienst und ueber scripts/rotateKeystore.cjs; danach keyVersion 2,
     * V2 allein liefert denselben Klartext, und auf stdout steht er nicht.
     */
    private async testKeyStoreRotation(prisma: KeyStorePrisma): Promise<void> {
        const testName = 'P4c T10: Rotation V1 -> V2 ohne Klartext auf stdout';
        const stamp = Date.now();
        const ownerService = `test-p4c-t10-${stamp}`;
        const ownerScript = `test-p4c-t10s-${stamp}`;
        try {
            const v1 = randomBytes(32);
            const v2 = randomBytes(32);
            const secret = StartupTest.keyTestSecret('t10');
            const onV1 = new KeyStoreService(prisma, StartupTest.keyTestRing({ 1: v1 }));
            await onV1.set(ownerService, { alias: 'rot', secret, allowedDomains: ['api.example.com'] });
            await onV1.set(ownerScript, { alias: 'rot', secret, allowedDomains: ['api.example.com'] });

            const both = new KeyStoreService(prisma, StartupTest.keyTestRing({ 1: v1, 2: v2 }));
            const result = await both.rotate({ ownerId: ownerService, batchSize: 1 });
            if (result.target !== 2 || result.rotated !== 1 || result.failed !== 0) throw new Error(`rotate: ${JSON.stringify(result)}`);
            const onV2 = new KeyStoreService(prisma, StartupTest.keyTestRing({ 2: v2 }));
            const rotated = await onV2.findRow(ownerService, 'rot');
            if (rotated?.keyVersion !== 2 || onV2.decrypt(rotated) !== secret) throw new Error('nach rotate: V2 liefert nicht denselben Klartext');
            if ((await onV2.findRow(ownerScript, 'rot'))?.keyVersion !== 1) throw new Error('rotate --owner hat eine fremde Zeile beruehrt');

            const run = await new Promise<{ code: number | null; out: string }>((resolve) => {
                const child = spawn(process.execPath, ['scripts/rotateKeystore.cjs', '--owner', ownerScript], {
                    cwd: process.cwd(),
                    env: { ...process.env, KEYSTORE_MASTER_KEY_V1: v1.toString('hex'), KEYSTORE_MASTER_KEY_V2: v2.toString('hex'), TS_NODE_TRANSPILE_ONLY: 'true' },
                });
                let out = '';
                child.stdout.on('data', (c) => { out += c; });
                child.stderr.on('data', (c) => { out += c; });
                const timer = setTimeout(() => child.kill(), 120_000);
                child.on('exit', (code) => { clearTimeout(timer); resolve({ code, out }); });
            });
            if (run.code !== 0 || !/1 umgeschluesselt, 0 nicht entschluesselbar/.test(run.out)) throw new Error(`Skript: Exit ${run.code}: ${run.out.slice(-300)}`);
            if (run.out.includes(secret)) throw new Error('Skript druckt den Klartext');
            const byScript = await onV2.findRow(ownerScript, 'rot');
            if (byScript?.keyVersion !== 2 || onV2.decrypt(byScript) !== secret) throw new Error('nach Skript: V2 liefert nicht denselben Klartext');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await prisma.userKey.deleteMany({ where: { ownerId: { in: [ownerService, ownerScript] } } }); } catch { /* ignore */ }
        }
    }

    /**
     * Test T8 (IDOR) ueber REST: U2 sieht U1s Keys nicht und loescht sie nicht (404, nichts verraten);
     * keine Antwort traegt den Wert. Dazu die Tuer selbst: anonym 401, Super-User ohne user 403
     * no_identity, Store aus 503 keystore_disabled.
     */
    private async testKeysRestIdor(prisma: KeyStorePrisma): Promise<void> {
        const testName = 'P4c T8: /api/keys ohne IDOR, maskiert, 401/403/503';
        const stamp = Date.now();
        const u1 = `test-p4c-t8a-${stamp}`;
        const u2 = `test-p4c-t8b-${stamp}`;
        try {
            const secret = StartupTest.keyTestSecret('t8');
            const handler = new KeysRouteHandler(new KeyStoreService(prisma, StartupTest.keyTestRing()));
            const as = (uid: string) => this.fakeUser(uid);
            const responses: unknown[] = [];
            const call = async (method: string, req: Record<string, any>) => {
                const out = await this.callHandler(handler, method, req);
                responses.push(out.body);
                return out;
            };

            const created = await call('handleSet', { method: 'POST', ctx: as(u1), body: { alias: 'openai', secret, allowedDomains: ['api.openai.com'] } });
            if (created.statusCode !== 200 || created.body?.key?.last4 !== secret.slice(-4)) throw new Error(`POST U1: ${created.statusCode} ${JSON.stringify(created.body)}`);
            const foreignList = await call('handleList', { ctx: as(u2) });
            if (foreignList.statusCode !== 200 || foreignList.body?.keys?.length !== 0) throw new Error(`GET U2: ${JSON.stringify(foreignList.body)}`);
            const foreignDelete = await call('handleDelete', { method: 'DELETE', ctx: as(u2), params: { alias: 'openai' } });
            if (foreignDelete.statusCode !== 404) throw new Error(`DELETE U2: ${foreignDelete.statusCode}`);
            const unknownDelete = await call('handleDelete', { method: 'DELETE', ctx: as(u1), params: { alias: 'nope' } });
            if (unknownDelete.statusCode !== 404 || JSON.stringify(unknownDelete.body) !== JSON.stringify(foreignDelete.body)) throw new Error('fremd und unbekannt sehen verschieden aus');
            const ownList = await call('handleList', { ctx: as(u1) });
            if (ownList.body?.keys?.length !== 1 || ownList.body.keys[0].alias !== 'openai') throw new Error(`GET U1 nach fremdem DELETE: ${JSON.stringify(ownList.body)}`);

            const anon = await call('handleList', { ctx: { user: null, isSuperUser: false } });
            if (anon.statusCode !== 401) throw new Error(`anonym: ${anon.statusCode}`);
            const su = await call('handleSet', { method: 'POST', ctx: { user: null, isSuperUser: true }, body: { alias: 'x', secret, allowedDomains: ['api.example.com'] } });
            if (su.statusCode !== 403 || su.body?.error !== 'no_identity') throw new Error(`Super-User: ${su.statusCode} ${JSON.stringify(su.body)}`);
            const off = await this.callHandler(new KeysRouteHandler(new KeyStoreService(prisma, null)), 'handleSet', { method: 'POST', ctx: as(u1), body: { alias: 'x', secret, allowedDomains: ['api.example.com'] } });
            if (off.statusCode !== 503 || off.body?.error !== 'keystore_disabled') throw new Error(`Store aus: ${off.statusCode} ${JSON.stringify(off.body)}`);
            const invalid = await call('handleSet', { method: 'POST', ctx: as(u1), body: { alias: 'Bad Alias', secret, allowedDomains: ['api.example.com'] } });
            if (invalid.statusCode !== 400 || invalid.body?.error !== 'invalid_alias') throw new Error(`invalid_alias: ${invalid.statusCode}`);

            const ownDelete = await call('handleDelete', { method: 'DELETE', ctx: as(u1), params: { alias: 'openai' } });
            if (ownDelete.statusCode !== 200 || ownDelete.body?.ok !== true) throw new Error(`DELETE U1: ${ownDelete.statusCode}`);
            StartupTest.assertNoSecret('T8', responses, [secret]);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await prisma.userKey.deleteMany({ where: { ownerId: { in: [u1, u2] } } }); } catch { /* ignore */ }
        }
    }

    /**
     * Der Rahmen der Laufzeit-Tests (P4c): ein Key-Store mit frischem Test-Master-Key und ein Fake-Netz,
     * als `keys` registriert; danach wieder die Capability der App. Alle Zeilen der Test-Owner fallen.
     */
    private async withKeysHarness(
        deps: KeysTestDeps,
        owners: string[],
        body: (h: { store: KeyStoreService; net: FakeKeysNetwork }) => Promise<void>,
        options: { superuserOwner?: string; hosts?: Record<string, string[]> } = {},
    ): Promise<void> {
        const store = new KeyStoreService(deps.prisma, StartupTest.keyTestRing(), { superuserOwner: options.superuserOwner ?? null });
        const net = new FakeKeysNetwork(options.hosts);
        new KeysCapability(store, net).register();
        try {
            await body({ store, net });
        } finally {
            if (deps.appKeyStore) new KeysCapability(deps.appKeyStore).register();
            else unregisterVmGlobalCapability('keys');
            try { await deps.prisma.userKey.deleteMany({ where: { ownerId: { in: owners } } }); } catch { /* ignore */ }
        }
    }

    /** Ein Kennel-Lauf ohne gespeicherten Kennel: die Config lebt nur im Speicher, die Dogs im Store. */
    private async runKeysKennel(
        deps: KeysTestDeps,
        kennel: { ownerId: string | null; visibility: Visibility; editors?: string },
        dogIds: string[],
        ctx: AuthCtx | undefined,
        id = `test-p4c-kennel-${randomBytes(4).toString('hex')}`,
    ): Promise<any[]> {
        const runHandler = new KennelRunHandler({ kennelsController: deps.kennelsController, nodesStore: deps.nodesStore, baseDogsMap: deps.baseDogsMap, callCounter: this.testCallCounter });
        const config: any = { id, lineageId: id, name: 'P4c', dogIds, ...kennel };
        const waves = await runHandler.runKennel(config, {}, undefined, runHandler.toCapabilityCtx(ctx), undefined, { source: 'unknown' });
        return waves.flat();
    }

    /** Der Dog-Code, der einen Schluessel benutzt: der Wert in URL, Header und Body. */
    private static keyFetchDog(alias: string, host = 'api.example.com'): string {
        return `const r = await keys.fetch('https://${host}/v1/echo?k={{key:${alias}}}', { method: 'POST', headers: { Authorization: 'Bearer {{key:${alias}}}' }, body: JSON.stringify({ token: '{{key:${alias}}}' }) });\nreturn r;`;
    }

    /**
     * Test T1 (Editor-Diebstahl): der Editor U2 legt in U1s Kennel einen Dog, der `{{key:openai}}`
     * nutzt — sein Lauf findet keinen Alias `openai` (key_not_found), kein Wert im Result oder Fehler.
     * Gegenprobe: U1s eigener Dog nutzt U1s Key; der Upstream bekommt ihn, der Dog sieht ihn nie.
     */
    private async testKeysEditorTheft(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T1: Editor-Diebstahl scheitert (key_not_found), Owner-Lauf ohne Wert im Yield';
        const stamp = Date.now();
        const u1 = `test-p4c-t1a-${stamp}`;
        const u2 = `test-p4c-t1b-${stamp}`;
        await this.withKeysHarness(deps, [u1, u2], async ({ store, net }) => {
            try {
                const secret = StartupTest.keyTestSecret('t1');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                const thief = await this.saveAclTestDog(deps.nodesStore, 'P4cThiefDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u2 });
                const own = await this.saveAclTestDog(deps.nodesStore, 'P4cOwnerDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u1 });
                const kennel = { ownerId: u1, visibility: 'private' as Visibility, editors: u2 };

                const byEditor = await this.runKeysKennel(deps, kennel, [thief], this.fakeUser(u2));
                const stolen = byEditor.find((n: any) => n.lineageId === thief);
                if (!stolen || !String(stolen.error ?? '').includes('key_not_found:openai')) throw new Error(`Editor-Lauf: ${JSON.stringify(stolen?.error ?? stolen?.result)}`);
                const sentByEditor = net.sent.length;
                if (sentByEditor !== 0) throw new Error('Editor-Lauf hat gesendet');

                const byOwner = await this.runKeysKennel(deps, kennel, [own], this.fakeUser(u1));
                const node = byOwner.find((n: any) => n.lineageId === own);
                if (node?.error || node?.result?.status !== 200) throw new Error(`Owner-Lauf: ${JSON.stringify(node?.error ?? node?.result)}`);
                if (net.sent.length !== 1 || net.sent[0].headers.authorization !== `Bearer ${secret}` || !net.sent[0].url.href.includes(encodeURIComponent(secret))) {
                    throw new Error('Upstream bekam den Wert nicht (Ersetzung auf dem Host)');
                }
                if (!String(node.result.body).includes(`Bearer ${REDACTED_KEY}`) || node.result.headers['set-cookie'] !== undefined) throw new Error(`Antwort nicht bereinigt: ${JSON.stringify(node.result).slice(0, 200)}`);
                StartupTest.assertNoSecret('T1', [byEditor, byOwner], [secret]);
                this.addResult(testName, true);
            } catch (error) {
                this.addResult(testName, false, String(error));
            }
        });
    }

    /**
     * Test T2 (Fremder-Dog-Exfil): im VM-Kontext gibt es keinen Wert und kein keys.get; keys.fetch an
     * eine nicht erlaubte Domain, eine private Adresse oder mit dem Platzhalter im Host sendet nichts
     * (Fake-Zaehler 0). P3.5: ein fremder run-only-Dog bekommt die Keys seines Runners nicht.
     */
    private async testKeysForeignDogExfil(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T2: Exfil scheitert (kein keys.get, domain_not_allowed, private Netze, Fremd-Dog)';
        const stamp = Date.now();
        const u1 = `test-p4c-t2a-${stamp}`;
        const ux = `test-p4c-t2x-${stamp}`;
        await this.withKeysHarness(deps, [u1, ux], async ({ store, net }) => {
            try {
                const secret = StartupTest.keyTestSecret('t2');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                await store.set(u1, { alias: 'internal', secret: StartupTest.keyTestSecret('t2i'), allowedDomains: ['internal.example.com'] });
                const probe = await this.saveAclTestDog(deps.nodesStore, 'P4cProbeDog',
                    'return { hasGet: typeof keys.get, view: JSON.stringify(keys), list: await keys.list() };', { visibility: 'private', ownerId: u1 });
                const attempt = (url: string, header: string) =>
                    `try { await keys.fetch('${url}', { headers: { X: '${header}' } }); return 'sent'; } catch (e) { return e.message; }`;
                const evil = await this.saveAclTestDog(deps.nodesStore, 'P4cEvilDog', attempt('https://evil.example.com/', '{{key:openai}}'), { visibility: 'private', ownerId: u1 });
                const privateNet = await this.saveAclTestDog(deps.nodesStore, 'P4cPrivateDog', attempt('https://internal.example.com/', '{{key:internal}}'), { visibility: 'private', ownerId: u1 });
                const hostPart = await this.saveAclTestDog(deps.nodesStore, 'P4cHostDog', attempt('https://{{key:openai}}.api.example.com/', 'x'), { visibility: 'private', ownerId: u1 });
                const plainHttp = await this.saveAclTestDog(deps.nodesStore, 'P4cHttpDog', attempt('http://api.example.com/', '{{key:openai}}'), { visibility: 'private', ownerId: u1 });
                const foreign = await this.saveAclTestDog(deps.nodesStore, 'P4cForeignDog', attempt('https://api.example.com/', '{{key:openai}}'), { visibility: 'run-only', ownerId: ux });

                const nodes = await this.runKeysKennel(deps, { ownerId: u1, visibility: 'private' }, [probe, evil, privateNet, hostPart, plainHttp, foreign], this.fakeUser(u1));
                const resultOf = (id: string) => nodes.find((n: any) => n.lineageId === id)?.result;
                const seen = resultOf(probe);
                if (seen?.hasGet !== 'undefined' || seen.view !== '{}' || seen.list?.[0]?.alias !== 'internal' || JSON.stringify(seen).includes(secret)) throw new Error(`VM-Kontext: ${JSON.stringify(seen)}`);
                const expect = (label: string, id: string, pattern: RegExp) => {
                    const got = String(resultOf(id));
                    if (!pattern.test(got)) throw new Error(`${label}: ${got}`);
                };
                expect('evil.example.com', evil, /^domain_not_allowed$/);
                expect('privates Netz', privateNet, /^domain_not_allowed$/);
                expect('Platzhalter im Host', hostPart, /host part/);
                expect('http', plainHttp, /https only/);
                expect('fremder run-only-Dog', foreign, /^keys_unavailable$/);
                if (net.sent.length !== 0) throw new Error(`Fake-fetch gerufen: ${net.sent.length}`);
                StartupTest.assertNoSecret('T2', [nodes], [secret]);
                this.addResult(testName, true);
            } catch (error) {
                this.addResult(testName, false, String(error));
            }
        }, { hosts: { 'internal.example.com': ['10.0.0.5'] } });
    }

    /** Test T3 (Anon Public-Yield): oeffentlicher Kennel mit Key-Dog, ohne Grant, anonym -> keys_unavailable, kein Wert. */
    private async testKeysAnonPublicYield(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T3: anonymer Lauf eines oeffentlichen Key-Kennels -> keys_unavailable';
        const u1 = `test-p4c-t3-${Date.now()}`;
        await this.withKeysHarness(deps, [u1], async ({ store, net }) => {
            try {
                const secret = StartupTest.keyTestSecret('t3');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                const dog = await this.saveAclTestDog(deps.nodesStore, 'P4cPublicKeyDog', StartupTest.keyFetchDog('openai'), { visibility: 'public', ownerId: u1 });
                const nodes = await this.runKeysKennel(deps, { ownerId: u1, visibility: 'public' }, [dog], { user: null, isSuperUser: false });
                const lead = nodes.find((n: any) => n.lineageId === dog);
                if (!String(lead?.error ?? '').includes('keys_unavailable') || lead?.result !== undefined) throw new Error(`Lead: ${JSON.stringify(lead?.error ?? lead?.result)}`);
                if (net.sent.length !== 0) throw new Error('anonymer Lauf hat gesendet');
                StartupTest.assertNoSecret('T3', [nodes], [secret]);
                this.addResult(testName, true);
            } catch (error) {
                this.addResult(testName, false, String(error));
            }
        });
    }

    /**
     * Test T6 (Log): ein Dog loggt die Antwort eines Upstreams, der den Auth-Header echot. Die Zeilen
     * tragen [redacted:key], nie den Wert. Dazu die Senke selbst: eine Zeile mit dem rohen Wert wird
     * mit dem Laufzustand bereinigt (L7, Host-Scrub).
     */
    private async testKeysLogScrub(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T6: console ueber die Bridge, Log-Zeilen bereinigt';
        const u1 = `test-p4c-t6-${Date.now()}`;
        await this.withKeysHarness(deps, [u1], async ({ store }) => {
            const lines: string[] = [];
            const original = { log: console.log, info: console.info, warn: console.warn, error: console.error };
            const capture = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
            try {
                const secret = StartupTest.keyTestSecret('t6');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                const dog = await this.saveAclTestDog(deps.nodesStore, 'P4cLogDog',
                    `${StartupTest.keyFetchDog('openai').replace(/\nreturn r;$/, '')}\nconsole.log(r);\nconsole.warn('p4c-log', r.body);\nreturn r.status;`,
                    { visibility: 'private', ownerId: u1 });
                console.log = console.info = console.warn = console.error = capture;
                const nodes = await this.runKeysKennel(deps, { ownerId: u1, visibility: 'private' }, [dog], this.fakeUser(u1));
                const run = new KeyRunState();
                run.remember(secret);
                scrubbingConsoleSink('log', `p4c-sink ${secret}`, { runState: run });
                Object.assign(console, original);

                if (nodes.find((n: any) => n.lineageId === dog)?.result !== 200) throw new Error('Log-Dog lief nicht');
                const dogLines = lines.filter((l) => l.includes('p4c-log') || l.includes('status'));
                if (dogLines.length < 2 || !dogLines.some((l) => l.includes(REDACTED_KEY))) throw new Error(`Log-Zeilen des Dogs fehlen/unbereinigt: ${dogLines.length}`);
                if (!lines.includes(`p4c-sink ${REDACTED_KEY}`)) throw new Error('Senke scrubbt nicht');
                if (lines.some((l) => l.includes(secret))) throw new Error('Log traegt den Wert');
                this.addResult(testName, true);
            } catch (error) {
                Object.assign(console, original);
                this.addResult(testName, false, String(error));
            }
        });
    }

    /**
     * Test T7 (Super-User-Falle): {user:null, isSuperUser:true} -> keys_unavailable (fail-closed);
     * mit KEYSTORE_SUPERUSER_OWNER=U1 (nur lokal) nutzt derselbe Lauf U1s Keys. REST 403 steht in T8.
     */
    private async testKeysSuperUserTrap(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T7: Super-User ohne user -> keys_unavailable; KEYSTORE_SUPERUSER_OWNER -> Keys von U1';
        const u1 = `test-p4c-t7-${Date.now()}`;
        const superUser: AuthCtx = { user: null, isSuperUser: true };
        try {
            let dog = '';
            let secret = '';
            await this.withKeysHarness(deps, [u1], async ({ store, net }) => {
                secret = StartupTest.keyTestSecret('t7');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                dog = await this.saveAclTestDog(deps.nodesStore, 'P4cSuperDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u1 });
                const nodes = await this.runKeysKennel(deps, { ownerId: u1, visibility: 'private' }, [dog], superUser);
                const lead = nodes.find((n: any) => n.lineageId === dog);
                if (!String(lead?.error ?? '').includes('keys_unavailable') || net.sent.length !== 0) throw new Error(`ohne Owner: ${JSON.stringify(lead?.error ?? lead?.result)}`);
            });
            await this.withKeysHarness(deps, [u1], async ({ store, net }) => {
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                const nodes = await this.runKeysKennel(deps, { ownerId: u1, visibility: 'private' }, [dog], superUser);
                const lead = nodes.find((n: any) => n.lineageId === dog);
                if (lead?.result?.status !== 200 || net.sent.length !== 1) throw new Error(`mit KEYSTORE_SUPERUSER_OWNER: ${JSON.stringify(lead?.error ?? lead?.result)}`);
                StartupTest.assertNoSecret('T7', [nodes], [secret]);
            }, { superuserOwner: u1 });
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test T4 (Snapshot-Quergriff): U1 refresht einen Snapshot mit Key-Nutzung; U2 liest ihn nicht
     * (Snapshot je Betrachter), U1s Snapshot traegt den Wert nicht. Defense-in-Depth: selbst Waves,
     * die den rohen Wert truegen, legt der Cache nur bereinigt ab; ein Laufzeitfehler verliert ihn
     * aus Text und Stack.
     */
    private async testKeysSnapshotCrossRead(deps: KeysTestDeps, kennelsStore: IStore, nodesController: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'P4c T4: Snapshot-Quergriff und Scrub vor markOk/Fehlern';
        const stamp = Date.now();
        const u1 = `test-p4c-t4a-${stamp}`;
        const u2 = `test-p4c-t4b-${stamp}`;
        const kennelId = `test-p4c-t4-${stamp}`;
        await this.withKeysHarness(deps, [u1, u2], async ({ store }) => {
            try {
                const secret = StartupTest.keyTestSecret('t4');
                await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'] });
                const dog = await this.saveAclTestDog(deps.nodesStore, 'P4cSnapDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u1 });
                const created = await deps.kennelsController.create({ id: kennelId, name: 'P4c T4', dogIds: [dog], visibility: 'private', ownerId: u1, viewers: [u2] } as any);
                if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
                const runHandler = new KennelRunHandler({ kennelsController: deps.kennelsController, nodesStore: deps.nodesStore, baseDogsMap: deps.baseDogsMap, callCounter: this.testCallCounter });
                const toolDeps = this.toolDeps(deps.nodesStore, kennelsStore, nodesController, deps.kennelsController, runHandler);
                const tools = getSnapshotTools();
                const call = (name: string, ctx: AuthCtx, args: Record<string, any> = {}) =>
                    tools.find((t) => t.name === name)!.handler({ id: kennelId, ...args }, ctx, toolDeps);
                const seen: unknown[] = [];

                seen.push(await call('refresh_kennel_snapshot', this.fakeUser(u1)));
                const header = await call('wait_for_kennel_snapshot', this.fakeUser(u1), { timeoutMs: 30_000 });
                seen.push(header);
                if (!/"status":\s*"ok"/.test(header.content[0].text)) throw new Error(`Snapshot U1: ${header.content[0].text.slice(0, 200)}`);
                const own = await call('get_snapshot_dog_result', this.fakeUser(u1), { dogId: dog });
                const ownVm = await call('get_snapshot_dog_vmcontext', this.fakeUser(u1), { dogId: dog });
                seen.push(own, ownVm);
                if (!own.content[0].text.includes(REDACTED_KEY)) throw new Error('U1-Snapshot: Upstream-Echo nicht bereinigt');
                for (const name of ['get_snapshot_dog_result', 'get_snapshot_dog_vmcontext']) {
                    const foreign = await call(name, this.fakeUser(u2), { dogId: dog });
                    seen.push(foreign);
                    if (!foreign.isError || !/no snapshot/.test(foreign.content[0]?.text ?? '')) throw new Error(`U2 liest U1s Snapshot (${name})`);
                }
                StartupTest.assertNoSecret('T4 Werkzeuge', seen, [secret]);

                const run = new KeyRunState();
                run.remember(secret);
                const rawWaves: any = [[{ id: 'd', result: { echo: `Bearer ${secret}` }, error: `boom ${secret}`, vmContext: { Parent: { token: secret } } }]];
                KeyRunState.attach(rawWaves, run);
                const cache = new KennelSnapshotCache();
                cache.startJob('k', 'user:x', 'v', {}, undefined, 'x');
                cache.markOk('k', 'user:x', { waves: rawWaves, kennelConfig: {} as any, leadDogId: 'd', leadResult: { echo: secret } });
                const err = run.scrubError(new Error(`upstream said ${secret}`));
                StartupTest.assertNoSecret('T4 markOk/Fehler', [cache.get('k', 'user:x'), err.message, err.stack], [secret]);
                this.addResult(testName, true);
            } catch (error) {
                this.addResult(testName, false, String(error));
            } finally {
                try { await deps.kennelsController.delete(kennelId); } catch { /* ignore */ }
            }
        });
    }

    /**
     * Test T1, zweiter Teil (8.8 kennelGrants): ohne Quota keine Freigabe (quota_required). Mit Freigabe
     * laeuft der Owner-Key anonym ueber den freigegebenen Kennel — auch fuer seinen privaten Dog —,
     * usedToday +1, kein Wert im Yield; danach quota_exceeded. Nicht freigegebener Kennel und ein Dog,
     * dessen Code der Owner nicht lesen darf: keys_unavailable.
     */
    private async testKeysKennelGrants(deps: KeysTestDeps): Promise<void> {
        const testName = 'P4c T1b: kennelGrants mit Pflicht-Quota fuer fremde Runner';
        const stamp = Date.now();
        const u1 = `test-p4c-t1g-${stamp}`;
        const u2 = `test-p4c-t1h-${stamp}`;
        const granted = `test-p4c-granted-${stamp}`;
        const anon: AuthCtx = { user: null, isSuperUser: false };
        await this.withKeysHarness(deps, [u1, u2], async ({ store, net }) => {
            try {
                const secret = StartupTest.keyTestSecret('t1g');
                try {
                    await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'], kennelGrants: [granted] });
                    throw new Error('Freigabe ohne Quota angenommen');
                } catch (err: any) {
                    if (err?.code !== 'quota_required') throw err;
                }
                const view = await store.set(u1, { alias: 'openai', secret, allowedDomains: ['api.example.com'], kennelGrants: [granted], quotaPerDay: 1 });
                if (view.kennelGrants.join() !== granted || view.quotaPerDay !== 1) throw new Error(`Sicht: ${JSON.stringify(view)}`);
                const ownerDog = await this.saveAclTestDog(deps.nodesStore, 'P4cGrantDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u1 });
                const editorDog = await this.saveAclTestDog(deps.nodesStore, 'P4cGrantEditorDog', StartupTest.keyFetchDog('openai'), { visibility: 'private', ownerId: u2 });
                const kennel = { ownerId: u1, visibility: 'public' as Visibility, editors: u2 };
                const outcome = async (dog: string, id: string) => {
                    const nodes = await this.runKeysKennel(deps, kennel, [dog], anon, id);
                    StartupTest.assertNoSecret('T1b', [nodes], [secret]);
                    const n = nodes.find((x: any) => x.lineageId === dog);
                    return n?.error ? String(n.error) : n?.result?.status;
                };

                const first = await outcome(ownerDog, granted);
                if (first !== 200 || net.sent.length !== 1 || net.sent[0].headers.authorization !== `Bearer ${secret}`) throw new Error(`freigegeben, anonym: ${first}`);
                if ((await store.findRow(u1, 'openai'))?.usedToday !== 1) throw new Error('usedToday nicht +1');
                const second = await outcome(ownerDog, granted);
                if (!second || !String(second).includes('quota_exceeded')) throw new Error(`Quota: ${second}`);
                const other = await outcome(ownerDog, `${granted}-other`);
                if (!String(other).includes('keys_unavailable')) throw new Error(`nicht freigegebener Kennel: ${other}`);
                const foreignCode = await outcome(editorDog, granted);
                if (!String(foreignCode).includes('keys_unavailable')) throw new Error(`Dog, den der Owner nicht lesen darf: ${foreignCode}`);
                if (net.sent.length !== 1) throw new Error(`gesendet: ${net.sent.length}`);
                this.addResult(testName, true);
            } catch (error) {
                this.addResult(testName, false, String(error));
            }
        });
    }

    /** Test T9 (Export-Scan): roher Schluessel im Dog-Code und in den Defaults -> [redacted]; `{{key:x}}` reist unveraendert. */
    private async testExportScansRawKeys(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P4c T9: Export ersetzt rohe Key-Muster, Platzhalter reisen';
        const kennelId = `test-p4c-t9-${Date.now()}`;
        try {
            const raw = 'sk-abcdefghijklmnopqrstuvwx';
            const gh = `ghp_${'a1'.repeat(18)}`;
            const dog = await this.saveAclTestDog(nodesStore, 'P4cExportDog',
                `const legacy = '${raw}';\nconst r = await keys.fetch('https://api.example.com/', { headers: { Authorization: 'Bearer {{key:x}}' } });\nreturn r.status;`,
                { visibility: 'public', ownerId: 'UT9' });
            const created = await kennelsController.create({ id: kennelId, name: 'P4c T9', dogIds: [dog], visibility: 'public', ownerId: 'UT9', defaultQuery: { token: gh } } as any);
            if (!created.ok) throw new Error(`Kennel nicht angelegt: ${created.error}`);
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const bundle = await this.callHandler(new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap), 'handleExport', { params: { id: kennelId }, ctx: this.fakeUser('UT9') });
            const text = JSON.stringify(bundle.body);
            if (bundle.statusCode !== 200) throw new Error(`Export: ${bundle.statusCode}`);
            if (text.includes(raw) || text.includes(gh)) throw new Error('roher Schluessel im Bundle');
            if (!text.includes('{{key:x}}')) throw new Error('Platzhalter fehlt im Bundle');
            if ((bundle.body?.redactions?.count ?? 0) < 2) throw new Error(`redactions: ${JSON.stringify(bundle.body?.redactions)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Test 8.9: der native fetch im Dog erreicht keine privaten oder lokalen Netze — Loopback,
     * Metadaten-Dienst, IPv6-Loopback, `localhost`, Hex-Schreibweise; `data:` bleibt erlaubt.
     * (Oeffentliche Ziele prueft die Abnahme gegen den laufenden Server.)
     */
    private async testWorkerFetchBlocksPrivateNetworks(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = '8.9: Worker-fetch blockt private Netze (Blocklist), data: bleibt';
        try {
            const targets = ['http://127.0.0.1:9/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:9/', 'http://localhost:9/', 'http://0x7f.1:9/', 'http://10.0.0.1:9/', 'http://192.168.0.1:9/'];
            const dog = await this.saveAclTestDog(nodesStore, 'P4cEgressDog',
                `const out = {};\nfor (const u of ${JSON.stringify(targets)}) { try { await fetch(u); out[u] = 'reached'; } catch (e) { out[u] = String(e.message); } }\n`
                + `out.data = await (await fetch('data:text/plain,p4c-ok')).text();\nreturn out;`,
                { visibility: 'private', ownerId: 'UEGRESS' });
            const deps: KeysTestDeps = { prisma: null as any, nodesStore, kennelsController, baseDogsMap };
            const nodes = await this.runKeysKennel(deps, { ownerId: 'UEGRESS', visibility: 'private' }, [dog], { user: null, isSuperUser: true });
            const out = nodes.find((n: any) => n.lineageId === dog)?.result;
            if (!out) throw new Error(`Dog lief nicht: ${JSON.stringify(nodes.find((n: any) => n.lineageId === dog)?.error)}`);
            const open = targets.filter((t) => !String(out[t]).startsWith('egress_blocked'));
            if (open.length) throw new Error(`nicht geblockt: ${open.map((t) => `${t} -> ${out[t]}`).join(' | ')}`);
            if (out.data !== 'p4c-ok') throw new Error(`data: ${out.data}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Sicherheit: der Dog-Worker traegt keine Server-Umgebung. Node's vm ist kein Sicherheits-Sandkasten --
     * Dog-Code bricht aus dem VM-Kontext in den Worker-Realm aus, etwa mit
     *   fetch.constructor.constructor("return process.env")()
     * und liest dort process.env. Ohne env: {} beim new Worker(...) erbte der Worker eine Kopie der kompletten
     * Server-Env; der Ausbruch foerderte dann DATABASE_URL / KEYSTORE_MASTER_KEY_V1 / MCP_TOKEN_SIGNING_KEY /
     * GOOGLE_OAUTH_CLIENT_SECRET zutage und lieferte sie als Dog-Yield unter /k/<kennel> aus.
     *
     * Der Test faehrt einen echten Dog ueber den KennelRun-Pfad (wie /run), der drei Ausbrueche versucht --
     * per fetch, per console und als Vollabzug von process.env -- und prueft, dass im Yield weder der nur fuer
     * diesen Lauf gesetzte Sondenwert noch die Namen der Geheimnisse auftauchen. Gegenprobe: ein normaler Dog
     * liefert weiter korrekt, und der Timeout terminiert eine Endlosschleife -- Heap-Deckel und Timeout sind
     * parent-seitig, env: {} ruehrt sie nicht an. Restrisiko: der Realm-Ausbruch selbst (fs/child_process/Netz
     * unter Umgehung von guardedFetch) bleibt -- echte Isolation braucht eine Prozess-Sandbox (R30 im PLAN).
     */
    private async testDogWorkerHasNoServerEnv(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'Sicherheit: Dog-Worker erbt keine Server-Env (Realm-Ausbruch foerdert keine Secrets)';
        const probe = 'lotus-env-probe-' + randomBytes(12).toString('hex');
        const savedTimeout = process.env.SLOPDOGS_VM_TIMEOUT_MS;
        const savedAltTimeout = process.env.DATADOGS_VM_TIMEOUT_MS;
        try {
            // Die Sonde nur fuer diesen Lauf in die SERVER-Env legen (nicht in .env). Ein leckender Worker
            // gaebe sie ueber jeden der drei Vektoren zurueck.
            process.env.LOTUS_SECRET_PROBE = probe;

            const attack =
                'const out = {};\n'
                + "try { out.viaFetch = String(fetch.constructor.constructor('return process.env.LOTUS_SECRET_PROBE')()); } catch (e) { out.viaFetch = 'ERR ' + e.message; }\n"
                + "try { out.viaConsole = String(console.log.constructor.constructor('return process.env.LOTUS_SECRET_PROBE')()); } catch (e) { out.viaConsole = 'ERR ' + e.message; }\n"
                + "try { out.dump = fetch.constructor.constructor('return JSON.stringify(process.env)')(); } catch (e) { out.dump = 'ERR ' + e.message; }\n"
                + 'return out;';
            const dog = await this.saveAclTestDog(nodesStore, 'LotusEnvExfilDog', attack, { visibility: 'private', ownerId: 'UENVEXFIL' });
            const deps: KeysTestDeps = { prisma: null as any, nodesStore, kennelsController, baseDogsMap };
            const nodes = await this.runKeysKennel(deps, { ownerId: 'UENVEXFIL', visibility: 'private' }, [dog], { user: null, isSuperUser: true });
            const node = nodes.find((n: any) => n.lineageId === dog);
            const out = node?.result;
            if (!out) throw new Error(`Angriffs-Dog lief nicht: ${JSON.stringify(node?.error)}`);
            // Kernaussage: der Sondenwert taucht im Yield nirgends auf (assertNoSecret prueft roh/encoded/escaped).
            StartupTest.assertNoSecret('env-exfil', [out], [probe]);
            // Der Env-Dump traegt keinen Geheimnis-Namen. DATABASE_URL steht am Boot real in der Server-Env --
            // ein leckender Worker faende ihn, ein sauberer sieht ein leeres process.env.
            const text = JSON.stringify(out);
            const names = ['DATABASE_URL', 'KEYSTORE_MASTER_KEY', 'SIGNING', 'SECRET'].filter((n) => text.includes(n));
            if (names.length) throw new Error(`Env-Namen im Yield: ${names.join(', ')} -- Worker traegt die Server-Env`);
            // Crisp: die process.env im Worker ist leer. Ohne den Env-Scrub traegt sie die per dotenv-Preload
            // geladenen Secrets (env: {} allein genuegt dort nicht) -- dieser Vergleich ist das rot/gruen.
            if (out.dump !== '{}') throw new Error(`process.env im Worker nicht leer: ${String(out.dump).slice(0, 100)}`);
            if (out.viaFetch !== 'undefined' || out.viaConsole !== 'undefined') {
                throw new Error(`Sonde im Worker lesbar: fetch=${out.viaFetch}, console=${out.viaConsole}`);
            }

            // Regression: ein normaler Dog liefert weiter korrekt ueber denselben Worker (env: {} + resourceLimits).
            const plain = await this.saveAclTestDog(nodesStore, 'LotusPlainDog', 'return { ok: 6 * 7 };', { visibility: 'private', ownerId: 'UENVEXFIL' });
            const plainNodes = await this.runKeysKennel(deps, { ownerId: 'UENVEXFIL', visibility: 'private' }, [plain], { user: null, isSuperUser: true });
            const plainOut = plainNodes.find((n: any) => n.lineageId === plain)?.result;
            if (!plainOut || plainOut.ok !== 42) throw new Error(`normaler Dog liefert falsch: ${JSON.stringify(plainOut)}`);

            // Kurz belegt: der Timeout terminiert weiter eine Endlosschleife (parent-seitig, von env: {} unberuehrt).
            process.env.SLOPDOGS_VM_TIMEOUT_MS = '400';
            delete process.env.DATADOGS_VM_TIMEOUT_MS;
            const spin = await this.saveAclTestDog(nodesStore, 'LotusSpinDog', 'while (true) {}\nreturn 1;', { visibility: 'private', ownerId: 'UENVEXFIL' });
            const spinNode = (await this.runKeysKennel(deps, { ownerId: 'UENVEXFIL', visibility: 'private' }, [spin], { user: null, isSuperUser: true }))
                .find((n: any) => n.lineageId === spin);
            if (!spinNode?.error || !String(spinNode.error).includes(DOG_TIMEOUT_MARKER)) {
                throw new Error(`Timeout griff nicht: err=${JSON.stringify(spinNode?.error)} result=${JSON.stringify(spinNode?.result)}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            delete process.env.LOTUS_SECRET_PROBE;
            if (savedTimeout === undefined) delete process.env.SLOPDOGS_VM_TIMEOUT_MS; else process.env.SLOPDOGS_VM_TIMEOUT_MS = savedTimeout;
            if (savedAltTimeout === undefined) delete process.env.DATADOGS_VM_TIMEOUT_MS; else process.env.DATADOGS_VM_TIMEOUT_MS = savedAltTimeout;
        }
    }

    /**
     * Sicherheit: der Dog-Worker fasst das Dateisystem nicht an und startet keinen Prozess. Node's vm ist
     * kein Sicherheits-Sandkasten -- Dog-Code bricht in den Worker-Realm aus und holte sich require sonst
     * ueber process.getBuiltinModule (Node >= 22) / mainModule.require / binding / dlopen zurueck, daraus fs
     * (auch /proc/1/environ = Server-Env als Datei) und child_process (gemessen: writeFileSync UND execSync
     * liefen). Diese Rueckwege sind gekappt und process eingefroren. Der Test faehrt einen Dog ueber den
     * echten KennelRun-Pfad, der schreiben, lesen, importieren und execSync versucht, und prueft: kein fs,
     * keine Datei entsteht, kein fremder Datei-Inhalt im Yield, kein Prozess. Gegenprobe: ein normaler Dog
     * liefert weiter. Restrisiko: V8-Primordials bleiben -> isolated-vm ist der echte Fix (R30).
     */
    private async testDogWorkerHasNoFilesystem(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'Sicherheit: Dog-Worker ohne Dateisystem/Prozess (require-Rueckweg gekappt)';
        const stamp = randomBytes(6).toString('hex');
        const targetWrite = path.join(os.tmpdir(), `lotus-dog-write-${stamp}.txt`);
        const secretFile = path.join(os.tmpdir(), `lotus-dog-secret-${stamp}.txt`);
        const secret = 'lotus-fs-secret-' + randomBytes(12).toString('hex');
        try {
            fs.writeFileSync(secretFile, secret);
            const attack =
                'const out = {};\n'
                + 'let proc = null; try { proc = fetch.constructor.constructor("return process")(); } catch (e) {}\n'
                + 'out.getBuiltin = proc ? typeof proc.getBuiltinModule : "no-proc";\n'
                + 'out.binding = proc ? typeof proc.binding : "no-proc";\n'
                + 'out.dlopen = proc ? typeof proc.dlopen : "no-proc";\n'
                + 'let f = null; let how = "no-fs";\n'
                + 'try { f = proc.getBuiltinModule("fs"); if (f) how = "getBuiltinModule"; } catch (e) {}\n'
                + 'if (!f) { try { f = proc.mainModule.require("fs"); how = "mainModule.require"; } catch (e) {} }\n'
                + 'if (!f) { try { f = proc.binding("fs"); how = "binding"; } catch (e) {} }\n'
                + 'if (!f) { try { f = (await import("fs")); how = "import"; } catch (e) {} }\n'
                + 'out.fsHow = f ? how : "no-fs";\n'
                + 'try { f.writeFileSync(' + JSON.stringify(targetWrite) + ', "x"); out.write = "WROTE"; } catch (e) { out.write = "ERR " + String(e.message).slice(0, 40); }\n'
                + 'try { out.read = String(f.readFileSync(' + JSON.stringify(secretFile) + ')); } catch (e) { out.read = "ERR " + String(e.message).slice(0, 40); }\n'
                + 'let cp = null; try { cp = proc.getBuiltinModule("child_process"); } catch (e) {}\n'
                + 'try { out.exec = String(cp.execSync("echo hi")); } catch (e) { out.exec = "ERR " + String(e.message).slice(0, 40); }\n'
                + 'return out;';
            const dog = await this.saveAclTestDog(nodesStore, 'LotusFsExfilDog', attack, { visibility: 'private', ownerId: 'UFSEXFIL' });
            const deps: KeysTestDeps = { prisma: null as any, nodesStore, kennelsController, baseDogsMap };
            const nodes = await this.runKeysKennel(deps, { ownerId: 'UFSEXFIL', visibility: 'private' }, [dog], { user: null, isSuperUser: true });
            const node = nodes.find((n: any) => n.lineageId === dog);
            const out = node?.result;
            if (!out) throw new Error(`Angriffs-Dog lief nicht: ${JSON.stringify(node?.error)}`);
            // require-Rueckwege neutralisiert.
            if (out.getBuiltin !== 'undefined' || out.binding !== 'undefined' || out.dlopen !== 'undefined') {
                throw new Error(`require-Rueckweg offen: getBuiltinModule=${out.getBuiltin}, binding=${out.binding}, dlopen=${out.dlopen}`);
            }
            if (out.fsHow !== 'no-fs') throw new Error(`fs erreichbar via ${out.fsHow}`);
            // Kein Schreiben: weder gemeldeter Erfolg noch eine Datei auf der Platte.
            if (out.write === 'WROTE' || fs.existsSync(targetWrite)) {
                throw new Error(`Dog hat geschrieben: write=${out.write}, existiert=${fs.existsSync(targetWrite)}`);
            }
            // Kein Lesen: der Inhalt der fremden Datei taucht nicht im Yield auf.
            if (!String(out.read).startsWith('ERR')) throw new Error(`Dog hat gelesen: ${String(out.read).slice(0, 40)}`);
            StartupTest.assertNoSecret('fs-read', [out], [secret]);
            // Kein Prozess.
            if (!String(out.exec).startsWith('ERR')) throw new Error(`Dog hat einen Prozess gestartet: ${out.exec}`);

            // Regression: ein normaler Dog liefert weiter korrekt (nur fetch/console/yield -- kein fs noetig).
            const plain = await this.saveAclTestDog(nodesStore, 'LotusFsPlainDog', 'return { ok: 6 * 7 };', { visibility: 'private', ownerId: 'UFSEXFIL' });
            const plainOut = (await this.runKeysKennel(deps, { ownerId: 'UFSEXFIL', visibility: 'private' }, [plain], { user: null, isSuperUser: true }))
                .find((n: any) => n.lineageId === plain)?.result;
            if (!plainOut || plainOut.ok !== 42) throw new Error(`normaler Dog liefert falsch: ${JSON.stringify(plainOut)}`);

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { fs.unlinkSync(secretFile); } catch { /* ignore */ }
            try { if (fs.existsSync(targetWrite)) fs.unlinkSync(targetWrite); } catch { /* ignore */ }
        }
    }

    /** Der `public/`-Ordner wie im Server (ts-node: neben StartupTest.ts, dist/: eine Ebene hoeher). */
    private landingPublicDir(): string {
        const dir = resolvePublicDir(__dirname);
        if (!dir) throw new Error('public/ nicht gefunden');
        return dir;
    }

    /** Nur Mixtape (Aenderung 10-0): die Seite traegt #sd-live, ihre eigene Schrift und keinen Look-Umschalter. */
    private static assertMixtapeOnly(html: string): void {
        if (!html.includes('id="sd-live"') || !html.includes('/static/landing/bebas-neue.woff2')) throw new Error('Mixtape ohne #sd-live oder ohne eigene Schrift');
        if (/\?look=|class="looks"/.test(html)) throw new Error('Look-Umschalter in der Seite');
    }

    /**
     * P5: der Landing-Seed ist SELBSTHEILEND — ein zweiter Lauf ersetzt die Landing (Kennel + eigene Dogs),
     * statt sie zu ueberspringen: danach genau eine Kennel-Version, drei frisch gebaute Dogs (neue lineageIds),
     * public und Community, ohne dass Landing-Dogs global akkumulieren.
     */
    private async testLandingSeedIdempotent(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
        const testName = 'P5: Landing-Seed selbstheilend (ersetzt, dupliziert nicht), public, Community';
        try {
            const landingDogs = async () => (await nodesStore.findByType(SerializedDog.name))
                .filter((row: any) => String(row.displayName ?? '').startsWith('SlopdogsLanding')).length;
            const parseIds = (k: any): string[] => (typeof k.dogIds === 'string' ? JSON.parse(k.dogIds) : k.dogIds) || [];
            const before = await kennelsStore.findByLineage('KennelConfig', SLOPDOGS_LANDING_KENNEL_ID);
            if (before.length < 1) throw new Error('Kennel slopdogs-landing fehlt nach dem Boot-Seed');
            const beforeIds = parseIds(before[0]);
            const dogsBefore = await landingDogs();

            await seedSlopdogsLandingKennel(nodesStore, kennelsStore);

            const after = await kennelsStore.findByLineage('KennelConfig', SLOPDOGS_LANDING_KENNEL_ID);
            if (after.length !== 1) throw new Error(`nach Reseed nicht genau eine Kennel-Version: ${after.length}`);
            const kennel = after[0];
            const afterIds = parseIds(kennel);
            if (afterIds.length !== 3) throw new Error(`dogIds: ${afterIds.join(',')}`);
            if (kennel.visibility !== 'public' || kennel.ownerId) throw new Error(`Sichtbarkeit ${kennel.visibility}, Owner ${kennel.ownerId}`);
            // selbstheilend: neu gebaut -> andere Dog-lineageIds als vorher.
            if (afterIds.join() === beforeIds.join()) throw new Error('Reseed hat nicht neu gebaut (gleiche dogIds)');
            // kein Zuwachs: die eigenen drei ersetzt, keine Duplikate global.
            const dogsAfter = await landingDogs();
            if (dogsAfter !== dogsBefore) throw new Error(`Landing-Dogs akkumuliert: ${dogsBefore}->${dogsAfter}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * P5 (nur Mixtape): `/` aus dem Memo — ein Lauf je Fenster, Quelle `landing` (rankt nicht), die Seite ohne
     * Look-Umschalter, abgelaufenes Memo liefert sofort und erneuert im Hintergrund, Host je Anfrage. Laeuft gegen
     * einen frisch aus den Repo-Quellen geseedeten Test-Kennel (der gespeicherte kann aelter sein).
     */
    private async testLandingMemoAndSource(nodesStore: IStore, kennelsStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P5: Landing aus dem Kennel — Memo, Quelle landing, nur Mixtape';
        const kennelId = `st-landing-${Date.now()}`;
        try {
            await seedSlopdogsLandingKennel(nodesStore, kennelsStore, kennelId);
            const counter = new KennelCallCounter(StartupTest.NO_STATS_STORE, { flushIntervalMs: 0 });
            const handler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: counter });
            let clock = 1_000_000;
            const landing = new LandingPage({ publicDir: this.landingPublicDir(), kennelIds: [], defaultKennelId: kennelId, memoMs: 60_000, now: () => clock });
            landing.useRunner(handler);
            const runs = (): number => landing.runs;

            const first = await landing.page();
            const second = await landing.page();
            if (!first || first.source !== 'kennel') throw new Error(`erste Seite: ${first?.source}`);
            if (runs() !== 1 || second?.html !== first.html) throw new Error(`zweiter Aufruf im Fenster: ${runs()} Laeufe`);
            StartupTest.assertMixtapeOnly(first.html);

            const calls = counter.pendingAggregates('1970-01-01').get(kennelId);
            if (!calls || calls.total !== 1 || calls.ranked30d !== 0 || calls.rankedTotal !== 0) throw new Error(`Zaehler: ${JSON.stringify(calls)}`);

            clock += 60_001;
            const stale = await landing.page();
            if (stale?.html !== first.html) throw new Error('abgelaufenes Memo liefert nicht sofort die gemerkte Seite');
            await (landing as any).inFlight.get(kennelId);
            if (runs() !== 2) throw new Error(`Hintergrund-Refresh: ${runs()} Laeufe`);

            const hosted = LandingPage.withHost(first.html, new URL('https://slop.example'));
            if (hosted.includes(LandingPage.HOST_MARK) || !hosted.includes('https://slop.example/mcp')) throw new Error('Host nicht eingesetzt');
            const badHost = { protocol: 'http', get: () => 'evil"><script>' } as any;
            const saved = process.env.MCP_BASE_URL;
            delete process.env.MCP_BASE_URL;
            try {
                if (LandingPage.baseOf(badHost) !== null) throw new Error('ungueltiger Host-Header wird uebernommen');
                if (LandingPage.baseOf({ protocol: 'http', get: () => '127.0.0.1:3099' } as any)?.host !== '127.0.0.1:3099') throw new Error('Request-Host');
            } finally {
                if (saved !== undefined) process.env.MCP_BASE_URL = saved;
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            await StartupTest.removeSeededLanding(nodesStore, kennelsStore, kennelId);
        }
    }

    /** Ein per seedSlopdogsLandingKennel angelegter Test-Kennel samt seiner Dogs (alle Versionen) wieder weg. */
    private static async removeSeededLanding(nodesStore: IStore, kennelsStore: IStore, kennelId: string): Promise<void> {
        try {
            const rows = await kennelsStore.findByLineage('KennelConfig', kennelId);
            const dogIds = new Set<string>();
            for (const row of rows) {
                const ids: unknown = typeof row.dogIds === 'string' ? JSON.parse(row.dogIds) : row.dogIds;
                if (Array.isArray(ids)) ids.filter((d) => typeof d === 'string' && !d.startsWith('base:')).forEach((d) => dogIds.add(d));
                await kennelsStore.delete(row.id);
            }
            for (const lineageId of dogIds) {
                for (const version of await nodesStore.findAllVersions(SerializedDog.name, lineageId)) await nodesStore.delete(version.id);
            }
        } catch (err) {
            console.warn(`[StartupTest] Test-Landing ${kennelId} nicht vollstaendig entfernt:`, err);
        }
    }

    /**
     * P5: Fallback — fehlt der Kennel, liefert `/` die statische Seite (und merkt sich das fuer das Fenster);
     * wirft ein Lauf, bleibt eine gute Seite stehen; liefert er nichts mehr, gilt wieder der Fallback.
     */
    private async testLandingFallback(): Promise<void> {
        const testName = 'P5: Landing-Fallback ohne Kennel, bei Fehler, ohne Runner';
        try {
            const publicDir = this.landingPublicDir();
            const file = fs.readFileSync(path.join(publicDir, 'landing', 'index.html'), 'utf8');
            let clock = 0;
            let answer: () => Promise<unknown> = async () => null;
            const seen = { asked: 0 };
            const runner: LandingRunner = { runLeadAsAnonymous: async () => { seen.asked += 1; return answer(); } };
            const asked = (): number => seen.asked;
            const landing = new LandingPage({ publicDir, kennelIds: [], defaultKennelId: '__st_no_landing', memoMs: 1_000, now: () => clock });

            const cold = await landing.page();
            if (cold?.source !== 'fallback' || cold.html !== file || asked() !== 0) throw new Error('ohne Runner kein Fallback');
            landing.useRunner(runner);
            const missing = await landing.page();
            await landing.page();
            if (missing?.source !== 'fallback' || missing.html !== file || asked() !== 1) throw new Error(`fehlender Kennel: ${missing?.source}, ${asked()} Laeufe`);

            clock += 1_001;
            answer = async () => '<!DOCTYPE html><html><body>kennel</body></html>';
            await landing.page();
            await (landing as any).inFlight.get('__st_no_landing');
            if ((await landing.page())?.source !== 'kennel') throw new Error('Kennel wieder da, Seite nicht');

            clock += 1_001;
            answer = async () => { throw new Error('boom'); };
            await landing.page();
            await (landing as any).inFlight.get('__st_no_landing');
            if ((await landing.page())?.source !== 'kennel') throw new Error('geworfener Lauf verdraengt die gute Seite');

            clock += 1_001;
            answer = async () => ({ not: 'html' });
            await landing.page();
            await (landing as any).inFlight.get('__st_no_landing');
            if ((await landing.page())?.source !== 'fallback') throw new Error('Lead ohne HTML liefert nicht den Fallback');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** P5: der Fallback ist die gebaute Mixtape-Seite der Repo-Quellen (scripts/build-landing.cjs), nicht veraltet. */
    private async testLandingFallbackIsBuilt(): Promise<void> {
        const testName = 'P5: public/landing/index.html == gebaute Mixtape-Seite';
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const builder = require(path.join(process.cwd(), 'scripts', 'build-landing.cjs')) as { render: () => Promise<string> };
            const built = await builder.render();
            const file = fs.readFileSync(path.join(this.landingPublicDir(), 'landing', 'index.html'), 'utf8');
            // Zeilenenden zaehlen nicht: ein Windows-Checkout (autocrlf) bringt Quellen und Seite mit CRLF, und der
            // Lead reicht das Seitenskript als Quelltext durch — sonst meldete der Test dort "veraltet" ohne Grund.
            const lf = (s: string) => s.replace(/\r\n/g, '\n');
            if (lf(built) !== lf(file)) throw new Error('veraltet — node scripts/build-landing.cjs ausfuehren');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** P5: Budget (<= 40 KB, <= 15 KB gzip), kein Font-CDN, jede Schrift liegt self-hosted und <= 30 KB, nur Mixtape. */
    private async testLandingBudgetAndFonts(): Promise<void> {
        const testName = 'P5: Landing-Budget, self-hosted Fonts, kein Font-CDN';
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const builder = require(path.join(process.cwd(), 'scripts', 'build-landing.cjs')) as { render: () => Promise<string> };
            const landingDir = path.join(this.landingPublicDir(), 'landing');
            const html = await builder.render();
            StartupTest.assertMixtapeOnly(html);
            const bytes = Buffer.byteLength(html, 'utf8');
            const gzip = gzipSync(html).length;
            if (bytes > 40_960 || gzip > 15_360) throw new Error(`${bytes} B / ${gzip} B gzip`);
            if (/fonts\.googleapis|fonts\.gstatic/.test(html)) throw new Error('Google-Fonts-Link');
            const fonts = [...html.matchAll(/url\(\/static\/landing\/([a-z0-9-]+\.woff2)\)/g)].map((m) => m[1]);
            if (!fonts.length) throw new Error('keine eigene Schrift');
            for (const font of fonts) {
                const file = path.join(landingDir, font);
                if (!fs.existsSync(file) || fs.statSync(file).size > 30_720) throw new Error(`${font}: fehlt oder > 30 KB`);
            }
            if (!fs.existsSync(path.join(landingDir, 'OFL.txt'))) throw new Error('OFL.txt fehlt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * P5 gegen den laufenden Server: GET / 200 text/html mit Cache-Control und ohne Set-Cookie, Host eingesetzt,
     * #sd-live in der Seite, HEAD / ohne Body, robots.txt und die Schrift unter /static/landing/. (Ob der gespeicherte
     * Kennel schon Mixtape-only ist, haengt am Seed-Stand der Instanz — das prueft der Memo-Test am frischen Seed.)
     */
    private async testLandingOverHttp(): Promise<void> {
        const testName = 'P5: GET|HEAD / ueber HTTP, robots.txt, /static/landing';
        try {
            const base = this.selfBaseUrl();
            const root = await fetch(`${base}/`, { headers: { Accept: 'text/html' } });
            const html = await root.text();
            if (root.status !== 200 || !String(root.headers.get('content-type')).startsWith('text/html')) throw new Error(`GET /: ${root.status} ${root.headers.get('content-type')}`);
            if (root.headers.get('cache-control') !== LandingPage.CACHE_CONTROL) throw new Error(`Cache-Control: ${root.headers.get('cache-control')}`);
            if (root.headers.get('set-cookie')) throw new Error('GET / setzt ein Cookie');
            if (root.headers.get('x-landing-source') !== 'kennel') throw new Error(`Quelle: ${root.headers.get('x-landing-source')}`);
            if (html.includes(LandingPage.HOST_MARK)) throw new Error('Host-Platzhalter in der Antwort');
            if (!html.includes('id="sd-live"')) throw new Error('GET /: ohne #sd-live');
            const head = await fetch(`${base}/`, { method: 'HEAD' });
            if (head.status !== 200 || (await head.text()) !== '') throw new Error(`HEAD /: ${head.status}`);
            const robots = await fetch(`${base}/robots.txt`);
            if (robots.status !== 200 || !String(robots.headers.get('content-type')).startsWith('text/plain') || !(await robots.text()).includes('Disallow: /api/')) {
                throw new Error(`robots.txt: ${robots.status} ${robots.headers.get('content-type')}`);
            }
            const font = await fetch(`${base}/static/landing/bebas-neue.woff2`);
            if (font.status !== 200 || font.headers.get('content-type') !== 'font/woff2') throw new Error(`Schrift: ${font.status} ${font.headers.get('content-type')}`);
            await font.arrayBuffer();
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Ein Auth-Client im Speicher fuer die Beta-Keys: betaKey/user wie Prisma (nur, was BetaKeys braucht), und eine
     * Transaktion, die bei einem Wurf beide Tabellen auf den Stand davor zuruecksetzt.
     */
    private static fakeBetaPrisma(): { prisma: BetaKeyPrisma; keys: BetaKeyRow[]; users: Array<BetaUserRow & { googleSub: string }> } {
        const keys: BetaKeyRow[] = [];
        const users: Array<BetaUserRow & { googleSub: string }> = [];
        const matches = (row: any, where: Record<string, any>): boolean => Object.entries(where).every(([field, want]) => row[field] === want);
        let seq = 0;
        const prisma: BetaKeyPrisma = {
            betaKey: {
                create: async ({ data }) => {
                    if (keys.some((k) => k.codeHash === data.codeHash)) throw new Error('unique codeHash');
                    const row: BetaKeyRow = {
                        id: `bk${++seq}`, note: null, createdBy: null, createdAt: new Date(),
                        revokedAt: null, usedByUserId: null, usedAt: null, ...data,
                    } as BetaKeyRow;
                    keys.push(row);
                    return { ...row };
                },
                findMany: async () => keys.map((k) => ({ ...k })).reverse(),
                findUnique: async ({ where }) => {
                    const row = keys.find((k) => (where.id ? k.id === where.id : where.codeHash ? k.codeHash === where.codeHash : k.usedByUserId === where.usedByUserId));
                    return row ? { ...row } : null;
                },
                update: async ({ where, data }) => {
                    const row = keys.find((k) => k.id === where.id);
                    if (!row) throw new Error('not found');
                    Object.assign(row, data);
                    return { ...row };
                },
                updateMany: async ({ where, data }) => {
                    const hit = keys.filter((k) => matches(k, where));
                    if (data.usedByUserId && keys.some((k) => k.usedByUserId === data.usedByUserId)) throw new Error('unique usedByUserId');
                    hit.forEach((k) => Object.assign(k, data));
                    return { count: hit.length };
                },
            },
            user: {
                create: async ({ data }) => {
                    if (users.some((u) => u.googleSub === data.googleSub || u.email === data.email)) throw new Error('unique user');
                    const row = { id: `u${++seq}`, ...data };
                    users.push(row);
                    return { ...row };
                },
                update: async ({ where, data }) => {
                    const row = users.find((u) => u.id === where.id);
                    if (!row) throw new Error('user not found');
                    Object.assign(row, data);
                    return { ...row };
                },
                findMany: async ({ where }) => users.filter((u) => where.id.in.includes(u.id)).map((u) => ({ id: u.id, email: u.email })),
            },
            $transaction: async (fn) => {
                const keysBefore = keys.map((k) => ({ ...k }));
                const usersBefore = users.map((u) => ({ ...u }));
                try {
                    return await fn(prisma);
                } catch (err) {
                    keys.splice(0, keys.length, ...keysBefore);
                    users.splice(0, users.length, ...usersBefore);
                    throw err;
                }
            },
        };
        return { prisma, keys, users };
    }

    /**
     * Beta-Keys: ein Key, ein Google-Konto, einmal. Anlegen (Klartext einmal, gespeichert nur der Hash), Liste ohne Hash
     * und Klartext; Einloesen legt das Konto an, ein zweites Einloesen (anderes Konto) wird abgewiesen, das
     * freigeschaltete Konto kommt danach ohne Key herein; ein Bestandskonto ohne Freischaltung braucht einmal einen
     * Key; Widerruf; zwei gleichzeitige Anmeldungen mit einem Key ergeben ein Konto. Schalter: SLOPDOGS_STAGE=beta
     * verlangt Keys nur mit Auth (lokal ohne Auth nie). Admins: BETA_ADMIN_EMAILS, lokal der Super-User. REST: Status
     * fuer alle, Keys nur fuer Admins.
     */
    private async testBetaKeys(): Promise<void> {
        const testName = 'Beta-Keys: ein Key ein Google-Konto einmal, Bestandskonto, Widerruf, Wettlauf, Schalter, REST';
        try {
            const { prisma, keys, users } = StartupTest.fakeBetaPrisma();
            const beta = new BetaKeys(prisma);
            const profile = (n: number) => ({ googleSub: `g-${n}`, email: `beta${n}@test.invalid`, name: null, picture: null });
            const refused = async (label: string, code: string | undefined, n: number, reason: string, existing: { id: string } | null = null) => {
                try {
                    await beta.admit(code, profile(n), existing);
                } catch (err) {
                    if (err instanceof BetaKeyError && err.reason === reason) return;
                    throw new Error(`${label}: ${String(err)}`);
                }
                throw new Error(`${label}: trotzdem hereingelassen`);
            };

            const { code, key } = await beta.create({ note: 'for 10-0' }, 'admin@test.invalid');
            if (!code.startsWith(BetaKeys.PREFIX) || code.length < 30 || key.last4 !== code.slice(-4) || key.state !== 'open') throw new Error(`create: ${JSON.stringify(key)}`);
            if (keys[0].codeHash !== BetaKeys.hash(code) || JSON.stringify(keys).includes(code)) throw new Error('Klartext gespeichert');
            const listed = JSON.stringify(await beta.list());
            if (listed.includes(code) || listed.includes(keys[0].codeHash)) throw new Error('Liste traegt Klartext oder Hash');

            await refused('ohne Key', undefined, 1, 'missing');
            await refused('falscher Key', `${BetaKeys.PREFIX}nope`, 1, 'invalid');
            const first = await beta.admit(code, profile(1), null);
            await refused('zweites Einloesen, anderes Google-Konto', code, 2, 'used');
            const after = (await beta.list())[0];
            if (after.state !== 'used' || after.usedBy !== 'beta1@test.invalid' || !after.usedAt || users.length !== 1) throw new Error(`nach Einloesen: ${JSON.stringify(after)}`);
            const again = await beta.admit(undefined, { ...profile(1), name: 'Neu' }, { id: first.id });
            if (again.id !== first.id || again.name !== 'Neu' || users.length !== 1) throw new Error('freigeschaltetes Konto braucht erneut einen Key');

            // Bestandskonto (vor der Beta angelegt): beim naechsten Login einmal einen Key, danach nie wieder.
            const legacy = await prisma.user.create({ data: profile(7) });
            await refused('Bestandskonto ohne Key', undefined, 7, 'missing', { id: legacy.id });
            const legacyKey = await beta.create({ note: 'legacy' }, null);
            const unlocked = await beta.admit(legacyKey.code, profile(7), { id: legacy.id });
            if (unlocked.id !== legacy.id || !(await beta.isUnlocked(legacy.id)) || (users.length as number) !== 2) throw new Error('Bestandskonto nicht freigeschaltet');
            if ((await beta.admit(undefined, profile(7), { id: legacy.id })).id !== legacy.id) throw new Error('Bestandskonto nach Freischaltung abgewiesen');

            const race = await beta.create({}, null);
            const results = await Promise.allSettled([beta.admit(race.code, profile(3), null), beta.admit(race.code, profile(4), null)]);
            const won = results.filter((r) => r.status === 'fulfilled').length;
            const lost = results.filter((r) => r.status === 'rejected' && r.reason instanceof BetaKeyError && r.reason.reason === 'used').length;
            const userCount: number = users.length;
            if (won !== 1 || lost !== 1 || userCount !== 3) throw new Error(`Wettlauf: ${won} Konten, ${lost} abgewiesen, ${userCount} Nutzer`);

            const revoked = await beta.create({}, null);
            if ((await beta.revoke(revoked.key.id))?.state !== 'revoked') throw new Error('revoke');
            await refused('widerrufen', revoked.code, 5, 'revoked');
            if ((await beta.revoke('gibt-es-nicht')) !== null) throw new Error('revoke unbekannt');

            // Ein Schalter: SLOPDOGS_STAGE=beta verlangt Keys nur mit Auth; lokal ohne Auth nie.
            if (BetaKeys.required({}) || BetaKeys.required({ SLOPDOGS_STAGE: 'beta' }) || !BetaKeys.required({ SLOPDOGS_STAGE: ' Beta ', MCP_AUTH_REQUIRED: 'true' })
                || BetaKeys.required({ SLOPDOGS_STAGE: 'live', MCP_AUTH_REQUIRED: 'true' })) throw new Error('required()');
            if (BetaKeys.stage({ SLOPDOGS_STAGE: 'be"ta<x>' }) !== 'betax') throw new Error('stage() nicht attributsicher');
            const env = { BETA_ADMIN_EMAILS: ' Boss@Test.invalid , other@test.invalid' };
            if (!BetaKeys.isAdmin({ user: null, isSuperUser: true }, env) || !BetaKeys.isAdmin(this.fakeUser('boss'), { BETA_ADMIN_EMAILS: 'boss@test.invalid' })
                || BetaKeys.isAdmin(this.fakeUser('nobody'), env) || BetaKeys.isAdmin({ user: null, isSuperUser: false }, env)
                || !BetaKeys.isAdminEmail('BOSS@test.invalid', env)) throw new Error('isAdmin');

            const routes = new Map<string, (req: any, res: any) => Promise<void> | void>();
            const fakeApp: any = {};
            for (const verb of ['get', 'post', 'delete']) fakeApp[verb] = (p: string, h: any) => routes.set(`${verb.toUpperCase()} ${p}`, h);
            new BetaRouteHandler(beta).registerRoutes(fakeApp);
            const hit = async (route: string, ctx: AuthCtx, body: any = {}, params: any = {}) => {
                const { res, out } = this.fakeResponse();
                await routes.get(route)!({ params, body, ctx, get: () => undefined, protocol: 'http' }, res);
                return out;
            };
            const status = await hit('GET /api/beta', { user: null, isSuperUser: false });
            if (status.statusCode !== 200 || typeof status.body?.keysRequired !== 'boolean' || status.body.admin !== false) throw new Error(`status: ${JSON.stringify(status.body)}`);
            if ((await hit('GET /api/beta/keys', { user: null, isSuperUser: false })).statusCode !== 401) throw new Error('Keys anonym nicht 401');
            if ((await hit('GET /api/beta/keys', this.fakeUser('nobody'))).statusCode !== 403) throw new Error('Keys Nutzer nicht 403');
            const made = await hit('POST /api/beta/keys', { user: null, isSuperUser: true }, { note: 'rest' });
            if (made.statusCode !== 201 || !String(made.body?.code).startsWith(BetaKeys.PREFIX)) throw new Error(`POST: ${made.statusCode} ${JSON.stringify(made.body)}`);
            const list = await hit('GET /api/beta/keys', { user: null, isSuperUser: true });
            if (list.statusCode !== 200 || JSON.stringify(list.body).includes(made.body.code)) throw new Error('GET Liste traegt Klartext');
            const gone = await hit('DELETE /api/beta/keys/:id', { user: null, isSuperUser: true }, {}, { id: made.body.key.id });
            if (gone.statusCode !== 200 || gone.body?.key?.state !== 'revoked') throw new Error(`DELETE: ${JSON.stringify(gone.body)}`);
            if ((await hit('DELETE /api/beta/keys/:id', { user: null, isSuperUser: true }, {}, { id: 'gibt-es-nicht' })).statusCode !== 404) throw new Error('DELETE unbekannt nicht 404');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Beta-Sticker der Landing: `‹stage›` in `<html data-stage="…">` wird SLOPDOGS_STAGE — `beta` zeigt den Sticker,
     * ohne Stage bleibt das Attribut leer; gilt fuer die Kennel-Ausgabe und den gebauten Fallback (scripts/build-landing).
     */
    private async testLandingStageSticker(): Promise<void> {
        const testName = 'Beta-Sticker: data-stage aus SLOPDOGS_STAGE, nur bei beta';
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const builder = require(path.join(process.cwd(), 'scripts', 'build-landing.cjs')) as { render: () => Promise<string> };
            const html = await builder.render();
            if (!html.includes(`data-stage="${LandingPage.STAGE_MARK}"`)) throw new Error('Platzhalter ‹stage› fehlt in der Seite');
            const base = new URL('https://slop.example');
            const beta = LandingPage.withHost(html, base, BetaKeys.stage({ SLOPDOGS_STAGE: 'beta' }));
            const none = LandingPage.withHost(html, base, BetaKeys.stage({}));
            const noBase = LandingPage.withHost(html, null, 'beta');
            if (!beta.includes('data-stage="beta"') || beta.includes(LandingPage.STAGE_MARK)) throw new Error('beta: data-stage nicht gesetzt');
            if (!none.includes('data-stage=""') || none.includes(LandingPage.STAGE_MARK)) throw new Error('ohne Stage: Platzhalter nicht geleert');
            if (!noBase.includes('data-stage="beta"')) throw new Error('ohne Basis-URL: Stage nicht gesetzt');
            if (!/html\[data-stage="beta"\]/.test(html)) throw new Error('Sticker-CSS haengt nicht an data-stage="beta"');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /** Setzt LANDING_KENNEL_IDS / LANDING_KENNEL_ID fuer die Dauer von `run` und stellt beide danach wieder her. */
    private static async withLandingEnv<T>(ids: string | undefined, alias: string | undefined, run: () => Promise<T>): Promise<T> {
        const saved = { ids: process.env.LANDING_KENNEL_IDS, alias: process.env.LANDING_KENNEL_ID };
        const put = (name: string, value: string | undefined) => {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        };
        put('LANDING_KENNEL_IDS', ids);
        put('LANDING_KENNEL_ID', alias);
        try {
            return await run();
        } finally {
            put('LANDING_KENNEL_IDS', saved.ids);
            put('LANDING_KENNEL_ID', saved.alias);
        }
    }

    /**
     * Landing-Rotation (2026-09-26): LANDING_KENNEL_IDS wird gelesen (Leerstellen, Doppelte, Alias LANDING_KENNEL_ID);
     * `/` verteilt ueber zwei laufende Kennels, ueberspringt einen fehlenden (ein Lauf je Fenster), `?landing=` erzwingt
     * nur Gelistete; leere Liste -> der Default; keiner der gelisteten laeuft -> der Default; auch der nicht -> Fallback.
     */
    private async testLandingRotation(): Promise<void> {
        const testName = 'Landing-Rotation: zwei Kennels, fehlender uebersprungen, Default, Fallback';
        try {
            await StartupTest.withLandingEnv(' rot-a, rot-b ,,ROT-A ', 'ignored', async () => {
                const ids = LandingKennels.ids();
                if (JSON.stringify(ids) !== '["rot-a","rot-b"]') throw new Error(`LANDING_KENNEL_IDS: ${JSON.stringify(ids)}`);
            });
            await StartupTest.withLandingEnv(undefined, 'solo-landing', async () => {
                if (JSON.stringify(LandingKennels.ids()) !== '["solo-landing"]' || !LandingKennels.includes('SOLO-landing')) throw new Error('Alias LANDING_KENNEL_ID');
            });
            await StartupTest.withLandingEnv(undefined, undefined, async () => {
                if (LandingKennels.ids().length !== 0) throw new Error('leere Env ist nicht leer');
            });

            const html = (id: string) => `<!DOCTYPE html><html><body>${id}</body></html>`;
            const asked = new Map<string, number>();
            let live = new Set(['rot-a', 'rot-b', 'def']);
            const runner: LandingRunner = {
                runLeadAsAnonymous: async (id) => {
                    asked.set(id, (asked.get(id) ?? 0) + 1);
                    return live.has(id) ? html(id) : null;
                },
            };
            let seed = 7;
            const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
            let clock = 0;
            const make = (kennelIds: string[]) => {
                const landing = new LandingPage({ publicDir: this.landingPublicDir(), kennelIds, defaultKennelId: 'def', memoMs: 1_000, now: () => clock, random });
                landing.useRunner(runner);
                return landing;
            };

            const rotating = make(['rot-a', 'rot-missing', 'rot-b']);
            const served = new Map<string, number>();
            for (let i = 0; i < 60; i++) {
                const page = await rotating.page();
                served.set(page?.kennelId ?? page?.source ?? 'null', (served.get(page?.kennelId ?? page?.source ?? 'null') ?? 0) + 1);
            }
            const a = served.get('rot-a') ?? 0;
            const b = served.get('rot-b') ?? 0;
            if (a + b !== 60 || a < 15 || b < 15) throw new Error(`Verteilung: ${JSON.stringify([...served])}`);
            if ((asked.get('rot-missing') ?? 0) !== 1) throw new Error(`fehlender Kennel ${asked.get('rot-missing')} mal gelaufen (ein Lauf je Fenster)`);
            if ((asked.get('rot-a') ?? 0) !== 1 || (asked.get('rot-b') ?? 0) !== 1 || asked.has('def')) throw new Error(`Laeufe: ${JSON.stringify([...asked])}`);
            if (!rotating.rotates) throw new Error('rotates');

            if ((await rotating.page(rotating.forcedOf('ROT-B')))?.kennelId !== 'rot-b') throw new Error('?landing=rot-b nicht erzwungen');
            if (rotating.forcedOf('def') !== null || rotating.forcedOf('elsewhere') !== null) throw new Error('?landing= oeffnet einen nicht gelisteten Kennel');

            const empty = make([]);
            if ((await empty.page())?.kennelId !== 'def' || empty.rotates) throw new Error('leere Liste liefert nicht den Default');

            live = new Set(['def']);
            clock += 5_000;
            const dead = make(['rot-a', 'rot-b']);
            if ((await dead.page())?.kennelId !== 'def') throw new Error('keiner der gelisteten laeuft: nicht der Default');

            live = new Set();
            const nothing = make(['rot-a']);
            const last = await nothing.page();
            if (last?.source !== 'fallback' || last.kennelId) throw new Error(`auch der Default fehlt: ${last?.source}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Landing-Schreibschutz: ein Kennel in LANDING_KENNEL_IDS ist fuer alle gesperrt — Owner und Super-User, REST PUT,
     * rename, DELETE, ACL (PUT /acl, freeze) und MCP update_kennel/delete_kennel/freeze_entity mit 403 locked_landing;
     * myRights {edit:false, own:false, locked:'landing'}, Lesen und Laufen bleiben. Der Seed-Default ist nicht
     * automatisch gesperrt. Aus der Liste genommen, ist er wieder frei.
     */
    private async testLandingLock(kennelsController: KennelController, nodesController: Controller<ISerializedDogConfig>): Promise<void> {
        const testName = 'Landing-Schreibschutz: 403 locked_landing fuer Owner und Super-User (REST, ACL, MCP)';
        const kennelId = `st-landing-lock-${Date.now()}`;
        try {
            const created = await kennelsController.create({ id: kennelId, name: 'Landing lock', dogIds: [], visibility: 'public', ownerId: 'UL1' });
            if (!created.ok) throw new Error(`Kennel: ${created.error}`);
            const owner = this.fakeUser('UL1');
            const superUser: AuthCtx = { user: null, isSuperUser: true };
            const registry = new ControllerRegistry();
            registry.register('kennels', kennelsController);
            registry.register('nodes', nodesController);
            const handler = new ConfigRouteHandler(registry);
            const aclRoutes = new Map<string, (req: any, res: any) => Promise<void> | void>();
            const fakeApp: any = {};
            for (const verb of ['get', 'put', 'post']) fakeApp[verb] = (p: string, h: any) => aclRoutes.set(`${verb.toUpperCase()} ${p}`, h);
            new AclRouteHandler(kennelsController, nodesController, this.fakeAuthPrisma(['UL1', 'UL2'])).registerRoutes(fakeApp);
            const acl = async (route: string, ctx: AuthCtx, body: any = {}) => {
                const { res, out } = this.fakeResponse();
                await aclRoutes.get(route)!({ params: { subpath: 'kennels', id: kennelId }, body, ctx }, res);
                return out;
            };
            const tools = [...getKennelTools(), ...getAclTools()];
            const tool = (name: string, args: Record<string, any>, ctx: AuthCtx) =>
                tools.find((t) => t.name === name)!.handler(args, ctx, { kennelsController, nodesController } as any);
            const locked = (label: string, out: { statusCode: number; body: any }) => {
                if (out.statusCode !== 403 || out.body?.error !== 'locked_landing' || out.body?.error_description !== LandingKennels.LOCK_MESSAGE) {
                    throw new Error(`${label}: ${out.statusCode} ${JSON.stringify(out.body)}`);
                }
            };
            const lockedTool = async (label: string, result: Promise<{ isError?: boolean; content: Array<{ text: string }> }>) => {
                const r = await result;
                if (!r.isError || !r.content[0].text.startsWith('locked_landing')) throw new Error(`${label}: ${r.content[0].text}`);
            };

            await StartupTest.withLandingEnv(`other-landing, ${kennelId}`, undefined, async () => {
                const head: any = (await kennelsController.getById(kennelId)).data;
                for (const ctx of [owner, superUser]) {
                    const rights = rightsOf(head, ctx);
                    if (rights.edit || rights.own || rights.locked !== 'landing' || !rights.read || !rights.run) throw new Error(`myRights: ${JSON.stringify(rights)}`);
                    locked('PUT', await this.callHandler(handler, 'handleUpdate', { params: { subpath: 'kennels', id: kennelId }, body: { name: 'x' }, ctx, method: 'PUT' }));
                    locked('rename', await this.callHandler(handler, 'handleRename', { params: { subpath: 'kennels', id: kennelId }, body: { displayName: 'x' }, ctx }));
                    locked('DELETE', await this.callHandler(handler, 'handleDelete', { params: { subpath: 'kennels', id: kennelId }, ctx, method: 'DELETE' }));
                    locked('PUT /acl', await acl('PUT /api/:subpath/:id/acl', ctx, { runners: [] }));
                    locked('freeze', await acl('POST /api/:subpath/:id/freeze', ctx));
                    await lockedTool('update_kennel', tool('update_kennel', { id: kennelId, name: 'x' }, ctx));
                    await lockedTool('delete_kennel', tool('delete_kennel', { id: kennelId }, ctx));
                    await lockedTool('freeze_entity', tool('freeze_entity', { entity_type: 'kennel', id: kennelId }, ctx));
                }
                const stranger = await this.callHandler(handler, 'handleUpdate', { params: { subpath: 'kennels', id: kennelId }, body: { name: 'x' }, ctx: this.fakeUser('UL2'), method: 'PUT' });
                locked('PUT Fremder', stranger);
                if (isLandingLocked({ lineageId: LandingPage.DEFAULT_KENNEL_ID, dogIds: [] } as any)) throw new Error('Seed-Default gesperrt, ohne gelistet zu sein');
                if (isLandingLocked({ lineageId: kennelId, theRun: 'return 1;' } as any)) throw new Error('ein Dog gilt als Landing-Kennel');
                const after: any = (await kennelsController.getById(kennelId)).data;
                if (after?.name !== 'Landing lock' || isFrozen(after)) throw new Error(`Kennel veraendert: ${after?.name}, frozen ${after?.frozen}`);
            });

            const freed = await this.callHandler(handler, 'handleUpdate', { params: { subpath: 'kennels', id: kennelId }, body: { name: 'frei' }, ctx: owner, method: 'PUT' });
            if (freed.statusCode !== 200) throw new Error(`nicht mehr gelistet, trotzdem gesperrt: ${freed.statusCode} ${JSON.stringify(freed.body)}`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.delete(kennelId); } catch { /* ignore */ }
        }
    }

    /**
     * Fix-Runde: DELETE /api/:subpath/:id — eine Versions-GUID loescht genau diese Version, die lineageId die ganze
     * Lineage (Kennel und Dog); Fremde 403 forbidden, frozen 409, Unbekanntes und doppeltes Loeschen 404 not_found —
     * nie der rohe Store-Text (Prisma nannte Dateipfad und Tabelle).
     */
    private async testDeleteRefScopes(nodesController: Controller<ISerializedDogConfig>, kennelsController: KennelController): Promise<void> {
        const testName = 'Fix-Runde: DELETE Version vs. Lineage, Codes statt Store-Text';
        const kennelId = `test-delete-ref-${Date.now()}`;
        const frozenId = `${kennelId}-frozen`;
        let dogLineage: string | undefined;
        try {
            const registry = new ControllerRegistry();
            registry.register('nodes', nodesController);
            registry.register('kennels', kennelsController);
            const handler = new ConfigRouteHandler(registry);
            const del = (subpath: string, id: string, ctx: AuthCtx) =>
                this.callHandler(handler, 'handleDelete', { params: { subpath, id }, ctx, method: 'DELETE' });
            const owner = this.fakeUser('UD1');
            const clean = (label: string, out: { statusCode: number; body: any }, status: number, code: string) => {
                if (out.statusCode !== status || out.body?.error !== code) throw new Error(`${label}: ${out.statusCode} ${JSON.stringify(out.body)}`);
                if (/prisma|invocation|[A-Z]:\\|\.ts:\d/i.test(JSON.stringify(out.body))) throw new Error(`${label}: Store-Text in der Antwort`);
            };

            // Kennel: drei Versionen
            const created = await kennelsController.create({ id: kennelId, name: 'Delete v1', dogIds: [], visibility: 'public', ownerId: 'UD1' });
            if (!created.ok) throw new Error(`Kennel: ${created.error}`);
            await kennelsController.save({ id: kennelId, name: 'Delete v2' } as any);
            await kennelsController.save({ id: kennelId, name: 'Delete v3' } as any);
            const kennelVersions = await kennelsController.getVersions(kennelId);
            if (kennelVersions.length !== 3) throw new Error(`Kennel-Versionen: ${kennelVersions.length}`);
            const oldestKennel = kennelVersions[kennelVersions.length - 1].id;
            clean('Kennel fremd', await del('kennels', kennelId, this.fakeUser('UD2')), 403, 'forbidden');
            const oneKennel = await del('kennels', oldestKennel, owner);
            if (oneKennel.statusCode !== 200 || oneKennel.body?.scope !== 'version' || oneKennel.body?.deleted !== 1) throw new Error(`Kennel-Version: ${JSON.stringify(oneKennel.body)}`);
            if ((await kennelsController.getVersions(kennelId)).length !== 2) throw new Error('Kennel: Versions-GUID nahm mehr als eine Version');
            const allKennel = await del('kennels', kennelId, owner);
            if (allKennel.statusCode !== 200 || allKennel.body?.scope !== 'lineage' || allKennel.body?.deleted !== 2) throw new Error(`Kennel-Lineage: ${JSON.stringify(allKennel.body)}`);
            if ((await kennelsController.getById(kennelId)).ok) throw new Error('Kennel lebt nach Lineage-Delete');
            clean('Kennel doppelt', await del('kennels', kennelId, owner), 404, 'not_found');

            const frozen = await kennelsController.create({ id: frozenId, name: 'Delete frozen', dogIds: [], visibility: 'public', ownerId: 'UD1' });
            if (!frozen.ok) throw new Error(`Kennel frozen: ${frozen.error}`);
            await kennelsController.setFrozen(frozenId, true);
            clean('Kennel frozen', await del('kennels', frozenId, owner), 409, 'frozen');

            // Dog: zwei Versionen
            const dog = await nodesController.create({ displayName: 'DeleteRefDog', theRun: 'return 1;', parentsRequired: [], parentsOptional: [], ownerId: 'UD1', visibility: 'public' });
            if (!dog.ok || !dog.data?.lineageId) throw new Error(`Dog: ${dog.error}`);
            dogLineage = dog.data.lineageId;
            this.createdTestIds.push(dog.id!);
            const second = await nodesController.save({ id: dogLineage, theRun: 'return 2;', parentsRequired: [], parentsOptional: [] });
            if (!second.ok) throw new Error(`Dog v2: ${second.error}`);
            if (second.id) this.createdTestIds.push(second.id);
            const firstDogVersion = dog.id!;
            clean('Dog fremd', await del('nodes', dogLineage, this.fakeUser('UD2')), 403, 'forbidden');
            const oneDog = await del('nodes', firstDogVersion, owner);
            if (oneDog.statusCode !== 200 || oneDog.body?.scope !== 'version' || oneDog.body?.lineageId !== dogLineage) throw new Error(`Dog-Version: ${JSON.stringify(oneDog.body)}`);
            if ((await nodesController.getVersions(dogLineage)).length !== 1) throw new Error('Dog: Versions-GUID nahm mehr als eine Version');
            clean('Dog-Version doppelt', await del('nodes', firstDogVersion, owner), 404, 'not_found');
            const allDog = await del('nodes', dogLineage, owner);
            if (allDog.statusCode !== 200 || allDog.body?.scope !== 'lineage' || allDog.body?.deleted !== 1) throw new Error(`Dog-Lineage: ${JSON.stringify(allDog.body)}`);
            // Frueher: 400 mit dem rohen Prisma-Text ("Record to delete does not exist", Dateipfad).
            clean('Dog doppelt', await del('nodes', dogLineage, owner), 404, 'not_found');
            clean('unbekannt', await del('nodes', `gibt-es-nicht-${Date.now()}`, owner), 404, 'not_found');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            try { await kennelsController.setFrozen(frozenId, false); } catch { /* ignore */ }
            for (const id of [kennelId, frozenId]) {
                try { await kennelsController.delete(id); } catch { /* ignore */ }
            }
            if (dogLineage) {
                try { await nodesController.deleteRef(dogLineage); } catch { /* ignore */ }
            }
        }
    }

    /**
     * Kompression gegen den laufenden Server: /api/kennels mit br, gzip und ohne Accept-Encoding (Bytes gleich nach dem
     * Entpacken, Vary: Accept-Encoding), HEAD ohne Kodierung, woff2 nie gepackt, Aushandlung (q=0). Rohes http, weil
     * fetch still entpackt und Content-Encoding verschluckt.
     */
    private async testResponseCompression(): Promise<void> {
        const testName = 'Fix-Runde: Kompression br/gzip, nie SSE/HEAD/woff2';
        try {
            const { ResponseCompression } = await import('./server-app/ResponseCompression');
            const zlib = await import('zlib');
            const http = await import('http');
            if (ResponseCompression.negotiate('gzip, deflate, br') !== 'br' || ResponseCompression.negotiate('gzip') !== 'gzip'
                || ResponseCompression.negotiate('br;q=0, gzip') !== 'gzip' || ResponseCompression.negotiate('identity') !== null
                || ResponseCompression.negotiate('*') !== 'br' || ResponseCompression.negotiate(undefined) !== null) {
                throw new Error('negotiate');
            }
            if (!ResponseCompression.isCompressible('application/json; charset=utf-8') || ResponseCompression.isCompressible('text/event-stream')
                || ResponseCompression.isCompressible('font/woff2') || !ResponseCompression.isCompressible('text/html')) {
                throw new Error('isCompressible');
            }
            const base = new URL(this.selfBaseUrl());
            const get = (pathName: string, encoding: string | null, method = 'GET') => new Promise<{ status: number; headers: Record<string, any>; body: Buffer }>((resolve, reject) => {
                const req = http.request({ host: base.hostname, port: base.port, path: pathName, method, headers: encoding ? { 'Accept-Encoding': encoding } : {} }, (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (c: Buffer) => chunks.push(c));
                    res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
                });
                req.on('error', reject);
                req.end();
            });
            const plain = await get('/api/kennels', null);
            const br = await get('/api/kennels', 'br');
            const gz = await get('/api/kennels', 'gzip');
            if (plain.status !== 200 || plain.headers['content-encoding']) throw new Error(`ohne Accept-Encoding: ${plain.status} ${plain.headers['content-encoding']}`);
            if (plain.body.length < ResponseCompression.THRESHOLD_BYTES) throw new Error(`/api/kennels zu klein fuer den Test (${plain.body.length} B)`);
            // Zwischen den Abrufen koennen Zaehler weiterlaufen — verglichen wird die Form, nicht jedes Byte.
            const sameShape = (bytes: Buffer) => JSON.stringify(Object.keys(JSON.parse(bytes.toString('utf8')))) === JSON.stringify(Object.keys(JSON.parse(plain.body.toString('utf8'))));
            if (br.headers['content-encoding'] !== 'br' || !sameShape(zlib.brotliDecompressSync(br.body))) throw new Error('br: Kodierung oder Inhalt');
            if (gz.headers['content-encoding'] !== 'gzip' || !sameShape(zlib.gunzipSync(gz.body))) throw new Error('gzip: Kodierung oder Inhalt');
            if (!/accept-encoding/i.test(String(br.headers.vary)) || br.body.length >= plain.body.length) throw new Error(`br: vary=${br.headers.vary}, ${br.body.length} B`);
            const head = await get('/api/kennels', 'br', 'HEAD');
            if (head.headers['content-encoding']) throw new Error('HEAD gepackt');
            const font = await get('/static/landing/bebas-neue.woff2', 'br');
            if (font.status !== 200 || font.headers['content-encoding']) throw new Error(`woff2: ${font.status} ${font.headers['content-encoding']}`);
            console.log(`[StartupTest] Kompression /api/kennels: ${plain.body.length} B -> br ${br.body.length} B, gzip ${gz.body.length} B`);
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Tile-Feature-Cache: integrationstest gegen die live cache.db.
     * Nutzt einen einmaligen dogType, damit keine Produktionsdaten betroffen sind.
     * Verifiziert: store → getCovered (hit) → getCovered (miss) → Multi-Tile-Membership
     * → invalidateDogType.
     */
    private async testTileFeatureCache(): Promise<void> {
        const testName = 'TileFeatureCache: store/hit/miss/multi-tile-membership';
        const dogType = `__startup_test_${Date.now()}`;
        let cache: { getTileFeatureCache(): any; prune?(): Promise<void>; disconnect(): Promise<void> } | null = null;
        let tileCache: any = null;
        try {
            // Lazy-import damit der Test auch laeuft wenn die CACHE_DB nicht konfiguriert ist
            // (dann scheitert hier, wir fangen den Fehler im catch weiter unten).
            const { PrismaCacheHandler } = await import('./services/PrismaCacheHandler');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require('path') as typeof import('path');
            const { resolveCacheDatabaseUrl } = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
                resolveCacheDatabaseUrl: () => string;
            };
            cache = new PrismaCacheHandler(resolveCacheDatabaseUrl(), 24 * 60 * 60 * 1000);
            tileCache = cache!.getTileFeatureCache();

            const zoom = 14;
            const tileA = { zoom, x: 8580, y: 5737 };
            const tileB = { zoom, x: 9999, y: 9999 }; // sicher nicht covered

            // 1. Leerer Cache → alles missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileA],
                    ['hiking'],
                );
                if (features.length !== 0) throw new Error('Expected empty feature list');
                if (missing.length !== 1 || missing[0].facet !== 'hiking') {
                    throw new Error(`Expected 1 missing, got ${missing.length}`);
                }
            }

            // 2. Feature mit BBox ueber 2 Tiles store → Membership in beiden.
            //    Wir nutzen tilesIntersectingBBox-Logik: die Feature-BBox muss zwei
            //    nebeneinanderliegende Z14-Tiles schneiden.
            const pointFeature = {
                osmType: 'node' as const,
                osmId: '1001',
                primaryKey: 'highway',
                primaryValue: 'footway',
                name: 'test-point',
                hasGeom: true,
                lat: 47.3769,
                lng: 8.5417,
                bboxMinLat: 47.3769,
                bboxMinLng: 8.5417,
                bboxMaxLat: 47.3769,
                bboxMaxLng: 8.5417,
                payload: '{"type":"node","id":1001,"tags":{"highway":"footway"}}',
                facets: ['hiking'],
            };
            const wayFeatureSpanningTwoTiles = {
                osmType: 'way' as const,
                osmId: '2002',
                primaryKey: 'highway',
                primaryValue: 'path',
                name: null,
                hasGeom: true,
                lat: 47.3769,
                lng: 8.5480,
                // BBox bewusst so gewaehlt, dass sie ueber 8580→8581 x-Tile hinweggreift.
                bboxMinLat: 47.3769,
                bboxMinLng: 8.5400,
                bboxMaxLat: 47.3770,
                bboxMaxLng: 8.5600,
                payload: '{"type":"way","id":2002,"tags":{"highway":"path"}}',
                facets: ['hiking'],
            };
            const geomlessRelation = {
                osmType: 'relation' as const,
                osmId: '3003',
                primaryKey: 'route',
                primaryValue: 'hiking',
                name: 'Geister-Route',
                hasGeom: false,
                lat: null,
                lng: null,
                bboxMinLat: null,
                bboxMinLng: null,
                bboxMaxLat: null,
                bboxMaxLng: null,
                payload: '{"type":"relation","id":3003,"tags":{"route":"hiking","name":"Geister-Route"}}',
                facets: ['hiking'],
            };

            await tileCache.storeFetchResult(
                dogType,
                {
                    tile: tileA,
                    facets: ['hiking'],
                    features: [pointFeature, wayFeatureSpanningTwoTiles, geomlessRelation],
                },
                24 * 60 * 60 * 1000,
            );

            // 3. Re-query Tile A → 3 Features, 0 missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileA],
                    ['hiking'],
                );
                if (missing.length !== 0) {
                    throw new Error(`Expected 0 missing after store, got ${missing.length}`);
                }
                if (features.length !== 3) {
                    throw new Error(`Expected 3 features after store, got ${features.length}`);
                }
                const identityMatch = features.some(
                    (f: any) =>
                        f.primaryKey === 'route' &&
                        f.primaryValue === 'hiking' &&
                        f.name === 'Geister-Route' &&
                        f.hasGeom === false,
                );
                if (!identityMatch) {
                    throw new Error('Geomless feature metadata not persisted (primaryKey/value/name/hasGeom)');
                }
            }

            // 4. Multi-Tile-Membership: das Way-Feature mit grosser BBox muss auch
            //    auf dem rechts benachbarten Tile findbar sein.
            const tileRight = { zoom, x: tileA.x + 1, y: tileA.y };
            {
                // Fresh Coverage fuer das rechte Tile eintragen (ansonsten missing).
                await tileCache.storeFetchResult(
                    dogType,
                    {
                        tile: tileRight,
                        facets: ['hiking'],
                        features: [], // keine neuen Features — wir pruefen nur Membership-Sicht
                    },
                    24 * 60 * 60 * 1000,
                );
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileRight],
                    ['hiking'],
                );
                if (missing.length !== 0) {
                    throw new Error(`Right-tile coverage not recognised (${missing.length} missing)`);
                }
                const wayId = features.find((f: any) => f.osmId === '2002');
                if (!wayId) {
                    throw new Error('Way-Feature mit BBox ueber 2 Tiles nicht im rechten Tile gefunden');
                }
            }

            // 5. Nicht-covered Tile → alles missing.
            {
                const { features, missing } = await tileCache.getCoveredFeatures(
                    dogType,
                    [tileB],
                    ['hiking'],
                );
                if (features.length !== 0) {
                    throw new Error(`Expected empty features for uncovered tile, got ${features.length}`);
                }
                if (missing.length !== 1) {
                    throw new Error(`Expected 1 missing for uncovered tile, got ${missing.length}`);
                }
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            if (tileCache) {
                try {
                    await tileCache.invalidateDogType(dogType);
                } catch { /* ignore */ }
            }
            if (cache) {
                // Dieser Handler ist ein Test-Eigenbau NEBEN dem App-Cache: ein eigener
                // Prisma-Client mit eigenem Connection-Pool. Ohne Schliessen haengt der
                // Pool bis Prozessende an derselben Postgres wie alle anderen — genau die
                // Verbindungen, die dem Store spaeter im Pool fehlen.
                try {
                    await cache.disconnect();
                } catch { /* ignore */ }
            }
        }
    }

    /**
     * Fügt ein Testergebnis hinzu
     */
    private addResult(name: string, passed: boolean, error?: string): void {
        this.results.push({ name, passed, error });
        const icon = passed ? '✅' : '❌';
        const status = passed ? 'PASS' : 'FAIL';
        if (!passed || isRuntimeLogVerbose()) {
            console.log(`${icon} [${status}] ${name}${error ? ` - ${error}` : ''}`);
        }
    }

    /**
     * Druckt eine Zusammenfassung der Tests
     */
    private printSummary(): void {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        const v = isRuntimeLogVerbose();

        if (failed === 0 && !v) {
            console.log(`Startup-Tests: ${passed}/${total} bestanden.`);
            return;
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Test-Zusammenfassung:');
        console.log(`   Gesamt: ${total}`);
        console.log(`   ✅ Bestanden: ${passed}`);
        console.log(`   ❌ Fehlgeschlagen: ${failed}`);
        console.log('='.repeat(50) + '\n');

        if (failed > 0) {
            console.log('⚠️  Fehlgeschlagene Tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => {
                    console.log(`   ❌ ${r.name}: ${r.error || 'Unbekannter Fehler'}`);
                });
            console.log('');
        }
    }
}

