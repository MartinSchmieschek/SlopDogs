/**
 * Eigene Seiten je Nutzer (04.11.): Landing `/` und Liste `/kennels` als Umleitung auf `/k/<lineageId>`, die Kopfzeilen
 * dazu, GET /api/kennel-list mit `source`, REST /api/my-pages, MCP get_my_pages/set_my_pages und das Aufraeumen beim
 * Kennel-Delete.
 *
 * Ueber HTTP: ein Mini-Express auf Port 0 mit dem Front-Binder der gebauten UI (prod/lokal), einer eigenen LandingPage
 * (ein Kennel in der Rotation) und KennelListPage, dem Glied, GET /api/kennel-list und den REST-Routen; die Identitaet
 * kommt aus Test-Kopfzeilen (MiniHttp.identity). Der Dienst arbeitet auf dem echten Store (Tabelle UserPage) und dem
 * echten KennelController. Gezaehlt werden die Kennel-Laeufe der Default-Seiten: eine Umleitung und jedes HEAD lassen
 * keinen Kennel laufen. Am gebooteten Server (dev) steht das Glied vorn auf GET und HEAD von `/` und `/kennels`.
 */
import express from 'express';
import type { IStore } from '../../store/IStore';
import type { IUserPageStore, UserPages } from '../../store/IUserPageStore';
import type { KennelController } from '../../api/KennelController';
import type { KennelRunHandler, KennelRunAttribution } from '../../api/routes/KennelRunHandler';
import { MyPagesRouteHandler } from '../../api/routes/MyPagesRouteHandler';
import { API_ROUTE, ROOT_ROUTE } from '../../api/routes/routeTable';
import { MyPagesError, MyPagesService, type MyPagesView } from '../../services/MyPagesService';
import { LandingPage, type LandingRunner } from '../../server-app/LandingPage';
import { KennelListPage } from '../../server-app/KennelListPage';
import { MyPagesRedirect } from '../../server-app/MyPagesRedirect';
import { bindHttpFrontEnd } from '../../server-app/httpFrontEnd.builtUi';
import { bindKennelListPage } from '../../server-app/httpFrontEnd.landing';
import type { HttpFrontEndContext } from '../../server-app/httpFrontEndTypes';
import { SameOriginGuard } from '../../mcp/auth/sameOriginGuard';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getMyPagesTools } from '../../mcp/tools/myPages';
import type { ToolDeps } from '../../mcp/tools/types';
import { MiniHttp, type MiniReply } from './miniHttp';
import { TestKennels } from './testKennels';
import type { TestResultSink } from './packageCandidates';

export interface MyPagesTestDeps {
    nodesStore: IStore;
    kennelsController: KennelController;
    runHandler: KennelRunHandler;
    userPageStore: IUserPageStore;
    toolDeps: ToolDeps;
    /** Die gebootete App (dev): dort steht das Glied vorn auf `/` und `/kennels`. */
    app: unknown;
}

/** Zaehlt die Laeufe der Default-Seiten (LandingPage, KennelListPage) und reicht sie an den echten Lauf weiter. */
class CountingRunner implements LandingRunner {
    runs = 0;

    constructor(private readonly inner: LandingRunner) {}

    runLeadAsAnonymous(kennelId: string, query: Record<string, string>, attribution: KennelRunAttribution): Promise<unknown | null> {
        this.runs += 1;
        return this.inner.runLeadAsAnonymous(kennelId, query, attribution);
    }
}

/** Was alle Faelle teilen: Kennels, Dienst, Glied, die Default-Seiten mit ihrem Zaehler und der Server. */
interface Fixture {
    service: MyPagesService;
    runner: CountingRunner;
    server: MiniHttp;
    /** Die erste Versions-GUID von MINE — nach dem zweiten Speichern eine alte Version. */
    mineFirstVersion: string;
}

interface RouteLayer {
    route?: { path?: unknown; methods?: Record<string, boolean>; stack?: Array<{ handle?: { name?: string } }> };
}

export class MyPagesTests {
    static readonly ROTATION = 'startup-pages-rotation';
    static readonly DEFAULT_LIST = 'startup-pages-default-list';
    static readonly MINE = 'startup-pages-mine';
    static readonly LIST = 'startup-pages-list';
    static readonly FOREIGN = 'startup-pages-foreign';
    static readonly EMPTY = 'startup-pages-empty';
    static readonly MISSING = 'startup-pages-missing';
    static readonly DELETED = 'startup-pages-deleted';
    static readonly DELETED_THROWING = 'startup-pages-deleted-throwing';
    private static readonly UA = 'UA-pages';
    private static readonly UB = 'UB-pages';
    private static readonly UX = 'UX-pages';

    private readonly kennels: TestKennels;

    constructor(
        private readonly addResult: TestResultSink,
        private readonly deps: MyPagesTestDeps,
    ) {
        this.kennels = new TestKennels(deps.nodesStore, deps.kennelsController);
    }

    async run(): Promise<void> {
        const checks: Array<[string, (fixture: Fixture) => Promise<void>]> = [
            [
                'Eigene Seiten: / ueber HTTP (anonym, ohne Einstellung, Umleitung samt Query, ungueltig, ?landing=, HEAD ohne Lauf)',
                (f) => this.landingCases(f),
            ],
            ['Eigene Seiten: /kennels und /api/kennel-list mit source, auch ohne Kennel-Liste im Kontext', (f) => this.listCases(f)],
            [
                'Eigene Seiten: REST /api/my-pages (401, no_identity, 404, 400, GUID -> lineageId, null, Same-Origin, 503)',
                (f) => this.restCases(f),
            ],
            ['Eigene Seiten: MCP set_my_pages und get_my_pages im Rundlauf', (f) => this.mcpCases(f)],
            ['Eigene Seiten: Kennel-Delete raeumt UserPage auf, auch wenn das Aufraeumen wirft', (f) => this.cleanupCases(f)],
            ['Eigene Seiten: Glied vorn auf GET und HEAD von / und /kennels im gebooteten Server', () => this.bootedGateCases()],
        ];
        let fixture: Fixture | null = null;
        try {
            fixture = await this.setup();
        } catch (error) {
            for (const [name] of checks) this.addResult(name, false, `Aufbau: ${String(error)}`);
            await this.cleanup(null);
            return;
        }
        try {
            for (const [name, check] of checks) {
                try {
                    await check(fixture);
                    this.addResult(name, true);
                } catch (error) {
                    this.addResult(name, false, String(error));
                }
            }
        } finally {
            await this.cleanup(fixture);
        }
    }

    private async setup(): Promise<Fixture> {
        const { ROTATION, DEFAULT_LIST, MINE, LIST, FOREIGN, EMPTY, DELETED, DELETED_THROWING, UA, UX } = MyPagesTests;
        // Reste eines abgebrochenen Laufs: das Loeschen nimmt auch ihre Seiten mit; die Nutzer starten ohne Einstellung.
        await this.kennels.removeLeftovers([ROTATION, DEFAULT_LIST, MINE, LIST, FOREIGN, EMPTY, DELETED, DELETED_THROWING]);
        for (const userId of [UA, MyPagesTests.UB, UX]) await this.deps.userPageStore.writeUserPages(userId, { landing: null, list: null });
        const page = async (name: string) =>
            this.kennels.htmlDog(`StartupPages${name}`, `<!doctype html><html><body>${name}-page</body></html>`);
        await this.kennels.kennel({
            id: ROTATION,
            name: 'Rotation',
            dogIds: [await page('rotation')],
            visibility: 'public',
            ownerId: null,
        });
        await this.kennels.kennel({
            id: DEFAULT_LIST,
            name: 'Default list',
            dogIds: [await page('default-list')],
            visibility: 'public',
            ownerId: null,
        });
        const mine = await this.kennels.kennel({
            id: MINE,
            name: 'Mine',
            dogIds: [await page('mine')],
            visibility: 'private',
            ownerId: UA,
        });
        const second = await this.deps.kennelsController.save({ id: MINE, name: 'Mine v2' });
        if (!second.ok || second.data?.id === mine.versionId) throw new Error(`zweite Version von ${MINE}: ${second.error}`);
        await this.kennels.kennel({ id: LIST, name: 'List', dogIds: [await page('list')], visibility: 'public', ownerId: null });
        await this.kennels.kennel({ id: FOREIGN, name: 'Foreign', dogIds: [await page('foreign')], visibility: 'private', ownerId: UX });
        await this.kennels.kennel({ id: EMPTY, name: 'Empty', dogIds: [], visibility: 'public', ownerId: null });

        const service = new MyPagesService(this.deps.userPageStore, this.deps.kennelsController);
        const redirect = new MyPagesRedirect();
        redirect.use(service);
        const runner = new CountingRunner(this.deps.runHandler);
        const landing = new LandingPage({
            publicDir: null,
            kennelIds: [ROTATION],
            defaultKennelId: ROTATION,
            memoMs: 600_000,
            random: () => 0,
        });
        landing.useRunner(runner);
        const listPage = new KennelListPage({ kennelId: DEFAULT_LIST, enabled: true, memoMs: 600_000 });
        listPage.use(runner, {
            kennelHead: async (kennelId) => {
                const head = await this.deps.kennelsController.getById(kennelId);
                return head.ok && head.data ? { id: String(head.data.id), dogIds: head.data.dogIds ?? [] } : null;
            },
            lineageOf: async (ref) => (ref.startsWith('base:') ? null : ref),
            dogHeads: async () => [],
        });

        const app = express();
        app.use(express.json());
        app.use(MiniHttp.identity());
        const ctx: HttpFrontEndContext = {
            devUiOrigin: 'http://localhost:4300',
            angularBrowserDir: null,
            publicDir: null,
            landingPage: landing,
            kennelListPage: listPage,
            myPages: redirect,
        };
        bindHttpFrontEnd.beforeControllers(app, ctx);
        app.get(API_ROUTE.kennelListStatus, redirect.listStatus(listPage));
        // Keine CORS-Origin zugelassen: Sitzungsanfragen kommen nur mit Sec-Fetch-Site same-origin oder ohne Browser-Kopfzeilen durch.
        new MyPagesRouteHandler(service, new SameOriginGuard(() => undefined)).registerRoutes(app);
        const server = await MiniHttp.start(app);
        return { service, runner, server, mineFirstVersion: mine.versionId };
    }

    /** Faelle 1-6: `/` anonym, ohne Einstellung, mit Einstellung (Umleitung samt Query), ungueltig, `?landing=`, HEAD. */
    private async landingCases({ service, runner, server }: Fixture): Promise<void> {
        const { ROTATION, MINE, FOREIGN, EMPTY, MISSING, UA, UB } = MyPagesTests;
        const runs = (): number => runner.runs;
        await service.set(MyPagesTests.user(UA), { landing: MINE });

        // HEAD zuerst, solange das Memo kalt ist: fiele HEAD auf den GET-Weg durch, liefe der Kennel.
        const head = await server.request('HEAD', '/', MyPagesTests.as(UA));
        MyPagesTests.expectRedirect('HEAD / mit Einstellung', head, `/k/${MINE}`);
        if (runs() !== 0) throw new Error(`HEAD / mit Einstellung hat ${runs()} Kennel-Lauf ausgeloest`);
        MyPagesTests.expectRedirect(
            'GET / mit Einstellung',
            await server.request('GET', '/?x=1&y=two', MyPagesTests.as(UA)),
            `/k/${MINE}?x=1&y=two`,
        );
        if (runs() !== 0) throw new Error(`die Umleitung hat ${runs()} Kennel-Lauf ausgeloest`);

        const anonymous = await server.request('GET', '/', { accept: 'text/html' });
        MyPagesTests.expectDefault('GET / anonym', anonymous, 'rotation-page', LandingPage.CACHE_CONTROL);
        MyPagesTests.expectDefault(
            'GET / Super-User',
            await server.request('GET', '/', { [MiniHttp.SUPER]: '1' }),
            'rotation-page',
            LandingPage.CACHE_CONTROL,
        );
        MyPagesTests.expectDefault(
            'GET / ohne Einstellung',
            await server.request('GET', '/', MyPagesTests.as(UB)),
            'rotation-page',
            MyPagesRedirect.PRIVATE_CACHE_CONTROL,
        );
        MyPagesTests.expectDefault(
            'GET /?landing=<Rotation> mit Einstellung',
            await server.request('GET', `/?landing=${ROTATION}`, MyPagesTests.as(UA)),
            'rotation-page',
            MyPagesRedirect.PRIVATE_CACHE_CONTROL,
        );
        // Ungueltige Einstellungen (direkt in den Store, der Dienst nimmt sie nicht an): fehlend, fremd privat, ohne Dogs.
        for (const stale of [MISSING, FOREIGN, EMPTY]) {
            await this.deps.userPageStore.writeUserPages(UB, { landing: stale });
            MyPagesTests.expectDefault(
                `GET / mit Einstellung ${stale}`,
                await server.request('GET', '/', MyPagesTests.as(UB)),
                'rotation-page',
                MyPagesRedirect.PRIVATE_CACHE_CONTROL,
            );
        }
        if (runs() !== 1) throw new Error(`Default-Seite: ${runs()} Laeufe statt einem (Memo)`);
    }

    /** Fall 7: `/kennels` mit und ohne eigene Liste, GET /api/kennel-list mit source; auch ohne KennelListPage im Kontext. */
    private async listCases({ service, runner, server }: Fixture): Promise<void> {
        const { LIST, DEFAULT_LIST, UA, UB } = MyPagesTests;
        await service.set(MyPagesTests.user(UA), { list: LIST });
        const runsBefore = runner.runs;
        MyPagesTests.expectRedirect('HEAD /kennels mit Liste', await server.request('HEAD', '/kennels', MyPagesTests.as(UA)), `/k/${LIST}`);
        MyPagesTests.expectRedirect(
            'GET /kennels mit Liste',
            await server.request('GET', '/kennels?q=dog', MyPagesTests.as(UA)),
            `/k/${LIST}?q=dog`,
        );
        if (runner.runs !== runsBefore) throw new Error('die Umleitung von /kennels hat einen Kennel laufen lassen');

        MyPagesTests.expectDefault(
            'GET /kennels ohne Liste',
            await server.request('GET', '/kennels', MyPagesTests.as(UB)),
            'default-list-page',
            MyPagesRedirect.PRIVATE_CACHE_CONTROL,
        );
        MyPagesTests.expectDefault(
            'GET /kennels anonym',
            await server.request('GET', '/kennels'),
            'default-list-page',
            KennelListPage.CACHE_CONTROL,
        );

        const status = async (headers: Record<string, string>) => {
            const reply = await server.request('GET', API_ROUTE.kennelListStatus, headers);
            if (reply.headers['cache-control'] !== 'no-store')
                throw new Error(`/api/kennel-list Cache-Control: ${reply.headers['cache-control']}`);
            return JSON.parse(reply.body) as { ok?: boolean; active?: boolean; kennelId?: string; source?: string };
        };
        const own = await status(MyPagesTests.as(UA));
        if (own.ok !== true || own.active !== true || own.kennelId !== LIST || own.source !== 'user')
            throw new Error(`/api/kennel-list eigene Liste: ${JSON.stringify(own)}`);
        for (const [who, headers] of [
            ['ohne Liste', MyPagesTests.as(UB)],
            ['anonym', {}],
        ] as Array<[string, Record<string, string>]>) {
            const fallback = await status(headers);
            if (fallback.active !== true || fallback.kennelId !== DEFAULT_LIST || fallback.source !== 'default') {
                throw new Error(`/api/kennel-list ${who}: ${JSON.stringify(fallback)}`);
            }
        }

        // Ohne KennelListPage im Kontext steht nur das Glied: die eigene Liste greift, alle anderen gehen weiter.
        const bare = express();
        bare.use(MiniHttp.identity());
        const redirect = new MyPagesRedirect();
        redirect.use(service);
        bindKennelListPage(bare, {
            devUiOrigin: '',
            angularBrowserDir: null,
            publicDir: null,
            landingPage: null,
            kennelListPage: null,
            myPages: redirect,
        });
        const bareServer = await MiniHttp.start(bare);
        try {
            MyPagesTests.expectRedirect(
                'GET /kennels ohne Kennel-Liste',
                await bareServer.request('GET', '/kennels', MyPagesTests.as(UA)),
                `/k/${LIST}`,
            );
            const passOn = await bareServer.request('GET', '/kennels', MyPagesTests.as(UB));
            if (passOn.status !== 404) throw new Error(`ohne Kennel-Liste und ohne Einstellung: ${passOn.status} statt weiter (404)`);
        } finally {
            await bareServer.close();
        }
    }

    /** Fall 8: REST /api/my-pages — Identitaet, Aufloesung, Zuruecksetzen, Herkunft, Ausfall des Speichers. */
    private async restCases({ server, mineFirstVersion }: Fixture): Promise<void> {
        const { MINE, LIST, FOREIGN, EMPTY, MISSING, UA } = MyPagesTests;
        const path = API_ROUTE.myPages;
        const signedOut = await server.request('GET', path);
        if (signedOut.status !== 401 || !signedOut.headers['www-authenticate']) throw new Error(`ohne Login: ${signedOut.status}`);
        MyPagesTests.expectError('Super-User', await server.request('GET', path, { [MiniHttp.SUPER]: '1' }), 403, 'no_identity');

        const put = (body: unknown, headers: Record<string, string> = MyPagesTests.as(UA)) => server.request('PUT', path, headers, body);
        const hidden = await put({ landing: FOREIGN });
        const missing = await put({ landing: MISSING });
        MyPagesTests.expectError('fremder privater Kennel', hidden, 404, 'kennel_not_found');
        if (hidden.body !== missing.body || missing.status !== 404)
            throw new Error(`fehlend und unsichtbar unterscheiden sich: ${hidden.body} / ${missing.body}`);
        MyPagesTests.expectError('Kennel ohne Dogs', await put({ list: EMPTY }), 400, 'kennel_has_no_dogs');
        MyPagesTests.expectError('falscher Typ', await put({ landing: 42 }), 400, 'invalid_request');

        MyPagesTests.expectPages('Versions-GUID', await put({ landing: mineFirstVersion }), { landing: MINE, list: LIST });
        MyPagesTests.expectPages('null setzt zurueck', await put({ landing: null }), { landing: null, list: LIST });
        MyPagesTests.expectPages("'' setzt zurueck", await put({ list: '' }), { landing: null, list: null });
        MyPagesTests.expectPages('GET', await server.request('GET', path, MyPagesTests.as(UA)), { landing: null, list: null });

        // Herkunft: mit Session nur von eigenen Seiten; Bearer und lokal ohne diese Pruefung (wie /api/keys).
        const evil = { origin: 'http://evil.example' };
        MyPagesTests.expectError(
            'Session von fremder Origin',
            await put({ landing: MINE }, { ...MyPagesTests.as(UA), ...evil }),
            403,
            SameOriginGuard.ERROR,
        );
        MyPagesTests.expectError(
            'Session aus der Sandbox',
            await put({ landing: MINE }, { ...MyPagesTests.as(UA), origin: 'null' }),
            403,
            SameOriginGuard.ERROR,
        );
        MyPagesTests.expectPages(
            'Session same-origin',
            await put({ landing: MINE }, { ...MyPagesTests.as(UA), 'sec-fetch-site': 'same-origin' }),
            { landing: MINE, list: null },
        );
        MyPagesTests.expectPages('Bearer', await put({ list: LIST }, { ...MyPagesTests.as(UA, 'bearer'), ...evil }), {
            landing: MINE,
            list: LIST,
        });
        MyPagesTests.expectPages('lokal', await put({ list: null }, { ...MyPagesTests.as(UA, 'local'), ...evil }), {
            landing: MINE,
            list: null,
        });

        // Speicher fehlt oder wirft: Lesen ergibt keine Einstellung, Schreiben 503 my_pages_unavailable.
        const failing = new MyPagesService(MyPagesTests.failingStore(), this.deps.kennelsController);
        const ua = MyPagesTests.user(UA);
        const read = await failing.get(ua);
        if (read.landing !== null || read.list !== null) throw new Error(`Lesen bei Ausfall: ${JSON.stringify(read)}`);
        if ((await failing.target(ua, 'landing')) !== null) throw new Error('Ziel bei Ausfall nicht null');
        const write = await failing.set(ua, { landing: MINE }).then(
            () => null,
            (err: unknown) => err,
        );
        if (!(write instanceof MyPagesError) || write.status !== 503 || write.code !== 'my_pages_unavailable') {
            throw new Error(`Schreiben bei Ausfall: ${String(write)}`);
        }
    }

    /** Fall 9: MCP im Rundlauf ueber denselben Dienst. */
    private async mcpCases({ service }: Fixture): Promise<void> {
        const { MINE, FOREIGN, UA } = MyPagesTests;
        const deps: ToolDeps = { ...this.deps.toolDeps, myPages: service };
        const call = async (name: string, args: Record<string, unknown>, ctx: AuthCtx) => {
            const tool = getMyPagesTools().find((t) => t.name === name);
            if (!tool) throw new Error(`Werkzeug ${name} fehlt`);
            return tool.handler(args, ctx, deps);
        };
        const ua = MyPagesTests.user(UA);
        const parsed = (result: { content: Array<{ text: string }>; isError?: boolean }, label: string) => {
            if (result.isError) throw new Error(`${label}: ${result.content[0]?.text}`);
            return JSON.parse(result.content[0].text) as MyPagesView & { landingUrl: string | null; listUrl: string | null };
        };
        const set = parsed(await call('set_my_pages', { landing: MINE, list: null }, ua), 'set_my_pages');
        if (set.landing !== MINE || set.landingUrl !== `/k/${MINE}` || set.list !== null || set.listUrl !== null)
            throw new Error(`set_my_pages: ${JSON.stringify(set)}`);
        const got = parsed(await call('get_my_pages', {}, ua), 'get_my_pages');
        if (got.landing !== MINE || got.landingUrl !== `/k/${MINE}`) throw new Error(`get_my_pages: ${JSON.stringify(got)}`);
        const reset = parsed(await call('set_my_pages', { landing: null }, ua), 'set_my_pages null');
        if (reset.landing !== null || reset.landingUrl !== null) throw new Error(`set_my_pages null: ${JSON.stringify(reset)}`);

        const hidden = await call('set_my_pages', { landing: FOREIGN }, ua);
        if (!hidden.isError || !hidden.content[0]?.text.startsWith('kennel_not_found:'))
            throw new Error(`fremder Kennel: ${JSON.stringify(hidden)}`);
        const superUser = await call('get_my_pages', {}, { user: null, isSuperUser: true });
        if (!superUser.isError || !superUser.content[0]?.text.startsWith('no_identity:'))
            throw new Error(`Super-User: ${JSON.stringify(superUser)}`);
        const without = await getMyPagesTools()[0].handler({}, ua, this.deps.toolDeps);
        if (!without.isError || !without.content[0]?.text.startsWith('my_pages_unavailable:'))
            throw new Error(`ohne Dienst: ${JSON.stringify(without)}`);
    }

    /** Fall 10: Kennel-Delete nimmt die Seiten mit (delete und deleteRef); wirft das Aufraeumen, gelingt das Loeschen trotzdem. */
    private async cleanupCases({ service }: Fixture): Promise<void> {
        const { DELETED, DELETED_THROWING, UA, UB } = MyPagesTests;
        const store = this.deps.userPageStore;
        const dog = await this.kennels.htmlDog('StartupPagesDeleted', '<p>deleted</p>');
        await this.kennels.kennel({ id: DELETED, name: 'Deleted', dogIds: [dog], visibility: 'public', ownerId: null });
        await service.set(MyPagesTests.user(UA), { landing: DELETED });
        await service.set(MyPagesTests.user(UB), { list: DELETED });
        const deleted = await this.deps.kennelsController.delete(DELETED);
        if (!deleted.ok) throw new Error(`Loeschen: ${deleted.error}`);
        const [ua, ub] = [await store.readUserPages(UA), await store.readUserPages(UB)];
        if (ua.landing !== undefined || ub.list !== undefined) throw new Error(`Zeilen nach dem Loeschen: ${JSON.stringify({ ua, ub })}`);

        await this.kennels.kennel({ id: DELETED_THROWING, name: 'Deleted throwing', dogIds: [dog], visibility: 'public', ownerId: null });
        await store.writeUserPages(UA, { landing: DELETED_THROWING });
        store.deleteUserPagesOf = async () => {
            throw Object.assign(new Error('UserPage fehlt'), { code: 'P2021' });
        };
        try {
            const outcome = await this.deps.kennelsController.deleteRef(DELETED_THROWING);
            if (!outcome.ok) throw new Error(`deleteRef bei werfendem Aufraeumen: ${outcome.code}`);
        } finally {
            Reflect.deleteProperty(store, 'deleteUserPagesOf');
        }
        if ((await this.deps.kennelsController.getById(DELETED_THROWING)).ok) throw new Error('Kennel steht nach deleteRef noch');
        const left: UserPages = await store.readUserPages(UA);
        if (left.landing !== DELETED_THROWING) throw new Error(`die Zeile sollte stehen bleiben: ${JSON.stringify(left)}`);
        if ((await service.target(MyPagesTests.user(UA), 'landing')) !== null) throw new Error('verwaiste Zeile leitet noch um');
    }

    /** Das Glied steht im gebooteten Server (dev-Binder) vorn auf derselben Registrierung, HEAD vor GET. */
    private async bootedGateCases(): Promise<void> {
        const app = this.deps.app as { router?: { stack?: RouteLayer[] }; _router?: { stack?: RouteLayer[] } } | null;
        const stack: RouteLayer[] = app?.router?.stack ?? app?._router?.stack ?? [];
        for (const path of [ROOT_ROUTE.landing, ROOT_ROUTE.kennelList]) {
            const at = (method: string) => stack.findIndex((layer) => layer.route?.path === path && layer.route.methods?.[method]);
            const [head, get] = [at('head'), at('get')];
            if (head < 0 || get < 0 || head > get) throw new Error(`${path}: HEAD an ${head}, GET an ${get}`);
            for (const index of [head, get]) {
                const first = stack[index].route?.stack?.[0]?.handle?.name;
                if (first !== 'myPagesGate') throw new Error(`${path}: erster Handler ist "${first}", nicht das Glied`);
            }
        }
    }

    private async cleanup(fixture: Fixture | null): Promise<void> {
        await fixture?.server.close();
        for (const userId of [MyPagesTests.UA, MyPagesTests.UB, MyPagesTests.UX]) {
            await this.deps.userPageStore.writeUserPages(userId, { landing: null, list: null }).catch(() => undefined);
        }
        await this.kennels.cleanup();
    }

    /** Ein Speicher, der bei jedem Zugriff wirft wie Prisma ohne Tabelle (P2021). */
    private static failingStore(): IUserPageStore {
        const missing = () => Promise.reject(Object.assign(new Error('The table `UserPage` does not exist'), { code: 'P2021' }));
        return { readUserPages: missing, writeUserPages: missing, deleteUserPagesOf: missing };
    }

    private static user(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false, via: 'session' };
    }

    private static as(userId: string, via: 'session' | 'bearer' | 'local' = 'session'): Record<string, string> {
        return { [MiniHttp.USER]: userId, [MiniHttp.VIA]: via, accept: 'text/html' };
    }

    private static header(reply: MiniReply, name: string): string {
        const value = reply.headers[name];
        return Array.isArray(value) ? value.join(', ') : String(value ?? '');
    }

    private static expectVaryCookie(label: string, reply: MiniReply): void {
        if (!/(^|,)\s*cookie\s*(,|$)/i.test(MyPagesTests.header(reply, 'vary')))
            throw new Error(`${label}: Vary ohne Cookie (${MyPagesTests.header(reply, 'vary')})`);
    }

    private static expectRedirect(label: string, reply: MiniReply, location: string): void {
        if (reply.status !== 302 || reply.headers.location !== location)
            throw new Error(`${label}: ${reply.status} Location ${reply.headers.location} statt ${location}`);
        if (reply.headers['cache-control'] !== MyPagesRedirect.PRIVATE_CACHE_CONTROL)
            throw new Error(`${label}: Cache-Control ${reply.headers['cache-control']}`);
        MyPagesTests.expectVaryCookie(label, reply);
    }

    private static expectDefault(label: string, reply: MiniReply, marker: string, cacheControl: string): void {
        if (reply.status !== 200 || reply.headers.location !== undefined || !reply.body.includes(marker)) {
            throw new Error(`${label}: ${reply.status} ${reply.headers.location ?? ''} ${reply.body.slice(0, 120)}`);
        }
        if (reply.headers['cache-control'] !== cacheControl)
            throw new Error(`${label}: Cache-Control ${reply.headers['cache-control']} statt ${cacheControl}`);
        MyPagesTests.expectVaryCookie(label, reply);
    }

    private static expectError(label: string, reply: MiniReply, status: number, code: string): void {
        const body = JSON.parse(reply.body || '{}') as { error?: string };
        if (reply.status !== status || body.error !== code)
            throw new Error(`${label}: ${reply.status} ${reply.body} statt ${status} ${code}`);
        if (reply.headers['cache-control'] !== 'no-store') throw new Error(`${label}: Cache-Control ${reply.headers['cache-control']}`);
    }

    private static expectPages(label: string, reply: MiniReply, pages: MyPagesView): void {
        const body = JSON.parse(reply.body || '{}') as Partial<MyPagesView> & { ok?: boolean };
        if (reply.status !== 200 || body.ok !== true || body.landing !== pages.landing || body.list !== pages.list) {
            throw new Error(`${label}: ${reply.status} ${reply.body} statt ${JSON.stringify(pages)}`);
        }
    }
}
