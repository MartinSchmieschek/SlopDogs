/**
 * Paket-Tests von slopdogs-core (PLAN-DOG-PAKETE P0.1 -> P4.1): die 11 Startup-Tests, die nur core-Mechanik
 * pruefen, aus `test/startup/packageCandidates.ts` des Servers — dort laufen sie gegen die volle Base-Dog-Registry,
 * hier gegen die Plattform-Dogs aus core (QueryRetriever, BodyRetriever, Lobby) und testlokale Dogs. Was sie
 * pruefen, ist unveraendert; nur die Ausgabe laeuft ueber node:test statt ueber den Sink der Startup-Suite.
 *
 * Importiert wird ueber den Paketnamen (Selbstreferenz ueber `exports`, siehe tsconfig.test.json), also gegen
 * dist/ — die Einstiege, die Server und Dog-Pakete installieren.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Dog, IHuntingDog, IHuntingSeason, createPact } from '@martinschmieschek/slopdogs-core';
import {
    BodyRetriever,
    ChannelLiveSnippetRetriever,
    IKennelConfig,
    IMimicDogConfig,
    KennelRun,
    MimicDog,
    QueryRetriever,
    WebSocketChannelRetriever,
    type ChannelPeer,
    type ChannelState,
    type IChannelHub,
} from '@martinschmieschek/slopdogs-core/runtime';

// Wie `required`/`optional` in core: Konstruktoren mit beliebigen Argumenten (eslint-suppressions.json duldet dort dasselbe).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DogClass = new (...args: any[]) => IHuntingDog<unknown>;

/** Ein Hub ohne Netz: haelt nur, welche Lobbys es gibt (der echte lebt im Server, services/ChannelHub.ts). */
class InMemoryChannelHub implements IChannelHub {
    private readonly channels = new Map<string, ChannelPeer[]>();
    newChannelId(): string {
        return randomUUID().slice(0, 8);
    }
    joinOrCreate(channelId: string): { created: boolean; peers: ChannelPeer[] } {
        const existing = this.channels.get(channelId);
        if (existing) return { created: false, peers: existing };
        this.channels.set(channelId, []);
        return { created: true, peers: [] };
    }
    snapshot(channelId: string): ChannelPeer[] {
        return this.channels.get(channelId) ?? [];
    }
    heartbeatSec(): number {
        return 20;
    }
    wsPath(): string {
        return '/api/channels';
    }
}

WebSocketChannelRetriever.initService(new InMemoryChannelHub());

/** Die Plattform-Dogs aus core, unter ihrem Namen — so baut der Server seine baseDogsMap (main.ts). */
function platformDogs(): Map<string, DogClass> {
    const map = new Map<string, DogClass>();
    for (const C of [QueryRetriever, BodyRetriever, WebSocketChannelRetriever, ChannelLiveSnippetRetriever] as DogClass[]) {
        map.set(new C().name, C);
    }
    return map;
}

const emptySeason = () => ({
    exhausted: [] as IHuntingDog<unknown>[],
    withBeesInThePants: [] as IHuntingDog<unknown>[],
    maxRuns: 0,
    runIndex: 0,
    wave: [],
    readTracking: [],
    currentWaveIndex: 0,
});

test('Pact: createPact erzeugt gueltige Dog-Klasse', async () => {
    const TestPact = createPact<{ value: number }>('TestPact');
    assert.equal(TestPact.name, 'TestPact');
    assert.equal((TestPact as unknown as { __isPact?: boolean }).__isPact, true);
    const instance = new TestPact();
    assert.ok(instance instanceof Dog, 'Instanz ist kein instanceof Dog');
    assert.equal(instance.name, 'TestPact');
    await assert.rejects(() => instance.collectYield(emptySeason()), /requires a MimicDog/);
});

test('MimicDog: imitiert Pact-Klasse', () => {
    const TestPact = createPact<{ v: number }>('MimicTestPact');
    const map = new Map(platformDogs()).set('MimicTestPact', TestPact);
    const mimic = new MimicDog<{ v: number }>({ theRun: 'return { v: 42 };', imitates: 'MimicTestPact' }, 'test-mimic-1');
    mimic.resolveImitates(map);
    assert.ok(mimic.imitatesClasses.includes(TestPact), 'imitatesClasses enthaelt nicht die Pact-Klasse');
    assert.equal(mimic.imitatesName, 'MimicTestPact');
});

test('MimicDog: matchesParent erkennt Mimic', () => {
    const TestPact = createPact<string>('MatchTestPact');
    const map = new Map(platformDogs()).set('MatchTestPact', TestPact);
    const mimic = new MimicDog<string>({ theRun: 'return "hello";', imitates: 'MatchTestPact' }, 'test-mimic-match');
    mimic.resolveImitates(map);

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
    const season = {
        ...emptySeason(),
        maxRuns: 2,
        exhausted: [mimic as IHuntingDog<unknown>],
        withBeesInThePants: [consumer as IHuntingDog<unknown>],
    };
    assert.ok(consumer.isReady(season), 'Consumer sollte ready sein, wenn der Mimic in exhausted ist');
    const without = { ...emptySeason(), maxRuns: 2, withBeesInThePants: [consumer as IHuntingDog<unknown>] };
    assert.ok(!consumer.isReady(without), 'Consumer sollte ohne Mimic NICHT ready sein');
});

test('fillKennel: Auto-Mimic bei Pact', async () => {
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
    const map = new Map(platformDogs()).set('NeedyDog', NeedyDog).set('AutoMimicTestPact', AutoPact);
    const kennel = await new KennelRun({ id: 'test-auto-mimic-kennel', dogIds: ['base:NeedyDog'] }, map).fillKennel();
    assert.ok(
        kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'AutoMimicTestPact'),
        'MimicDog wurde nicht automatisch erstellt',
    );
});

test('fillKennel: optional-only Pact bekommt KEINEN Mimic', async () => {
    const OptionalPact = createPact<string>('OptionalMimicTestPact');
    class OptionalConsumerDog extends Dog<void> {
        get name() {
            return 'OptionalConsumerDog';
        }
        get required() {
            return [] as DogClass[];
        }
        get optional() {
            return [OptionalPact];
        }
        protected yieldCollectorFactory = async () => {};
    }
    const map = new Map(platformDogs()).set('OptionalConsumerDog', OptionalConsumerDog).set('OptionalMimicTestPact', OptionalPact);
    const kennel = await new KennelRun({ id: 'test-optional-mimic-kennel', dogIds: ['base:OptionalConsumerDog'] }, map).fillKennel();
    assert.ok(
        !kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'OptionalMimicTestPact'),
        'Fuer einen optional-only Pact wurde ein Mimic erzeugt — verletzt den Welle-10-Vertrag',
    );
});

test('fillKennel: Mimic nur fuer required, nicht fuer optional', async () => {
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
    const map = new Map(platformDogs())
        .set('DualConsumerDog', DualConsumerDog)
        .set('ReqMimicTestPact', ReqPact)
        .set('OptMimicTestPact2', OptPact);
    const kennel = await new KennelRun({ id: 'test-dual-mimic-kennel', dogIds: ['base:DualConsumerDog'] }, map).fillKennel();
    const imitated = (name: string) => kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === name);
    assert.ok(imitated('ReqMimicTestPact'), 'MimicDog fuer required Pact fehlt');
    assert.ok(!imitated('OptMimicTestPact2'), 'Fuer den optional-only Pact wurde ein Mimic erzeugt');
    assert.equal(kennel.filter((d) => d instanceof MimicDog).length, 1, 'genau 1 Mimic erwartet (nur der required)');
});

test('fillKennel: Echter BaseDog statt Mimic', async () => {
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
    const map = new Map(platformDogs()).set('RealConsumer', RealConsumer).set('RealProvider', RealProvider);
    const kennel = await new KennelRun({ id: 'test-real-basedog-kennel', dogIds: ['base:RealConsumer'] }, map).fillKennel();
    assert.ok(
        kennel.some((d) => d instanceof RealProvider),
        'Echter BaseDog wurde nicht hinzugefuegt',
    );
    assert.ok(!kennel.some((d) => d instanceof MimicDog), 'MimicDog sollte fuer eine echte Klasse nicht entstehen');
});

test('fillKennel: Mimic entfernt wenn echter Dog da', async () => {
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
            return [] as DogClass[];
        }
        get optional() {
            return [] as DogClass[];
        }
        protected yieldCollectorFactory = async () => 'real data';
    }
    const map = new Map(platformDogs())
        .set('PriorityConsumer', PriorityConsumer)
        .set('PriorityTestPact', PriorityPact)
        .set('RealPriorityDog', RealPriorityDog);
    const config: IKennelConfig = { id: 'test-priority-kennel', dogIds: ['base:PriorityConsumer', 'base:RealPriorityDog'] };
    const kennel = await new KennelRun(config, map).fillKennel();
    assert.equal(kennel.filter((d) => d instanceof MimicDog).length, 0, 'Mimic sollte entfernt sein, da ein echter Dog da ist');
    assert.equal(kennel.filter((d) => d instanceof RealPriorityDog).length, 1, 'genau 1 echter Dog erwartet');
});

test('runSeason: Consumer laeuft mit Mimic in spaeterer Wave', async () => {
    const RunPact = createPact<{ v: number }>('RunTestPact');
    class RunConsumerDog extends Dog<number> {
        get name() {
            return 'RunConsumerDog';
        }
        get required() {
            return [RunPact];
        }
        get optional() {
            return [] as DogClass[];
        }
        protected yieldCollectorFactory = async (season: IHuntingSeason) => {
            const provider = season.exhausted.find((d) => this.matchesParent(RunPact, d));
            return (provider?.collected as { v?: number } | undefined)?.v ?? -1;
        };
    }
    const map = new Map(platformDogs()).set('RunConsumerDog', RunConsumerDog).set('RunTestPact', RunPact);
    const mimicConfig: IMimicDogConfig = { theRun: 'return { v: 42 };', imitates: 'RunTestPact' };
    const mimic = new MimicDog<{ v: number }>(mimicConfig, 'run-test-mimic');
    mimic.resolveImitates(map);
    const consumer = new RunConsumerDog();
    const kennel: IHuntingDog<unknown>[] = [mimic, consumer];
    mimic.setKennelRef(kennel);

    const season = await new KennelRun({ id: 'test-run-mimic-kennel', dogIds: [] }, map).runSeason(kennel);
    assert.ok(season.wave.length >= 2, `mindestens 2 Waves erwartet, gefunden: ${season.wave.length}`);
    assert.ok(
        season.wave.some((wave) => wave.some((entry) => entry.instance.name === 'RunConsumerDog')),
        'RunConsumerDog ist in keiner Wave erschienen',
    );
    assert.equal(season.exhausted.find((d) => d.name === 'RunConsumerDog')?.collected, 42);
});

for (const dogIds of [['base:WebSocketChannelRetriever'], ['base:WebSocketChannelRetriever', 'base:QueryRetriever']]) {
    test(`Lobby folgt ?channelId= (dogIds: ${dogIds.join(', ')})`, async () => {
        const lobby = async (query?: Record<string, string>): Promise<ChannelState> => {
            const season = await new KennelRun({ id: 'test-lobby-kennel', dogIds }, platformDogs(), undefined, query).run();
            const lobbyDog = season.exhausted.find((d) => d.name === 'WebSocketChannelRetriever');
            assert.ok(lobbyDog, 'WebSocketChannelRetriever ist nicht gelaufen');
            return lobbyDog.collected as ChannelState;
        };
        const first = await lobby();
        const second = await lobby();
        assert.ok(
            first.channelId && second.channelId && first.channelId !== second.channelId,
            'ohne Query: zwei verschiedene Lobbys erwartet',
        );
        assert.equal(first.channelQuery, `?channelId=${encodeURIComponent(first.channelId)}`);
        const invited = await lobby({ channelId: 'abc' });
        assert.equal(invited.channelId, 'abc');
        assert.equal(invited.channelParam, 'channelId');
        assert.equal(invited.channelQuery, '?channelId=abc');
    });
}

test('autoMimic: ergaenzter BodyRetriever traegt den Body', async () => {
    const map = platformDogs();
    const BodyRetrieverClass = map.get('BodyRetriever');
    assert.ok(BodyRetrieverClass, 'BodyRetriever fehlt in der Registry');
    class BodyConsumerDog extends Dog<unknown> {
        get name() {
            return 'BodyConsumerDog';
        }
        get required() {
            return [BodyRetrieverClass!];
        }
        get optional() {
            return [] as DogClass[];
        }
        protected yieldCollectorFactory = async (season: IHuntingSeason) =>
            season.exhausted.find((d) => d.name === 'BodyRetriever')?.collected;
    }
    map.set('BodyConsumerDog', BodyConsumerDog);
    const body = { frage: 'Wer war das?', runde: 3 };
    const season = await new KennelRun({ id: 'test-body-kennel', dogIds: ['base:BodyConsumerDog'] }, map, undefined, undefined, body).run();
    assert.deepEqual(season.exhausted.find((d) => d.name === 'BodyConsumerDog')?.collected, body);
});
