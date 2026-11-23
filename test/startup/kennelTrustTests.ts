/**
 * Vertrauensweg gepflegter Kennels (04.11.), zwei Regeln, je ein Ergebnis:
 *
 * 1. Kopfversion: eine gepflegte Kennel-Seite laeuft unter `/k/` nur dann ohne Sandbox, wenn die ausgelieferte Version
 *    die Kopfversion ihrer Lineage ist — gleich, ob per lineageId, per Versions-GUID im Pfad oder per `?version=`
 *    adressiert. Jede aeltere Version bekommt die Sandbox-CSP. Ueber HTTP: Mini-Express auf Port 0 mit SecurityHeaders
 *    und den echten `/k/`-Routen des KennelRunHandler.
 * 2. Anlegen: eine gepflegte Kennel-ID (LandingKennels.isProtected) legt nur ein Maintainer an — REST POST /api/kennels,
 *    MCP create_kennel und build_kennel, POST /api/kennels/import. Alle anderen bekommen 403 `locked_landing` mit
 *    LandingKennels.LOCK_MESSAGE. Der Seed beim Boot legt die gepflegten Kennels weiter an.
 *
 * Globaler Zustand (LANDING_KENNEL_IDS, SLOPDOGS_MAINTAINER_EMAILS, Sperrmenge) wird im finally zurueckgelegt.
 */
import express from 'express';
import type { IStore } from '../../store/IStore';
import type { Controller } from '../../api/Controller';
import type { KennelController } from '../../api/KennelController';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import { ConfigRouteHandler, ControllerRegistry } from '../../api/routes/ConfigRouteHandler';
import { KennelBundleHandler } from '../../api/routes/KennelBundleHandler';
import { SecurityHeaders } from '../../server-app/SecurityHeaders';
import { LandingKennels } from '../../mcp/auth/landingKennels';
import { Maintainers } from '../../mcp/auth/maintainers';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getKennelTools } from '../../mcp/tools/kennels';
import type { ToolDeps } from '../../mcp/tools/types';
import { SLOPDOGS_KENNELS_KENNEL_ID } from '../../seed-data/kennels/slopdogs-kennels';
import type { ISerializedDogConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { MiniHttp, type MiniReply } from './miniHttp';
import { TestKennels } from './testKennels';
import type { TestResultSink } from './packageCandidates';

export interface KennelTrustTestDeps {
    nodesStore: IStore;
    kennelsStore: IStore;
    nodesController: Controller<ISerializedDogConfig>;
    kennelsController: KennelController;
    runHandler: KennelRunHandler;
    baseDogsMap: Map<string, new () => unknown>;
    toolDeps: ToolDeps;
}

export class KennelTrustTests {
    static readonly HEAD_KENNEL = 'startup-trust-head';
    static readonly CREATE_KENNEL = 'startup-trust-create';
    private static readonly MAINTAINER = 'UM';
    private static readonly STRANGER = 'U9';

    constructor(
        private readonly addResult: TestResultSink,
        private readonly deps: KennelTrustTestDeps,
    ) {}

    async run(): Promise<void> {
        const lockedBefore = LandingKennels.lockedDogsSnapshot();
        const env = { landing: process.env.LANDING_KENNEL_IDS, maintainers: process.env[Maintainers.ENV] };
        try {
            await this.check('Haertung: gepflegte Kennel-Seite ohne Sandbox nur in der Kopfversion (Pfad-GUID, ?version=)', () =>
                this.headVersionCases(),
            );
            await this.check('Haertung: gepflegte Kennel-ID legt nur ein Maintainer an (REST, MCP, Import; Seed bleibt)', () =>
                this.createCases(),
            );
        } finally {
            LandingKennels.setLockedDogs(lockedBefore);
            KennelTrustTests.restoreEnv('LANDING_KENNEL_IDS', env.landing);
            KennelTrustTests.restoreEnv(Maintainers.ENV, env.maintainers);
        }
    }

    private async check(name: string, cases: () => Promise<void>): Promise<void> {
        try {
            await cases();
            this.addResult(name, true);
        } catch (error) {
            this.addResult(name, false, String(error));
        }
    }

    private async headVersionCases(): Promise<void> {
        const id = KennelTrustTests.HEAD_KENNEL;
        process.env.LANDING_KENNEL_IDS = id;
        const kennels = new TestKennels(this.deps.nodesStore, this.deps.kennelsController);
        const app = express();
        app.use(new SecurityHeaders().middleware());
        app.use(MiniHttp.identity());
        this.deps.runHandler.registerRoutes(app);
        const server = await MiniHttp.start(app);
        try {
            await kennels.removeLeftovers([id]);
            const dog = await kennels.htmlDog('StartupTrustPage', '<!doctype html><html><body>trust-page</body></html>');
            const first = await kennels.kennel({ id, name: 'Trust v1', dogIds: [dog], visibility: 'public', ownerId: null });
            const saved = await this.deps.kennelsController.save({ id, name: 'Trust v2' });
            const headVersion = saved.ok && saved.data ? saved.data.id : null;
            if (!headVersion || headVersion === first.versionId) throw new Error(`zweite Version nicht angelegt: ${saved.error}`);

            const sandboxed = async (path: string): Promise<boolean> => {
                const reply = await server.request('GET', path, { accept: 'text/html' });
                if (reply.status !== 200 || !reply.body.includes('trust-page'))
                    throw new Error(`${path}: ${reply.status} ${reply.body.slice(0, 120)}`);
                return /\bsandbox\b/.test(String(reply.headers['content-security-policy'] ?? ''));
            };
            const expectations: Array<[string, boolean]> = [
                [`/k/${id}`, false],
                [`/k/${headVersion}`, false],
                [`/k/${id}?version=${headVersion}`, false],
                [`/k/${first.versionId}`, true],
                [`/k/${id}?version=${first.versionId}`, true],
            ];
            for (const [path, expected] of expectations) {
                if ((await sandboxed(path)) !== expected) throw new Error(`${path}: Sandbox ${expected ? 'fehlt' : 'gesetzt'}`);
            }
        } finally {
            await server.close();
            await kennels.cleanup();
        }
    }

    private async createCases(): Promise<void> {
        const id = KennelTrustTests.CREATE_KENNEL;
        process.env.LANDING_KENNEL_IDS = id;
        process.env[Maintainers.ENV] = `${KennelTrustTests.MAINTAINER.toLowerCase()}@test.invalid`;
        const kennels = new TestKennels(this.deps.nodesStore, this.deps.kennelsController);
        kennels.track(id);
        const server = await MiniHttp.start(this.restApp());
        try {
            await kennels.removeLeftovers([id]);
            const asUser = (userId: string) => ({ [MiniHttp.USER]: userId, accept: 'application/json' });
            const create = (userId: string) => server.request('POST', '/api/kennels', asUser(userId), { id, name: 'Curated', dogIds: [] });
            const importAs = (userId: string, name: string) =>
                server.request('POST', '/api/kennels/import', asUser(userId), {
                    importTarget: { kennelId: id, name },
                    kennel: { dogIds: [] },
                    dogs: [],
                });
            const stamp = Date.now();

            KennelTrustTests.expectLocked('REST', await create(KennelTrustTests.STRANGER));
            KennelTrustTests.expectLocked('Import', await importAs(KennelTrustTests.STRANGER, `Curated import ${stamp}`));
            const strangerCtx = KennelTrustTests.user(KennelTrustTests.STRANGER);
            for (const [tool, args] of KennelTrustTests.toolCalls(id)) {
                const refused = await this.tool(tool).handler(args, strangerCtx, this.deps.toolDeps);
                if (
                    !refused.isError ||
                    !refused.content[0]?.text.startsWith(`${LandingKennels.LOCK_CODE}: ${LandingKennels.LOCK_MESSAGE}`)
                ) {
                    throw new Error(`${tool} fuer Nicht-Maintainer: ${JSON.stringify(refused)}`);
                }
            }
            if ((await this.deps.kennelsController.getById(id)).ok) throw new Error('abgewiesenes Anlegen hat den Kennel doch angelegt');

            const maintainerCtx = KennelTrustTests.user(KennelTrustTests.MAINTAINER);
            const made = await create(KennelTrustTests.MAINTAINER);
            if (made.status !== 200) throw new Error(`REST fuer Maintainer: ${made.status} ${made.body}`);
            await this.expectCreatedThenDelete(id, 'REST');
            const imported = await importAs(KennelTrustTests.MAINTAINER, `Curated import ${stamp}`);
            if (imported.status !== 200) throw new Error(`Import fuer Maintainer: ${imported.status} ${imported.body}`);
            await this.expectCreatedThenDelete(id, 'Import');
            for (const [tool, args] of KennelTrustTests.toolCalls(id)) {
                const result = await this.tool(tool).handler(args, maintainerCtx, this.deps.toolDeps);
                if (result.isError) throw new Error(`${tool} fuer Maintainer: ${result.content[0]?.text}`);
                const built = JSON.parse(result.content[0].text) as { dogs?: Array<{ lineageId: string }> };
                for (const dog of built.dogs ?? []) await kennels.trackDog(dog.lineageId);
                await this.expectCreatedThenDelete(id, tool);
            }

            // Der Seed beim Boot schreibt direkt in den Store: die gepflegten Kennels stehen.
            for (const seeded of [LandingKennels.DEFAULT_KENNEL_ID, SLOPDOGS_KENNELS_KENNEL_ID]) {
                if ((await this.deps.kennelsStore.findByLineage('KennelConfig', seeded)).length === 0)
                    throw new Error(`Seed ${seeded} fehlt`);
            }
        } finally {
            await server.close();
            await kennels.cleanup();
        }
    }

    /** REST-Anlegen und Import wie im Server: Import vor `/api/:subpath`. */
    private restApp(): express.Application {
        const { nodesController, kennelsController, kennelsStore, runHandler, nodesStore, baseDogsMap } = this.deps;
        const registry = new ControllerRegistry();
        registry.register('nodes', nodesController);
        registry.register('kennels', kennelsController);
        const app = express();
        app.use(express.json());
        app.use(MiniHttp.identity());
        new KennelBundleHandler(runHandler, kennelsController, nodesStore, baseDogsMap).registerRoutes(app);
        new ConfigRouteHandler(registry, kennelsStore).registerRoutes(app, '/api');
        return app;
    }

    private async expectCreatedThenDelete(id: string, via: string): Promise<void> {
        if (!(await this.deps.kennelsController.getById(id)).ok) throw new Error(`${via}: Kennel nicht angelegt`);
        const deleted = await this.deps.kennelsController.delete(id);
        if (!deleted.ok) throw new Error(`${via}: Kennel nicht geloescht: ${deleted.error}`);
    }

    private tool(name: string) {
        const tool = getKennelTools().find((t) => t.name === name);
        if (!tool) throw new Error(`Werkzeug ${name} fehlt`);
        return tool;
    }

    private static toolCalls(id: string): Array<[string, Record<string, unknown>]> {
        return [
            ['create_kennel', { id, name: 'Curated', dogIds: [] }],
            [
                'build_kennel',
                {
                    id,
                    name: 'Curated',
                    refresh: false,
                    dogs: [{ displayName: `StartupTrustBuilt${Date.now()}`, tsCode: 'return "<p>built</p>";' }],
                },
            ],
        ];
    }

    private static expectLocked(via: string, reply: MiniReply): void {
        const body = JSON.parse(reply.body || '{}') as { error?: string; error_description?: string };
        if (reply.status !== 403 || body.error !== LandingKennels.LOCK_CODE || body.error_description !== LandingKennels.LOCK_MESSAGE) {
            throw new Error(`${via} fuer Nicht-Maintainer: ${reply.status} ${reply.body}`);
        }
    }

    private static user(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false };
    }

    private static restoreEnv(name: string, value: string | undefined): void {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
}
