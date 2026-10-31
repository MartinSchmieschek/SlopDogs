import {
    IKennelConfig,
    Dog,
    IHuntingDog,
    createPact,
    MimicDog,
    IMimicDogConfig,
    KennelRun,
    type ChannelState,
} from '@martinschmieschek/slopdogs-core';
import { TypeDefBuilder } from '../../services/TypeDefBuilder';
import { CompilerCache } from '../../services/CompilerCache';
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput, NearbyLandmarksPact } from '@martinschmieschek/slopdogs-dogs-geo';

/** Nimmt ein Testergebnis entgegen — die Sammlung und Ausgabe besitzt StartupTest. */
export type TestResultSink = (name: string, passed: boolean, error?: string) => void;

/**
 * Paket-Kandidaten (PLAN-DOG-PAKETE P0.1): StartupTests, die keinen Store, Controller oder
 * Handler brauchen und in P4 als Paket-Tests in die Paket-Repos wandern. Bis dahin laufen sie
 * als zweiter Block der Startup-Suite mit (`npm run test:startup` und RUN_STARTUP_TESTS).
 *
 * Ziel je Test (steht zusaetzlich an jedem Test):
 * - slopdogs-core (P4.1): testCreatePact, testMimicDogImitatesPact, testMatchesParentRecognizesMimic,
 *   5x testFillKennel*, testRunSeasonWithMimicConsumerRuns, testLobbyFollowsInvitation,
 *   testAutoCreatedBodyRetrieverCarriesBody
 * - slopdogs-base-dogs (P4.2): testTalkingDogAllDependenciesResolved (dogs-talking),
 *   testPactFromSourceType (dogs-geo; Typanteil nach P2.1)
 */
export class PackageCandidateTests {
    constructor(private readonly addResult: TestResultSink) {}

    /**
     * Laesst alle Kandidaten in der Reihenfolge der alten Suite laufen; jeder Test faengt seine
     * Fehler selbst und meldet sie an den Sink. Ohne Markierung: -> slopdogs-core.
     */
    async run(baseDogsMap: Map<string, any>): Promise<void> {
        await this.testPactFromSourceType(); // -> slopdogs-base-dogs
        await this.testCreatePact();
        await this.testMimicDogImitatesPact(baseDogsMap);
        await this.testMatchesParentRecognizesMimic(baseDogsMap);
        await this.testFillKennelAutoMimicForPact(baseDogsMap);
        await this.testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap);
        await this.testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap);
        await this.testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap);
        await this.testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap);
        await this.testRunSeasonWithMimicConsumerRuns(baseDogsMap);
        await this.testTalkingDogAllDependenciesResolved(baseDogsMap); // -> slopdogs-base-dogs
        // Lobby: die Einladung (?channelId=) kommt an -- auch ohne ausdruecklichen QueryRetriever
        await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever']);
        await this.testLobbyFollowsInvitation(baseDogsMap, ['base:WebSocketChannelRetriever', 'base:QueryRetriever']);
        await this.testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap);
    }

    /**
     * Test: Pact mit fromSourceType — CompilerCache liefert Typ-String, TypeDefBuilder/ MimicDog-Kontext enthält erwartete Symbole.
     *
     * Ziel in P4: slopdogs-base-dogs (P4.2, dogs-geo): Pact-Typen aus der eigenen dist/type-defs.json (P2.1); der CompilerCache-/TypeDefBuilder-Teil bleibt im Server.
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
                ]),
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

    // ===== Pact & MimicDog Tests =====

    /**
     * Test: createPact erzeugt gueltige Dog-Klasse
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
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
                    exhausted: [],
                    withBeesInThePants: [],
                    maxRuns: 0,
                    runIndex: 0,
                    wave: [],
                    readTracking: [],
                    currentWaveIndex: 0,
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
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
                get name() {
                    return 'ConsumerDog';
                }
                get required() {
                    return [TestPact];
                }
                get optional() {
                    return [];
                }
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
                currentWaveIndex: 0,
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
                currentWaveIndex: 0,
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testFillKennelAutoMimicForPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Auto-Mimic bei Pact';
        try {
            const AutoPact = createPact<number>('AutoMimicTestPact');

            class NeedyDog extends Dog<void> {
                get name() {
                    return 'NeedyDog';
                }
                get required() {
                    return [AutoPact];
                }
                get optional() {
                    return [];
                }
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

            const hasMimic = kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'AutoMimicTestPact');

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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testFillKennelNoAutoMimicForOptionalOnlyPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: optional-only Pact bekommt KEINEN Mimic';
        try {
            const OptionalPact = createPact<string>('OptionalMimicTestPact');

            class OptionalConsumerDog extends Dog<void> {
                get name() {
                    return 'OptionalConsumerDog';
                }
                get required() {
                    return [] as (new (...args: any[]) => IHuntingDog<unknown>)[];
                }
                get optional() {
                    return [OptionalPact];
                }
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

            const hasMimic = kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptionalMimicTestPact');

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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testFillKennelAutoMimicOnlyForRequiredPact(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic nur fuer required, nicht fuer optional';
        try {
            const ReqPact = createPact<number>('ReqMimicTestPact');
            const OptPact = createPact<string>('OptMimicTestPact2');

            class DualConsumerDog extends Dog<void> {
                get name() {
                    return 'DualConsumerDog';
                }
                get required() {
                    return [ReqPact];
                }
                get optional() {
                    return [OptPact];
                }
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

            const hasReqMimic = kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'ReqMimicTestPact');
            const hasOptMimic = kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptMimicTestPact2');

            if (!hasReqMimic) {
                throw new Error('MimicDog fuer required Pact fehlt');
            }
            if (hasOptMimic) {
                throw new Error('Fuer den optional-only Pact wurde ein Mimic erzeugt -- verletzt den Welle-10-Vertrag');
            }

            const mimicCount = kennel.filter((d) => d instanceof MimicDog).length;
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testFillKennelRealBaseDogInsteadOfMimic(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Echter BaseDog statt Mimic';
        try {
            class RealProvider extends Dog<string> {
                get name() {
                    return 'RealProvider';
                }
                get required() {
                    return [];
                }
                get optional() {
                    return [];
                }
                protected yieldCollectorFactory = async () => 'data';
            }

            class RealConsumer extends Dog<void> {
                get name() {
                    return 'RealConsumer';
                }
                get required() {
                    return [RealProvider];
                }
                get optional() {
                    return [];
                }
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

            const hasReal = kennel.some((d) => d instanceof RealProvider);
            const hasMimic = kennel.some((d) => d instanceof MimicDog);

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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testFillKennelMimicRemovedWhenRealDogPresent(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'fillKennel: Mimic entfernt wenn echter Dog da';
        try {
            const PriorityPact = createPact<string>('PriorityTestPact');

            class PriorityConsumer extends Dog<void> {
                get name() {
                    return 'PriorityConsumer';
                }
                get required() {
                    return [PriorityPact];
                }
                get optional() {
                    return [];
                }
                protected yieldCollectorFactory = async () => {};
            }

            class RealPriorityDog extends PriorityPact {
                get name() {
                    return 'RealPriorityDog';
                }
                get required() {
                    return [] as (new (...args: any[]) => IHuntingDog<unknown>)[];
                }
                get optional() {
                    return [] as (new (...args: any[]) => IHuntingDog<unknown>)[];
                }
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

            const mimicCount = kennel.filter((d) => d instanceof MimicDog).length;
            const realCount = kennel.filter((d) => d instanceof RealPriorityDog).length;

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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testRunSeasonWithMimicConsumerRuns(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'runSeason: Consumer laeuft mit Mimic in spaeterer Wave';
        try {
            const RunPact = createPact<{ v: number }>('RunTestPact');

            class RunConsumerDog extends Dog<number> {
                get name() {
                    return 'RunConsumerDog';
                }
                get required() {
                    return [RunPact];
                }
                get optional() {
                    return [] as (new (...args: any[]) => IHuntingDog<unknown>)[];
                }
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

            const consumerInWaves = season.wave.some((wave) => wave.some((entry) => entry.instance.name === 'RunConsumerDog'));
            if (!consumerInWaves) {
                throw new Error('RunConsumerDog ist in keiner Wave erschienen');
            }

            const consumerDog = season.exhausted.find((d) => d.name === 'RunConsumerDog');
            if (!consumerDog || consumerDog.collected !== 42) {
                throw new Error(`Consumer collected erwartet: 42, erhalten: ${consumerDog?.collected}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }

    /**
     * Test: TalkingDog — alle Dependencies (required Pacts + optional BaseDogs) werden aufgeloest
     *
     * Ziel in P4: slopdogs-base-dogs (P4.2, dogs-talking): braucht nur KennelRun/MimicDog aus core und dogs-demo als Peer.
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

            const talkingDog = kennel.find((d) => d.name === 'TalkingDog');
            if (!talkingDog) {
                throw new Error('TalkingDog nicht im Kennel');
            }

            const requiredClasses = (talkingDog as any).required as any[];
            const optionalClasses = (talkingDog as any).optional as any[];
            const allDeps = [...requiredClasses, ...optionalClasses];

            const missing: string[] = [];
            for (const depClass of allDeps) {
                const isPact = (depClass as any).__isPact === true;
                const fulfilled = kennel.some((d) => {
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

            const hasMimicForPact = kennel.some(
                (d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'LayoutInputProvider',
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testLobbyFollowsInvitation(baseDogsMap: Map<string, any>, dogIds: string[]): Promise<void> {
        const testName = `Lobby folgt ?channelId= (dogIds: ${dogIds.join(', ')})`;
        try {
            const lobby = async (query?: Record<string, string>): Promise<ChannelState> => {
                const kennelRun = new KennelRun({ id: 'test-lobby-kennel', dogIds }, baseDogsMap, undefined, query);
                const season = await kennelRun.run();
                const lobbyDog = season.exhausted.find((d) => d.name === 'WebSocketChannelRetriever');
                if (!lobbyDog) throw new Error('WebSocketChannelRetriever ist nicht gelaufen');
                return lobbyDog.collected as ChannelState;
            };

            const first = await lobby();
            const second = await lobby();
            if (!first.channelId || !second.channelId || first.channelId === second.channelId) {
                throw new Error(
                    `Ohne Query erwartet: zwei verschiedene zufaellige Lobbys, erhalten: ${first.channelId} / ${second.channelId}`,
                );
            }
            if (first.channelQuery !== `?channelId=${encodeURIComponent(first.channelId)}`) {
                throw new Error(`channelQuery fehlt bei frischer Lobby: ${first.channelQuery}`);
            }

            const invited = await lobby({ channelId: 'abc' });
            if (invited.channelId !== 'abc') {
                throw new Error(`Mit ?channelId=abc erwartet: abc, erhalten: ${invited.channelId}`);
            }
            if (invited.channelParam !== 'channelId' || invited.channelQuery !== '?channelId=abc') {
                throw new Error(
                    `Einladung falsch weitergereicht: channelParam=${invited.channelParam}, channelQuery=${invited.channelQuery}`,
                );
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
     *
     * Ziel in P4: slopdogs-core (P4.1): prueft nur core-Mechanik mit testlokalen Dogs.
     */
    private async testAutoCreatedBodyRetrieverCarriesBody(baseDogsMap: Map<string, any>): Promise<void> {
        const testName = 'autoMimic: ergaenzter BodyRetriever traegt den Body';
        try {
            const BodyRetrieverClass = baseDogsMap.get('BodyRetriever');
            if (!BodyRetrieverClass) throw new Error('BodyRetriever fehlt in der Registry');

            class BodyConsumerDog extends Dog<unknown> {
                get name() {
                    return 'BodyConsumerDog';
                }
                get required() {
                    return [BodyRetrieverClass];
                }
                get optional() {
                    return [] as (new (...args: any[]) => IHuntingDog<unknown>)[];
                }
                protected yieldCollectorFactory = async (season: any) =>
                    season.exhausted.find((d: any) => d.name === 'BodyRetriever')?.collected;
            }

            const extendedMap = new Map(baseDogsMap);
            extendedMap.set('BodyConsumerDog', BodyConsumerDog);

            const body = { frage: 'Wer war das?', runde: 3 };
            const config: IKennelConfig = { id: 'test-body-kennel', dogIds: ['base:BodyConsumerDog'] };
            const season = await new KennelRun(config, extendedMap, undefined, undefined, body).run();

            const consumer = season.exhausted.find((d) => d.name === 'BodyConsumerDog');
            if (JSON.stringify(consumer?.collected) !== JSON.stringify(body)) {
                throw new Error(`Body erwartet: ${JSON.stringify(body)}, erhalten: ${JSON.stringify(consumer?.collected)}`);
            }

            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
    }
}
