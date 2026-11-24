/**
 * App-Config und Cache-Speicher (PLAN-CACHE-KONFIG):
 * 1. Vertrag: jeder ICacheStore (RAM, zwei Stufen, der Speicher der laufenden Config) haelt dieselben Regeln —
 *    Ablauf, Ersetzen, touch, Praefix, Gruppen zaehlen/kappen/loeschen, prune.
 * 2. RAM-Stufe: Deckel nach Anzahl und Bytes, gekappte Haltezeit, Text statt Objekt, Leeren bei Speicherdruck.
 * 3. Zwei Stufen: Treffer der zweiten wandert in die erste, Loeschen trifft beide, touch schreibt gedrosselt durch.
 * 4. StoreCacheHandler: getOrFetch buendelt, Negativ-Cache bei 429, auf jedem Speicher.
 * 5. Config-Lader: Weiche je Umgebung, SLOPDOGS_CONFIG, klare Meldung bei falscher Form.
 */
import type { CacheRecord, ICacheStore } from '../../config/cache/ICacheStore';
import { utf8Bytes } from '../../config/cache/ICacheStore';
import { RamCacheStore } from '../../config/cache/RamCacheStore';
import { TieredCacheStore } from '../../config/cache/TieredCacheStore';
import { AppConfigError, AppConfigLoader } from '../../config/loadAppConfig';
import { StoreCacheHandler, type PrunableTileFeatureCache } from '../../services/StoreCacheHandler';
import type { TestResultSink } from './packageCandidates';

/** Ein Tile-Cache, der nichts haelt — die Tests hier pruefen nur den Schluessel-Wert-Teil. */
const NO_TILES = { prune: async () => undefined } as unknown as PrunableTileFeatureCache;

function record(value: unknown, ttlMs: number, extra: Partial<CacheRecord> = {}): CacheRecord {
    const text = JSON.stringify(value);
    const now = Date.now();
    return { value: text, expiresAt: now + ttlMs, sizeBytes: utf8Bytes(text), lastHitAt: now, ...extra };
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export class CacheStoreTests {
    /** Praefix aller Schluessel dieser Tests — in einem echten Speicher nie mit Fremdem verwechselbar. */
    private static readonly PREFIX = 'startup-cachestore:';

    constructor(
        private readonly addResult: TestResultSink,
        /** Der Speicher der laufenden Config (Default: RAM vor Cache-DB) — ohne: nur die Speicher im Prozess. */
        private readonly configured?: ICacheStore,
    ) {}

    async run(): Promise<void> {
        await this.check('Cache-Speicher: Vertrag fuer RAM', () => this.contract(new RamCacheStore(), 'ram'));
        await this.check('Cache-Speicher: Vertrag fuer zwei Stufen (RAM vor RAM)', () =>
            this.contract(new TieredCacheStore(new RamCacheStore(), new RamCacheStore({ maxTtlMs: 60_000 })), 'tiered'),
        );
        if (this.configured) {
            await this.check(`Cache-Speicher: Vertrag fuer den Speicher der Config (${this.configured.name})`, () =>
                this.contract(this.configured!, 'config'),
            );
        }
        await this.check('Cache-Speicher RAM: Deckel Anzahl/Bytes, gekappte Haltezeit, Text statt Objekt, Speicherdruck', () =>
            this.ramCases(),
        );
        await this.check('Cache-Speicher zwei Stufen: Hochziehen, Loeschen in beiden, touch gedrosselt', () => this.tieredCases());
        await this.check('StoreCacheHandler: getOrFetch buendelt, Negativ-Cache bei 429, auf jedem Speicher', () => this.handlerCases());
        await this.check('App-Config: Weiche je Umgebung, SLOPDOGS_CONFIG, Pruefung der Form', () => this.loaderCases());
    }

    private async check(name: string, cases: () => Promise<void>): Promise<void> {
        try {
            await cases();
            this.addResult(name, true);
        } catch (error) {
            this.addResult(name, false, String(error));
        }
    }

    /** Die Regeln, die jeder ICacheStore haelt. */
    private async contract(store: ICacheStore, label: string): Promise<void> {
        const k = (name: string) => `${CacheStoreTests.PREFIX}${label}:${name}`;
        const group = `${CacheStoreTests.PREFIX}${label}:group`;
        try {
            await store.set(k('a'), record({ n: 1 }, 10_000, { meta: { scope: 'anon', infinite: false } }));
            const a = await store.get(k('a'));
            assert(a && JSON.parse(a.value).n === 1, `${label}: get nach set`);
            assert(a.meta?.scope === 'anon' && a.meta?.infinite === false, `${label}: meta verloren (${JSON.stringify(a.meta)})`);

            await store.set(k('a'), record({ n: 2 }, 10_000));
            assert(JSON.parse((await store.get(k('a')))!.value).n === 2, `${label}: ersetzen`);

            await store.set(k('old'), record('x', -1));
            assert((await store.get(k('old'))) === null, `${label}: abgelaufen liefert null`);

            const later = Date.now() + 5_000;
            await store.touch(k('a'), later);
            assert((await store.get(k('a')))!.lastHitAt === later, `${label}: touch setzt lastHitAt`);
            await store.touch(k('missing'), later);
            assert((await store.get(k('missing'))) === null, `${label}: touch legt nichts an`);

            await store.set(k('p:1'), record(1, 10_000));
            await store.set(k('p:2'), record(2, 10_000));
            assert((await store.deleteByPrefix(k('p:'))) === 2, `${label}: deleteByPrefix zaehlt`);
            assert((await store.get(k('p:1'))) === null, `${label}: deleteByPrefix loescht`);

            const base = Date.now();
            for (let i = 0; i < 4; i++) await store.set(k(`g${i}`), record(i, 10_000, { group, lastHitAt: base + i }));
            assert((await store.countGroup(group)) === 4, `${label}: countGroup 4`);
            assert((await store.trimGroup(group, 2)) === 2, `${label}: trimGroup nimmt 2`);
            assert((await store.get(k('g0'))) === null && (await store.get(k('g1'))) === null, `${label}: trimGroup nimmt die aeltesten`);
            assert((await store.get(k('g3'))) !== null, `${label}: trimGroup laesst die juengsten`);
            assert((await store.deleteGroup(group)) === 2, `${label}: deleteGroup zaehlt`);
            assert((await store.countGroup(group)) === 0, `${label}: deleteGroup leert`);

            await store.set(k('short'), record('s', 20));
            await new Promise((r) => setTimeout(r, 40));
            assert((await store.prune(Date.now())) >= 1, `${label}: prune entfernt Abgelaufenes`);

            await store.delete(k('a'));
            assert((await store.get(k('a'))) === null, `${label}: delete`);
        } finally {
            await store.deleteByPrefix(`${CacheStoreTests.PREFIX}${label}:`).catch(() => 0);
            await store.deleteGroup(group).catch(() => 0);
        }
    }

    private async ramCases(): Promise<void> {
        const byCount = new RamCacheStore({ maxEntries: 2 });
        await byCount.set('a', record(1, 10_000));
        await byCount.set('b', record(2, 10_000));
        await byCount.get('a'); // a ist jetzt juenger als b
        await byCount.set('c', record(3, 10_000));
        assert((await byCount.get('b')) === null && (await byCount.get('a')) !== null, 'LRU nach Anzahl: b muss gehen, a bleiben');

        const byBytes = new RamCacheStore({ maxBytes: 20 });
        await byBytes.set('big', record('x'.repeat(40), 10_000));
        assert((await byBytes.get('big')) === null, 'zu grosser Einzeleintrag bleibt draussen');
        await byBytes.set('a', record('aaaaaa', 10_000)); // 8 Bytes
        await byBytes.set('b', record('bbbbbb', 10_000));
        await byBytes.set('c', record('cccccc', 10_000));
        assert(byBytes.usage().bytes <= 20 && (await byBytes.get('a')) === null, `Byte-Deckel: ${JSON.stringify(byBytes.usage())}`);

        const capped = new RamCacheStore({ maxTtlMs: 50 });
        await capped.set('a', record(1, 60_000));
        const stored = await capped.get('a');
        assert(stored && stored.expiresAt <= Date.now() + 50, 'Haltezeit auf maxTtlMs gekappt');

        const ram = new RamCacheStore();
        await ram.set('m', record({ list: [1] }, 10_000, { meta: { scope: 'anon' } }));
        const first = (await ram.get('m'))!;
        first.meta!.scope = 'veraendert';
        assert((await ram.get('m'))!.meta!.scope === 'anon', 'meta eines Treffers veraendert den Speicher nicht');

        let pressure = false;
        const guarded = new RamCacheStore({ underMemoryPressure: () => pressure });
        await guarded.set('a', record(1, 10_000));
        pressure = true;
        await new Promise((r) => setTimeout(r, 1_050)); // Messung hoechstens einmal je Sekunde
        await guarded.set('b', record(2, 10_000));
        assert(guarded.usage().entries === 0, `Speicherdruck leert: ${JSON.stringify(guarded.usage())}`);
    }

    private async tieredCases(): Promise<void> {
        const fast = new RamCacheStore();
        const slow = new RamCacheStore({ maxTtlMs: 600_000 });
        const tiered = new TieredCacheStore(fast, slow, { touchWriteThroughMs: 1_000 });
        assert(tiered.name === 'ram+ram', `Name ${tiered.name}`);

        await slow.set('only-slow', record('s', 60_000));
        assert((await tiered.get('only-slow')) !== null, 'Treffer aus der zweiten Stufe');
        assert((await fast.get('only-slow')) !== null, 'Treffer der zweiten Stufe wandert in die erste');

        await tiered.set('both', record('b', 60_000, { group: 'g' }));
        assert((await fast.get('both')) && (await slow.get('both')), 'set schreibt beide');
        await tiered.deleteGroup('g');
        assert(!(await fast.get('both')) && !(await slow.get('both')), 'deleteGroup trifft beide');

        const t0 = Date.now();
        await tiered.set('t', record('t', 60_000, { lastHitAt: t0 }));
        await tiered.touch('t', t0 + 100);
        assert((await slow.get('t'))!.lastHitAt === t0, 'touch innerhalb der Drossel bleibt in der ersten Stufe');
        assert((await fast.get('t'))!.lastHitAt === t0 + 100, 'touch erreicht die erste Stufe');
        await tiered.touch('t', t0 + 2_000);
        assert((await slow.get('t'))!.lastHitAt === t0 + 2_000, 'touch nach der Drossel erreicht die zweite Stufe');
    }

    private async handlerCases(): Promise<void> {
        const handler = new StoreCacheHandler(new TieredCacheStore(new RamCacheStore(), new RamCacheStore()), NO_TILES, 3_600_000);
        try {
            let calls = 0;
            const slowFetch = async () => {
                calls++;
                await new Promise((r) => setTimeout(r, 20));
                return { ok: true };
            };
            const [a, b] = await Promise.all([handler.getOrFetch('k', 10_000, slowFetch), handler.getOrFetch('k', 10_000, slowFetch)]);
            assert(calls === 1 && a.ok && b.ok, `Buendelung: ${calls} Abrufe`);
            await handler.getOrFetch('k', 10_000, slowFetch);
            assert(calls === 1, 'zweiter Aufruf ist ein Treffer');

            let failures = 0;
            const failing = async () => {
                failures++;
                throw new Error('HTTP 429 Too Many Requests');
            };
            await handler.getOrFetch('neg', 10_000, failing).catch(() => undefined);
            const second = await handler.getOrFetch('neg', 10_000, failing).then(
                () => 'ok',
                (e: Error) => e.message,
            );
            assert(failures === 1 && second.includes('429'), `Negativ-Cache: ${failures} Abrufe, ${second}`);
            assert((await handler.get('neg')) === undefined, 'Negativ-Marker ist fuer get() ein Miss');
        } finally {
            await handler.disconnect();
        }
    }

    private async loaderCases(): Promise<void> {
        const deployed = AppConfigLoader.resolve({}, 'production', false);
        assert(deployed.source === 'config/default.config', `production: ${deployed.source}`);
        assert(AppConfigLoader.resolve({}, 'integration', false).source === 'config/default.config', 'integration: default');
        assert(AppConfigLoader.resolve({}, 'production', true).source === 'config/local.config', 'lokaler Modus: local');
        assert(AppConfigLoader.resolve({}, 'development', false).source === 'config/local.config', 'development: local');
        const own = AppConfigLoader.resolve({ SLOPDOGS_CONFIG: 'meine/redis.config.ts' }, 'production', false);
        assert(own.source === 'meine/redis.config.ts' && own.file.endsWith('redis.config.ts'), `SLOPDOGS_CONFIG: ${own.file}`);

        const bad = (config: unknown): string => {
            try {
                AppConfigLoader.validate(config, 'test');
                return '';
            } catch (err) {
                return err instanceof AppConfigError ? err.message : `falsche Fehlerart: ${String(err)}`;
            }
        };
        const message = bad({ name: 'x', database: () => null, dogs: [1], pacts: [] });
        for (const part of ['cache ist keine Funktion', 'tiles ist keine Funktion', 'dogs enthaelt', 'requireKennelCoverage fehlt']) {
            assert(message.includes(part), `Meldung ohne "${part}": ${message}`);
        }
        assert(bad(null).includes('kein Objekt'), 'null wird abgelehnt');
        const missing = (() => {
            try {
                AppConfigLoader.load({ SLOPDOGS_CONFIG: 'gibt/es/nicht.config' }, 'production', false);
                return '';
            } catch (err) {
                return (err as Error).message;
            }
        })();
        assert(missing.includes('gibt/es/nicht.config') && missing.includes('laden'), `fehlende Datei: ${missing}`);
    }
}
