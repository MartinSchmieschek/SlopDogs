/**
 * Ergebnis-Cache P2 — die Property `resultCacheTtl` (PLAN-KENNEL-CACHE 3, D9, E5, E6):
 *
 * 1. Form: 0, Sekunden bis zur Obergrenze (KENNEL_RESULT_CACHE_MAX_TTL_SEC) oder "unendlich"; alles andere lesbar
 *    abgelehnt. In der DB zwei Spalten, nach aussen ein Feld.
 * 2. Klasse: rein nimmt unendlich, fluechtig nur Sekunden, live nur 0 — Ablehnung mit Klasse und Gruenden. Eine
 *    Aenderung nur der TTL ist eine neue Version, dieselbe TTL noch einmal keine.
 * 3. Nur der Besitzer: MCP update_kennel und REST PUT weisen einen Editor ab, der die TTL aendert; dieselbe TTL im
 *    vollen Rumpf geht durch. get_kennel zeigt TTL, Klasse, erlaubte Werte und, wenn die Crew strenger wurde, `ruht`.
 */
import express from 'express';
import type { IStore } from '../../store/IStore';
import type { Controller } from '../../api/Controller';
import { KennelController } from '../../api/KennelController';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import { ConfigRouteHandler, ControllerRegistry } from '../../api/routes/ConfigRouteHandler';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getKennelTools } from '../../mcp/tools/kennels';
import type { ToolDeps } from '../../mcp/tools/types';
import { ResultCacheTtl } from '../../services/kennelCache/ResultCacheTtl';
import type { ISerializedDogConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { MiniHttp } from './miniHttp';
import { TestKennels } from './testKennels';
import type { TestResultSink } from './packageCandidates';

export interface KennelResultCacheTtlTestDeps {
    nodesStore: IStore;
    kennelsStore: IStore;
    nodesController: Controller<ISerializedDogConfig>;
    kennelsController: KennelController;
    runHandler: KennelRunHandler;
    toolDeps: ToolDeps;
}

export class KennelResultCacheTtlTests {
    static readonly PURE = 'startup-ttl-pure';
    static readonly FETCHING = 'startup-ttl-fetching';
    static readonly LIVE = 'startup-ttl-live';
    private static readonly OWNER = 'UO';
    private static readonly EDITOR = 'UE';

    constructor(
        private readonly addResult: TestResultSink,
        private readonly deps: KennelResultCacheTtlTestDeps,
    ) {}

    async run(): Promise<void> {
        await this.check('resultCacheTtl: Form 0 | Sekunden bis Obergrenze | "unendlich", sonst lesbar abgelehnt', () => this.formCases());
        const kennels = new TestKennels(this.deps.nodesStore, this.deps.kennelsController);
        this.deps.kennelsController.setResultCacheTtlGate(this.deps.runHandler.cacheClasses);
        try {
            await kennels.removeLeftovers([
                KennelResultCacheTtlTests.PURE,
                KennelResultCacheTtlTests.FETCHING,
                KennelResultCacheTtlTests.LIVE,
            ]);
            await this.check('resultCacheTtl: gegen die Klasse geprueft, gelesen, TTL allein ist neue Version', () =>
                this.classCases(kennels),
            );
            await this.check('resultCacheTtl: nur der Besitzer aendert (MCP, REST), get_kennel zeigt erlaubt/ruht', () =>
                this.ownerCases(kennels),
            );
        } finally {
            this.deps.kennelsController.setResultCacheTtlGate(null);
            await kennels.cleanup();
        }
    }

    private async check(name: string, cases: () => Promise<void> | void): Promise<void> {
        try {
            await cases();
            this.addResult(name, true);
        } catch (error) {
            this.addResult(name, false, String(error));
        }
    }

    private formCases(): void {
        const accepted: unknown[] = [0, null, 60, 604800, 'unendlich'];
        for (const value of accepted) {
            if (!ResultCacheTtl.parse(value).ok) throw new Error(`${JSON.stringify(value)} abgelehnt`);
        }
        const refused: unknown[] = [-1, 1.5, '60', 'forever', 604801, true];
        for (const value of refused) {
            const parsed = ResultCacheTtl.parse(value);
            if (parsed.ok) throw new Error(`${JSON.stringify(value)} angenommen`);
            if (!parsed.error.includes('resultCacheTtl')) throw new Error(`Grund unlesbar: ${parsed.error}`);
        }
        const before = process.env.KENNEL_RESULT_CACHE_MAX_TTL_SEC;
        process.env.KENNEL_RESULT_CACHE_MAX_TTL_SEC = '100';
        try {
            if (ResultCacheTtl.parse(101).ok || !ResultCacheTtl.parse(100).ok) throw new Error('Obergrenze aus der Env greift nicht');
        } finally {
            if (before === undefined) delete process.env.KENNEL_RESULT_CACHE_MAX_TTL_SEC;
            else process.env.KENNEL_RESULT_CACHE_MAX_TTL_SEC = before;
        }
        const columns = ResultCacheTtl.INFINITE.columns;
        if (columns.resultCacheTtlSec !== 0 || columns.resultCacheInfinite !== true) throw new Error('unendlich ohne Schalter-Spalte');
        if (ResultCacheTtl.fromColumns(300, 0).value !== 300 || ResultCacheTtl.fromColumns(null, 1).value !== 'unendlich')
            throw new Error('Spalten nicht zurueckgelesen');
    }

    private async classCases(kennels: TestKennels): Promise<void> {
        const controller = this.deps.kennelsController;
        const owner = KennelResultCacheTtlTests.OWNER;
        const pure = await kennels.codeDog('TtlPure', 'return "<p>pure</p>";');
        const fetching = await kennels.codeDog('TtlFetch', 'return (await fetch("https://example.invalid")).status;');

        const made = await controller.create({
            id: KennelResultCacheTtlTests.PURE,
            name: 'TTL rein',
            dogIds: [pure.lineageId, 'base:QueryRetriever'],
            ownerId: owner,
            editors: KennelResultCacheTtlTests.EDITOR,
            visibility: 'public',
            resultCacheTtl: 'unendlich',
        });
        if (!made.ok) throw new Error(`rein + unendlich: ${made.error}`);
        kennels.track(KennelResultCacheTtlTests.PURE);
        const read = await controller.getById(KennelResultCacheTtlTests.PURE);
        const stored = (read.data as { resultCacheTtl?: unknown } | undefined)?.resultCacheTtl;
        if (stored !== 'unendlich') throw new Error(`gelesen: ${String(stored)}`);

        const refusedInfinite = await controller.create({
            id: KennelResultCacheTtlTests.FETCHING,
            dogIds: [fetching.lineageId],
            ownerId: owner,
            resultCacheTtl: 'unendlich',
        });
        if (refusedInfinite.ok || refusedInfinite.code !== KennelController.TTL_REFUSED || !refusedInfinite.error?.includes('fluechtig'))
            throw new Error(`fluechtig + unendlich: ${JSON.stringify(refusedInfinite)}`);
        if ((await controller.getById(KennelResultCacheTtlTests.FETCHING)).ok) throw new Error('abgelehnter Kennel doch angelegt');
        const seconds = await controller.create({
            id: KennelResultCacheTtlTests.FETCHING,
            dogIds: [fetching.lineageId],
            ownerId: owner,
            resultCacheTtl: 300,
        });
        if (!seconds.ok) throw new Error(`fluechtig + 300: ${seconds.error}`);
        kennels.track(KennelResultCacheTtlTests.FETCHING);

        const live = await controller.create({
            id: KennelResultCacheTtlTests.LIVE,
            dogIds: ['base:JokeRetriever'],
            ownerId: owner,
            resultCacheTtl: 60,
        });
        if (live.ok || !live.error?.includes('live')) throw new Error(`live + 60: ${JSON.stringify(live)}`);

        // D9: nur die TTL geaendert -> neue Version; dieselbe TTL noch einmal -> keine.
        const head = String((await controller.getById(KennelResultCacheTtlTests.FETCHING)).data?.id);
        const changed = await controller.save({ id: KennelResultCacheTtlTests.FETCHING, resultCacheTtl: 120 });
        const nextHead = String(changed.data?.id);
        if (!changed.ok || nextHead === head) throw new Error(`TTL-Aenderung ohne neue Version: ${changed.error}`);
        const same = await controller.save({ id: KennelResultCacheTtlTests.FETCHING, resultCacheTtl: 120 });
        if (String(same.data?.id) !== nextHead) throw new Error('dieselbe TTL hat eine Version erzeugt');
        const again = await controller.save({ id: KennelResultCacheTtlTests.FETCHING, resultCacheTtl: 'unendlich' });
        if (again.ok) throw new Error('fluechtig nimmt beim Aendern unendlich an');
    }

    private async ownerCases(kennels: TestKennels): Promise<void> {
        const id = KennelResultCacheTtlTests.PURE;
        const owner = KennelResultCacheTtlTests.user(KennelResultCacheTtlTests.OWNER);
        const editor = KennelResultCacheTtlTests.user(KennelResultCacheTtlTests.EDITOR);
        const refused = await this.tool('update_kennel', { id, resultCacheTtl: 60 }, editor);
        if (!refused.isError || !refused.text.includes('Only the owner may change resultCacheTtl'))
            throw new Error(`MCP Editor: ${refused.text}`);
        const sameByEditor = await this.tool('update_kennel', { id, name: 'TTL rein 2', resultCacheTtl: 'unendlich' }, editor);
        if (sameByEditor.isError) throw new Error(`MCP Editor, gleiche TTL: ${sameByEditor.text}`);
        const byOwner = await this.tool('update_kennel', { id, resultCacheTtl: 600 }, owner);
        if (byOwner.isError || JSON.parse(byOwner.text).resultCacheTtl !== 600) throw new Error(`MCP Besitzer: ${byOwner.text}`);

        const header = await this.tool('get_kennel', { id }, owner);
        const shown = JSON.parse(header.text);
        if (shown.resultCacheTtl !== 600 || shown.cacheClass?.klasse !== 'rein' || !shown.cacheClass.erlaubt.includes('unendlich'))
            throw new Error(`get_kennel: ${header.text}`);

        // Die Crew wird strenger (neue Dog-Version mit Zufall): die TTL bleibt gespeichert, ruht aber.
        const pureLineage = (await this.deps.kennelsController.getById(id)).data?.dogIds?.[0];
        await kennels.codeDog('TtlPure', 'return Math.random();', { visibility: 'public', ownerId: null }, String(pureLineage));
        const resting = JSON.parse((await this.tool('get_kennel', { id }, owner)).text);
        if (resting.cacheClass?.klasse !== 'live' || !String(resting.cacheClass?.ruht).includes('not allowed'))
            throw new Error(`ruht fehlt: ${JSON.stringify(resting.cacheClass)}`);

        const server = await MiniHttp.start(this.restApp());
        try {
            const as = (userId: string) => ({ [MiniHttp.USER]: userId, accept: 'application/json' });
            const put = await server.request('PUT', `/api/kennels/${id}`, as(KennelResultCacheTtlTests.EDITOR), { resultCacheTtl: 30 });
            if (put.status !== 403 || !put.body.includes('resultCacheTtl')) throw new Error(`REST Editor: ${put.status} ${put.body}`);
            const putSame = await server.request('PUT', `/api/kennels/${id}`, as(KennelResultCacheTtlTests.EDITOR), {
                name: 'TTL rein 3',
                resultCacheTtl: 600,
            });
            if (putSame.status !== 200) throw new Error(`REST Editor, gleiche TTL: ${putSame.status} ${putSame.body}`);
            const putLive = await server.request('PUT', `/api/kennels/${id}`, as(KennelResultCacheTtlTests.OWNER), { resultCacheTtl: 30 });
            const body = JSON.parse(putLive.body || '{}');
            if (putLive.status !== 400 || body.error !== KennelController.TTL_REFUSED)
                throw new Error(`REST live: ${putLive.status} ${putLive.body}`);
            const postBad = await server.request('POST', '/api/kennels', as(KennelResultCacheTtlTests.OWNER), {
                id: KennelResultCacheTtlTests.LIVE,
                dogIds: [],
                resultCacheTtl: 'forever',
            });
            if (postBad.status !== 400 || !postBad.body.includes(KennelController.TTL_REFUSED))
                throw new Error(`REST POST Form: ${postBad.status} ${postBad.body}`);
        } finally {
            await server.close();
        }
    }

    private restApp(): express.Application {
        const registry = new ControllerRegistry();
        registry.register('nodes', this.deps.nodesController);
        registry.register('kennels', this.deps.kennelsController);
        const app = express();
        app.use(express.json());
        app.use(MiniHttp.identity());
        new ConfigRouteHandler(registry, this.deps.kennelsStore).registerRoutes(app, '/api');
        return app;
    }

    private async tool(name: string, args: Record<string, unknown>, ctx: AuthCtx): Promise<{ isError: boolean; text: string }> {
        const tool = getKennelTools().find((t) => t.name === name);
        if (!tool) throw new Error(`Werkzeug ${name} fehlt`);
        const result = await tool.handler(args, ctx, this.deps.toolDeps);
        return { isError: Boolean(result.isError), text: String(result.content[0]?.text ?? '') };
    }

    private static user(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false };
    }
}
