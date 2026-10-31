import { IStore } from './store/IStore';
import {
    SerializedDog,
    ISerializedDogConfig,
    IKennelConfig,
    isRuntimeLogVerbose,
    DOG_MEMPRESSURE_MARKER,
    DogWorkerGate,
    type MemoryProbe,
} from '@slopdogs/core';
import { Controller } from './api/Controller';
import { AbstractController } from './api/AbstractController';
import { KennelController } from './api/KennelController';
import { LeadOutcome } from './services/LeadOutcome';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { getSnapshotTools } from './mcp/tools/snapshots';
import { getKennelTools } from './mcp/tools/kennels';
import { getNodeTools } from './mcp/tools/nodes';
import { KennelSnapshotCache } from './mcp/snapshots/KennelSnapshotCache';
import type { ToolDeps } from './mcp/tools/types';
import type { AuthCtx } from './mcp/auth/middleware';
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
    applyCreateDefaults,
    type AclEntity,
    type Visibility,
} from './mcp/auth/visibility';
import { KennelCallCounter } from './services/KennelCallCounter';
import { KennelStatsService } from './services/KennelStatsService';
import type { IDogStatsStore, IKennelStatsStore } from './store/IKennelStatsStore';
import { DogStatsService } from './services/DogStatsService';
import { EXPRESS_APP_ROUTES, FRONTEND_ROUTES, LEGACY_ROUTE } from './api/routes/routeTable';
import { KeyStoreService, type KeyStorePrisma } from './services/KeyStoreService';
import { PackageCandidateTests } from './test/startup/packageCandidates';
import { LocalMode } from './server-app/LocalMode';
import { authModeBootError } from './mcp/auth/middleware';
import { AllowedHosts, NetworkBoundary } from './server-app/NetworkBoundary';

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
        readKennelFavoriteIds: async () => [],
        addKennelFavorite: async () => {},
        deleteKennelFavorite: async () => false,
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
     * Fuehrt die Startup-Suite aus (PLAN-DOG-PAKETE P0.1): zuerst den Minimum-Satz im Server, dann die
     * Paket-Kandidaten (`test/startup/packageCandidates.ts`), danach das Aufraeumen der Testdaten.
     * Wirft nicht, wenn ein Test scheitert — das Ergebnis traegt es; `npm run test:startup` macht daraus den Exit-Code.
     */
    async runAllTests(
        nodesStore: IStore,
        kennelsStore: IStore,
        nodesController: Controller<ISerializedDogConfig>,
        kennelsController: AbstractController<IKennelConfig>,
        baseDogsMap: Map<string, any>,
        /** Die fertig montierte Express-App — fuer den Abgleich Routentabelle <-> Stack. */
        app: any,
    ): Promise<TestResult[]> {
        if (isRuntimeLogVerbose()) {
            console.log('\n🧪 Starte Startup-Tests...\n');
        }

        try {
            // Block 1 — Minimum-Satz: erkennt einen kaputten Boot, einen kaputten Kennel-Lauf und eine
            // kaputte Zugriffspruefung. Kein listen, kein Kindprozess, kein externes Netz.
            await this.testBaseDogsAvailability(baseDogsMap);
            await this.testRouteTableMatchesExpressStack(app);
            // P3.5 Rechte v2: NONE < RUN < READ < EDIT < OWN
            await this.testRightsMatrix();
            await this.testPrivateKennelHiddenFromAnon(nodesStore, kennelsController as KennelController, baseDogsMap);
            await this.testRunnerSeesOutputNotCode(nodesStore, kennelsStore, nodesController, kennelsController as KennelController, baseDogsMap);
            await this.testLeadFailureIsNot200(nodesStore, kennelsController as KennelController, baseDogsMap);
            // Spur L: der lokale Modus hat keinen Login — Boot-Guard und Netzgrenze sind dort die Zugriffspruefung.
            this.testLocalModeBootGuard();
            this.testLocalNetworkBoundary(app);

            // Block 2 — Paket-Kandidaten: wandern in P4 als Paket-Tests nach slopdogs-core bzw. slopdogs-base-dogs.
            await new PackageCandidateTests((name, passed, error) => this.addResult(name, passed, error)).run(baseDogsMap);
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

    /** Ein Speicher-Messgeraet fuer Tests: RSS in MB vorgeben, GC zaehlen. */
    private fakeMemoryProbe(rssMb: () => number): { probe: MemoryProbe; gcCalls: () => number } {
        let gc = 0;
        return {
            probe: { rssBytes: () => rssMb() * 1024 * 1024, collectGarbage: () => { gc++; return true; } },
            gcCalls: () => gc,
        };
    }

    /** Env setzen und den alten Stand zurueckgeben (fuer finally). */
    private withEnv(values: Record<string, string>): () => void {
        const previous: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(values)) {
            previous[k] = process.env[k];
            process.env[k] = v;
        }
        return () => {
            for (const [k, v] of Object.entries(previous)) {
                if (v === undefined) delete process.env[k];
                else process.env[k] = v;
            }
        };
    }

    /**
     * Test P9 B1: Ehrlicher Lead-Status auf /k/:id — Lead wirft -> 502 lead_failed (ohne Interna fuer RUN),
     * Speicher-Waechter -> 503 + Retry-After, Lead ohne Wert -> 200 mit JSON null; READ sieht Details.
     * Dazu LeadOutcome direkt und openapi.json bei totem Lead.
     */
    private async testLeadFailureIsNot200(nodesStore: IStore, kennelsController: KennelController, baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'P9 B1: Lead-Fehler -> 502/503 statt 200 mit leerem Rumpf';
        const stamp = Date.now();
        const kennelIds: string[] = [];
        try {
            const runHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, callCounter: this.testCallCounter });
            const anon: AuthCtx = { user: null, isSuperUser: false };
            const makeKennel = async (label: string, theRun: string, visibility: Visibility = 'public'): Promise<string> => {
                const dog = await this.saveAclTestDog(nodesStore, `P9Lead${label}`, theRun, { visibility: 'public', ownerId: 'UO' });
                const id = `test-p9-lead-${label.toLowerCase()}-${stamp}`;
                const created = await kennelsController.create({ id, name: `P9 ${label}`, dogIds: [dog], visibility, ownerId: 'UO' });
                if (!created.ok) throw new Error(`Kennel ${label}: ${created.error}`);
                kennelIds.push(id);
                return id;
            };

            // run-only: Anonyme duerfen ausfuehren, aber nicht lesen — sie duerfen den Fehlertext nicht sehen.
            const throwing = await makeKennel('Throws', 'throw new Error("p9 secret boom");', 'run-only');
            const failed = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: throwing }, ctx: anon });
            if (failed.statusCode !== 502 || failed.body?.error !== 'lead_failed') throw new Error(`Wurf: ${failed.statusCode} ${JSON.stringify(failed.body)}`);
            if (JSON.stringify(failed.body).includes('p9 secret boom')) throw new Error('RUN-Leser sieht den Fehlertext');
            const failedPost = await this.callHandler(runHandler, 'handlePublicPost', { params: { id: throwing }, ctx: anon, method: 'POST', body: {} });
            if (failedPost.statusCode !== 502) throw new Error(`POST Wurf: ${failedPost.statusCode}`);
            const failedRead = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: throwing }, ctx: this.fakeUser('UO') });
            if (failedRead.statusCode !== 502 || !String(failedRead.body?.detail).includes('p9 secret boom')) throw new Error(`READ-Detail: ${JSON.stringify(failedRead.body)}`);
            const failedExec = await this.callHandler(runHandler, 'handleExecute', { params: { id: throwing }, ctx: anon });
            if (failedExec.statusCode !== 502) throw new Error(`/execute Wurf: ${failedExec.statusCode}`);

            const empty = await makeKennel('Empty', 'return null;');
            const nothing = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: empty }, ctx: anon });
            if (nothing.statusCode !== 200 || nothing.body !== 'null') throw new Error(`leerer Lead: ${nothing.statusCode} ${JSON.stringify(nothing.body)}`);

            // Speicher-Waechter: RSS ueber Soft-Limit, kein anderes Isolat -> 503 + Retry-After.
            const restoreGuard = this.withEnv({ MEMORY_GUARD: '1', MEMORY_SOFT_LIMIT_MB: '1', MEMORY_GUARD_GC_MIN_INTERVAL_MS: '0' });
            DogWorkerGate.shared.setMemoryProbe(this.fakeMemoryProbe(() => 999).probe);
            try {
                const ok = await makeKennel('Busy', 'return { fine: true };');
                const busy = await this.callHandler(runHandler, 'handlePublicGet', { params: { id: ok }, ctx: anon });
                if (busy.statusCode !== 503 || busy.body?.reason !== 'memory_pressure' || !busy.headers['retry-after']) {
                    throw new Error(`Waechter: ${busy.statusCode} ${JSON.stringify(busy.body)} ${JSON.stringify(busy.headers)}`);
                }
                const swagger = new KennelSwaggerHandler(runHandler, nodesStore);
                const spec = await this.callHandler(swagger, 'handleSwaggerJson', { params: { id: ok }, ctx: anon });
                if (spec.statusCode !== 503) throw new Error(`openapi.json bei Waechter: ${spec.statusCode}`);
            } finally {
                DogWorkerGate.shared.setMemoryProbe(null);
                restoreGuard();
            }

            // LeadOutcome ohne Season: Waves allein.
            const fromWaves = (waves: any) => LeadOutcome.fromWaves(waves, 'lead');
            if (fromWaves([[{ id: 'lead', result: 1 }]]).status !== 'ok') throw new Error('ok nicht erkannt');
            if (fromWaves([[{ id: 'lead', error: 'x' }]]).status !== 'failed') throw new Error('failed nicht erkannt');
            if (!fromWaves([[{ id: 'lead', error: `a ${DOG_MEMPRESSURE_MARKER} b` }]]).memoryPressure) throw new Error('Speicherdruck nicht erkannt');
            if (fromWaves([[{ id: 'other', result: 1 }]]).status !== 'not_run') throw new Error('not_run nicht erkannt');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        } finally {
            for (const id of kennelIds) {
                try { await kennelsController.delete(id); } catch { /* ignore */ }
            }
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
     * Spur L1: SLOPDOGS_MODE=local startet nur ohne Zeichen eines Deployments. Jede der vier verbotenen
     * Konfigurationen (oeffentliche Basis-URL, Proxy-Hops, Login an, Render) liefert eine Fehlerzeile; die
     * erlaubte Grundform und der Betrieb ohne Schalter liefern keine.
     */
    private testLocalModeBootGuard(): void {
        const testName = 'Spur L1: Boot-Guard lokal verweigert Deployment-Zeichen';
        try {
            const base = { NODE_ENV: 'production', SLOPDOGS_MODE: 'local', PUBLIC_API_BASE_URL: 'http://raspberrypi.local:3000' };
            // Container-Indiz ersetzbar: der Test laeuft auf Rechnern und in der CI, nicht im Container.
            const noContainer = () => null;
            const inContainer = () => '/.dockerenv';
            if (LocalMode.bootError(base, noContainer) !== null) throw new Error(`Grundform abgewiesen: ${LocalMode.bootError(base, noContainer)}`);
            if (LocalMode.bootError({ NODE_ENV: 'production' }, inContainer) !== null) throw new Error('ohne Schalter abgewiesen');
            if (LocalMode.bootError(base, inContainer) === null) throw new Error('Container: nicht abgewiesen');
            if (LocalMode.bootError({ ...base, SLOPDOGS_LOCAL_ALLOW_CONTAINER: '1' }, inContainer) !== null) throw new Error('Container mit Freigabe abgewiesen');
            const forbidden: Record<string, NodeJS.ProcessEnv> = {
                'PUBLIC_API_BASE_URL oeffentlich': { ...base, PUBLIC_API_BASE_URL: 'https://example.com' },
                'TRUST_PROXY_HOPS=1': { ...base, TRUST_PROXY_HOPS: '1' },
                'MCP_AUTH_REQUIRED=true': { ...base, MCP_AUTH_REQUIRED: 'true' },
                'RENDER gesetzt': { ...base, RENDER: 'true' },
            };
            const alsoForbidden: Record<string, NodeJS.ProcessEnv> = {
                'Tippfehler SLOPDOGS_MODE=Local': { ...base, SLOPDOGS_MODE: 'Local' },
                'NODE_ENV=development': { ...base, NODE_ENV: 'development' },
                'LOCAL_ALLOWED_HOSTS oeffentlich': { ...base, LOCAL_ALLOWED_HOSTS: 'raspberrypi.home.arpa,slopdogs.example.com' },
                'MCP_BASE_URL oeffentlich': { ...base, MCP_BASE_URL: 'https://mcp.example.com' },
            };
            for (const [label, env] of Object.entries({ ...forbidden, ...alsoForbidden })) {
                if (LocalMode.bootError(env, noContainer) === null) throw new Error(`${label}: nicht abgewiesen`);
            }
            // Der Auth-Guard laesst production ohne Login nur im lokalen Modus durch — und nie an dessen Guard vorbei.
            if (authModeBootError(base, undefined, noContainer) !== null) throw new Error('authModeBootError weist die lokale Grundform ab');
            if (authModeBootError(forbidden['TRUST_PROXY_HOPS=1'], undefined, noContainer) === null) throw new Error('authModeBootError laesst TRUST_PROXY_HOPS=1 lokal durch');
            if (authModeBootError({ NODE_ENV: 'production' }) === null) throw new Error('authModeBootError laesst production ohne Login durch');
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Spur L2: die Netzgrenze des lokalen Modus, direkt mit Fake-Anfragen (kein listen). Oeffentliche
     * Socket-Adresse, fremder Host-Header und fremde Origin bei POST -> 403; erlaubter Host von privater
     * Adresse -> durch. X-Forwarded-For darf eine oeffentliche Adresse nicht privat machen.
     */
    private testLocalNetworkBoundary(app: any): void {
        const testName = 'Spur L2: Netzgrenze lokal (Socket, Host, Origin)';
        try {
            const system = {
                hostname: () => 'raspberrypi',
                interfaceAddresses: () => ['192.168.1.20', '127.0.0.1', '::1', '2001:db8:1:2::5'],
                interfaceCidrs: () => ['192.168.1.20/24', '2001:db8:1:2::5/64'],
            };
            // Ueber dieselbe Fabrik wie der Server: lokal mit Socket-Pruefung, production ohne Modus keine Grenze.
            const boundary = NetworkBoundary.forEnvironment({ PORT: '3000' }, { nodeEnv: 'production', localMode: true }, system);
            if (!boundary) throw new Error('forEnvironment liefert lokal keine Grenze');
            if (NetworkBoundary.forEnvironment({}, { nodeEnv: 'production', localMode: false }, system) !== null) {
                throw new Error('production ohne lokalen Modus bekommt eine Grenze (Verhalten heute: keine)');
            }
            const call = (req: { method?: string; url?: string; remoteAddress: string; host: string; headers?: Record<string, string> }, b: NetworkBoundary = boundary) => {
                const { res, out } = this.fakeResponse();
                let passed = false;
                const headers: Record<string, string> = { host: req.host, ...(req.headers ?? {}) };
                b.middleware()({ method: req.method ?? 'GET', url: req.url ?? '/', headers, socket: { remoteAddress: req.remoteAddress } } as any, res, () => { passed = true; });
                return { passed, status: out.statusCode, error: out.body?.error, headers: out.headers };
            };
            const crossSite = (dest: string) => ({ 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': dest === 'image' ? 'no-cors' : 'navigate', 'sec-fetch-dest': dest });
            const expectBlocked = (label: string, r: ReturnType<typeof call>, error: string) => {
                if (r.passed || r.status !== 403 || r.error !== error) throw new Error(`${label}: erwartet 403 ${error}, erhalten ${JSON.stringify(r)}`);
            };
            const expectPassed = (label: string, r: ReturnType<typeof call>) => {
                if (!r.passed) throw new Error(`${label}: abgewiesen ${JSON.stringify(r)}`);
            };
            expectBlocked('oeffentliche Socket-Adresse', call({ remoteAddress: '203.0.113.5', host: 'raspberrypi.local:3000', headers: { 'x-forwarded-for': '192.168.1.30' } }), 'client_not_in_lan');
            expectBlocked('Tunnel auf dem Pi (Loopback + Weiterleitungs-Header)', call({ remoteAddress: '127.0.0.1', host: 'localhost:3000', headers: { 'x-forwarded-for': '198.51.100.7' } }), 'proxied_request');
            expectBlocked('fremder Host', call({ remoteAddress: '192.168.1.30', host: 'evil.example:3000' }), 'host_not_allowed');
            expectBlocked('fremde Origin bei POST', call({ method: 'POST', remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000', headers: { origin: 'http://evil.example' } }), 'origin_not_allowed');
            expectBlocked('fremde Seite per GET (img/fetch)', call({ remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000', headers: { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors' } }), 'cross_site');
            expectBlocked('fremde Seite bettet einen Lauf ein (iframe)', call({ url: '/k/slopdogs-landing?x=1', remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000', headers: crossSite('iframe') }), 'cross_site');
            expectBlocked('Cross-Site-Navigation auf die API', call({ url: '/api/kennels/x/run', remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000', headers: crossSite('document') }), 'cross_site');
            expectPassed('Cross-Site-Navigation auf eine UI-Seite', call({ url: '/kennels', remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000', headers: crossSite('document') }));
            expectPassed('globale IPv6 im eigenen On-Link-Praefix', call({ remoteAddress: '2001:db8:1:2::77', host: 'raspberrypi.local:3000' }));
            expectBlocked('globale IPv6 ausserhalb des Praefixes', call({ remoteAddress: '2001:db8:9::1', host: 'raspberrypi.local:3000' }), 'client_not_in_lan');
            const framed = call({ remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000' });
            if (framed.headers['content-security-policy'] !== "frame-ancestors 'self'" || framed.headers['x-frame-options'] !== 'SAMEORIGIN') {
                throw new Error(`Rahmenschutz fehlt: ${JSON.stringify(framed.headers)}`);
            }
            expectPassed('erlaubter Host, private Adresse', call({ remoteAddress: '192.168.1.30', host: 'raspberrypi.local:3000' }));
            expectPassed('LAN-IP als Host, IPv4-mapped', call({ method: 'POST', remoteAddress: '::ffff:10.0.0.4', host: '192.168.1.20:3000', headers: { origin: 'http://192.168.1.20:3000' } }));
            const upgrade = { headers: { host: 'raspberrypi.local:3000', origin: 'http://evil.example' }, socket: { remoteAddress: '192.168.1.30' } };
            if (boundary.admitsUpgrade(upgrade as any)) throw new Error('WebSocket-Upgrade mit fremder Origin angenommen');

            // Dev: dieselbe Host-/Origin-Pruefung, aber keine Socket-Pruefung (heutiges Verhalten im LAN bleibt).
            const dev = NetworkBoundary.forEnvironment({ PORT: '3000' }, { nodeEnv: 'development', localMode: false, devUiOrigin: 'http://localhost:4300' }, system);
            if (!dev) throw new Error('forEnvironment liefert in dev keine Grenze');
            expectPassed('dev: ng-serve-Origin bei POST', call({ method: 'POST', remoteAddress: '203.0.113.5', host: '127.0.0.1:3000', headers: { origin: 'http://localhost:4300' } }, dev));
            expectBlocked('dev: fremder Host', call({ remoteAddress: '127.0.0.1', host: 'evil.example:3000' }, dev), 'host_not_allowed');

            // Die Grenze im montierten Server (test:startup bootet dev) ist die erste eigene Middleware — vor CORS und Routen.
            const stack: any[] = app?.router?.stack ?? app?._router?.stack ?? [];
            const own = stack.filter((layer) => !['query', 'expressInit'].includes(layer?.name));
            if (own[0]?.name !== NetworkBoundary.MIDDLEWARE_NAME) {
                throw new Error(`erste Middleware ist "${own[0]?.name}", nicht ${NetworkBoundary.MIDDLEWARE_NAME}`);
            }
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
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

