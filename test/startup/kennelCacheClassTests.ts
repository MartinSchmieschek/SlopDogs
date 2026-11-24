/**
 * Ergebnis-Cache P1 — Cache-Klassen (PLAN-KENNEL-CACHE 2.2):
 *
 * 1. Code eigener Dogs: der TypeScript-Syntaxbaum entscheidet, nicht ein Textfund — `fetch` im Kommentar oder String
 *    ist kein Abruf, ein lokales `keys` kein Key-Store. Zufall ist `live`, Uhr und Abruf `fluechtig`, jsonStore/keys
 *    `persoenlich`; das Urteil wird je Version gemerkt.
 * 2. Base-Dogs: statisches `cacheClass` vor der Ausweichtabelle; Pflicht-Eltern (autoMimic) zaehlen mit.
 * 3. Kennel: die strengste Klasse mit Gruenden, eine neue Dog-Version aendert sie; die Code-Fundstelle eines Dogs sieht
 *    nur, wer ihn lesen darf; get_kennel zeigt die Klasse Lesern, nicht RUN-Lesern; create/update/build_kennel melden sie.
 */
import type { IStore } from '../../store/IStore';
import type { KennelController } from '../../api/KennelController';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getKennelTools } from '../../mcp/tools/kennels';
import type { ToolDeps } from '../../mcp/tools/types';
import { DogCodeAnalysis, DogCodeCacheClassifier } from '../../services/kennelCache/DogCodeCacheClassifier';
import { BaseDogCacheClasses } from '../../services/kennelCache/BaseDogCacheClasses';
import type { CacheClass } from '../../services/kennelCache/CacheClass';
import { TestKennels } from './testKennels';
import type { TestResultSink } from './packageCandidates';

export interface KennelCacheClassTestDeps {
    nodesStore: IStore;
    kennelsController: KennelController;
    runHandler: KennelRunHandler;
    baseDogsMap: Map<string, new () => unknown>;
    toolDeps: ToolDeps;
}

export class KennelCacheClassTests {
    static readonly KENNEL = 'startup-cache-class';
    static readonly BUILT = 'startup-cache-class-built';
    private static readonly OWNER = 'UO';
    private static readonly STRANGER = 'U9';

    constructor(
        private readonly addResult: TestResultSink,
        private readonly deps: KennelCacheClassTestDeps,
    ) {}

    async run(): Promise<void> {
        await this.check('Cache-Klasse: Dog-Code ueber den Syntaxbaum (fetch, Uhr, Zufall, jsonStore/keys, je Version gemerkt)', () =>
            this.codeCases(),
        );
        await this.check('Cache-Klasse: Base-Dogs per cacheClass vor Ausweichtabelle, Pflicht-Eltern zaehlen mit', () =>
            this.baseDogCases(),
        );
        await this.check(
            'Cache-Klasse: Kennel strengste Klasse mit Gruenden, Fundstelle nur fuer Leser, in get/create/update/build_kennel',
            () => this.kennelCases(),
        );
    }

    private async check(name: string, cases: () => Promise<void> | void): Promise<void> {
        try {
            await cases();
            this.addResult(name, true);
        } catch (error) {
            this.addResult(name, false, String(error));
        }
    }

    private codeCases(): void {
        const expectations: Array<[string, CacheClass]> = [
            ['return 1 + 1;', 'rein'],
            ['// fetch("https://x")\nreturn "fetch(nothing)";', 'rein'],
            ['const keys = Object.keys({ a: 1 }); return keys.length;', 'rein'],
            ['const o = { jsonStore: 1, Date: 2 }; return o.jsonStore;', 'rein'],
            ['const r = await fetch("https://example.invalid"); return r.status;', 'fluechtig'],
            ['return new Date().toISOString();', 'fluechtig'],
            ['return Date.now();', 'fluechtig'],
            ['return globalThis["fe" + "tch"];', 'fluechtig'],
            ['return await jsonStore.get("k");', 'persoenlich'],
            ['const r = await keys.fetch("https://x/{{key:a}}"); return r.status;', 'persoenlich'],
            ['return Math.random();', 'live'],
            ['return crypto.randomUUID();', 'live'],
            ['const a = await fetch("https://x"); return [a, Math.random(), await jsonStore.get("k")];', 'live'],
            // Browser-Code: nur als Text ausgeliefert, laeuft nie auf dem Server (Landing, Kennel-Liste).
            ['function f() { return fetch("/api/health"); } return String(f);', 'rein'],
            ['var live = function () { Math.random(); }; return "<script>(" + live + ")();</script>";', 'rein'],
            ['function f() { return Date.now(); } return f.toString();', 'rein'],
            ['return "<script>(" + String(function () { return Date.now(); }) + ")()</script>";', 'rein'],
            ['return `(${() => Math.random()})()`;', 'rein'],
            ['function f(n) { return n ? f(n - 1) + Math.random() : 0; } return String(f);', 'rein'],
            // ... aber jede andere Nutzung macht ihn zu Server-Code.
            ['function f() { return fetch("x"); } const s = String(f); return f();', 'fluechtig'],
            ['function f() { return Math.random(); } return [1].map(f) + String(f);', 'live'],
            ['function f() { return Math.random(); } return "x" + f();', 'live'],
            ['function f() { return fetch("x"); } { const f = 1; } return String(f);', 'fluechtig'],
        ];
        for (const [code, expected] of expectations) {
            const verdict = DogCodeAnalysis.of(code);
            if (verdict.klasse !== expected) throw new Error(`${JSON.stringify(code)}: ${verdict.klasse}, erwartet ${expected}`);
        }
        const line = DogCodeAnalysis.of('const a = 1;\nconst b = 2;\nreturn fetch("https://x");').detail;
        if (line !== 'fetch, Zeile 3') throw new Error(`Fundstelle: ${line}`);

        const memo = new DogCodeCacheClassifier();
        memo.classify('v1', 'return Math.random();');
        if (memo.classify('v1', 'return 1;').klasse !== 'live') throw new Error('Urteil je Version nicht gemerkt');
        if (memo.classify('v2', 'return 1;').klasse !== 'rein') throw new Error('neue Version nicht neu bewertet');
    }

    private baseDogCases(): void {
        const registry = new BaseDogCacheClasses(this.deps.baseDogsMap);
        const expect = (name: string, klasse: CacheClass) => {
            const got = registry.classOf(name);
            if (got.klasse !== klasse) throw new Error(`${name}: ${got.klasse} (${got.detail}), erwartet ${klasse}`);
        };
        expect('QueryRetriever', 'rein');
        expect('BodyRetriever', 'rein');
        expect('JokeRetriever', 'live');
        expect('WebSocketChannelRetriever', 'live');
        expect('NoSuchBaseDog', 'fluechtig');
        const expanded = registry.expand(['CountryFlagBlackLab']);
        if (!expanded.includes('RandomRecipesRetriever')) throw new Error(`Pflicht-Eltern fehlen: ${expanded.join(', ')}`);

        class DeclaredPure {
            static cacheClass = 'rein';
        }
        const declared = new BaseDogCacheClasses(new Map<string, new () => unknown>([['JokeRetriever', DeclaredPure]]));
        const own = declared.classOf('JokeRetriever');
        if (own.klasse !== 'rein' || own.detail !== 'cacheClass') throw new Error(`cacheClass ueberstimmt nicht: ${JSON.stringify(own)}`);
    }

    private async kennelCases(): Promise<void> {
        const { nodesStore, kennelsController, runHandler } = this.deps;
        const id = KennelCacheClassTests.KENNEL;
        const kennels = new TestKennels(nodesStore, kennelsController);
        try {
            await kennels.removeLeftovers([id, KennelCacheClassTests.BUILT]);
            const owner = KennelCacheClassTests.OWNER;
            const pure = await kennels.codeDog('CachePure', 'return "<p>pure</p>";');
            const fetching = await kennels.codeDog('CacheFetch', 'const r = await fetch("https://example.invalid");\nreturn r.status;', {
                visibility: 'private',
                ownerId: owner,
            });
            await kennels.kennel({
                id,
                name: 'Cache Klasse',
                dogIds: [pure.lineageId, fetching.lineageId, 'base:QueryRetriever'],
                visibility: 'run-only',
                ownerId: owner,
            });

            const classes = runHandler.cacheClasses;
            const first = await classes.classify({ dogIds: [pure.lineageId, fetching.lineageId, 'base:QueryRetriever'] });
            if (first.klasse !== 'fluechtig') throw new Error(`Kennel: ${first.klasse} ${first.gruende.join(' | ')}`);
            if (!first.gruende.some((g) => g.includes('CacheFetch') && g.includes('fetch, Zeile 1')))
                throw new Error(`Grund fehlt: ${first.gruende.join(' | ')}`);
            const stranger = first.redactedFor(KennelCacheClassTests.user(KennelCacheClassTests.STRANGER));
            if (stranger.gruende.some((g) => g.includes('Zeile')))
                throw new Error(`Fundstelle fuer Fremde: ${stranger.gruende.join(' | ')}`);
            if (stranger.klasse !== 'fluechtig') throw new Error('Redaktion aendert die Klasse');

            // Eine neue Version des reinen Dogs mit Zufall: die Lineage-Referenz zieht sie, der Kennel wird live.
            await kennels.codeDog('CachePure', 'return Math.random();', { visibility: 'public', ownerId: null }, pure.lineageId);
            const second = await classes.classify({ dogIds: [pure.lineageId, fetching.lineageId] });
            if (second.klasse !== 'live') throw new Error(`neue Dog-Version: ${second.klasse}`);
            // Gepinnt bleibt die alte Version.
            const pinned = await classes.classify({ dogIds: [pure.versionId] });
            if (pinned.klasse !== 'rein') throw new Error(`gepinnte Version: ${pinned.klasse} ${pinned.gruende.join(' | ')}`);
            // Pflicht-Eltern eines Base-Dogs zaehlen: CountryFlagBlackLab zieht RandomRecipesRetriever (live).
            const flags = await classes.classify({ dogIds: ['base:CountryFlagBlackLab'] });
            if (flags.klasse !== 'live' || !flags.gruende.some((g) => g.startsWith('RandomRecipesRetriever')))
                throw new Error(`Pflicht-Eltern: ${flags.klasse} ${flags.gruende.join(' | ')}`);

            await this.toolCases(id, kennels);
        } finally {
            await kennels.cleanup();
        }
    }

    private async toolCases(id: string, kennels: TestKennels): Promise<void> {
        const deps = this.deps.toolDeps;
        const ownerCtx = KennelCacheClassTests.user(KennelCacheClassTests.OWNER);
        const strangerCtx = KennelCacheClassTests.user(KennelCacheClassTests.STRANGER);
        const call = async (tool: string, args: Record<string, unknown>, ctx: AuthCtx) => {
            const result = await this.tool(tool).handler(args, ctx, deps);
            if (result.isError) throw new Error(`${tool}: ${result.content[0]?.text}`);
            return JSON.parse(result.content[0].text);
        };
        const read = await call('get_kennel', { id }, ownerCtx);
        if (read.cacheClass?.klasse !== 'live') throw new Error(`get_kennel Leser: ${JSON.stringify(read.cacheClass)}`);
        const runOnly = await call('get_kennel', { id }, strangerCtx);
        if ('cacheClass' in runOnly) throw new Error('get_kennel zeigt RUN-Lesern die Cache-Klasse');

        const updated = await call('update_kennel', { id, dogIds: ['base:QueryRetriever'] }, ownerCtx);
        if (updated.cacheClass?.klasse !== 'rein') throw new Error(`update_kennel: ${JSON.stringify(updated.cacheClass)}`);

        const built = await call(
            'build_kennel',
            {
                id: KennelCacheClassTests.BUILT,
                name: 'Cache Klasse gebaut',
                refresh: false,
                dogs: [{ displayName: `CacheBuilt${Date.now()}`, tsCode: 'return new Date().toISOString();' }],
            },
            ownerCtx,
        );
        kennels.track(KennelCacheClassTests.BUILT);
        for (const dog of built.dogs ?? []) await kennels.trackDog(dog.lineageId);
        if (built.cacheClass?.klasse !== 'fluechtig') throw new Error(`build_kennel: ${JSON.stringify(built.cacheClass)}`);
        await this.deps.kennelsController.delete(KennelCacheClassTests.BUILT);
        const created = await call('create_kennel', { id: KennelCacheClassTests.BUILT, dogIds: ['base:JokeRetriever'] }, ownerCtx);
        if (created.cacheClass?.klasse !== 'live') throw new Error(`create_kennel: ${JSON.stringify(created.cacheClass)}`);
    }

    private tool(name: string) {
        const tool = getKennelTools().find((t) => t.name === name);
        if (!tool) throw new Error(`Werkzeug ${name} fehlt`);
        return tool;
    }

    private static user(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false };
    }
}
