// MyPagesService — eigene Seiten je Nutzer: eine Landing fuer `/` und eine Liste fuer `/kennels`, jede ein Kennel, den
// der Nutzer sehen darf. REST (/api/my-pages), MCP (get_my_pages, set_my_pages), die Umleitung vor `/` und `/kennels`
// und GET /api/kennel-list lesen ueber diesen Dienst.
//
// Gespeichert wird die lineageId des Kennels (Tabelle UserPage, IUserPageStore); aufgeloest wird wie unter `/k/:id`
// (KennelController.getById), als Kennel-ID oder Versions-GUID. Vor jeder Umleitung prueft `target` neu: Kennel da,
// fuer den Nutzer sichtbar, mit Dogs — ohne ihn laufen zu lassen. Fehlt die Tabelle oder scheitert die DB, gilt beim
// Lesen die Default-Seite (einmal geloggt je Ausfall), Schreiben antwortet 503 `my_pages_unavailable`.
import type { IKennelConfig } from '@martinschmieschek/slopdogs-core/runtime';
import type { AuthCtx } from '../mcp/auth/middleware';
import { accessOf } from '../mcp/auth/visibility';
import { USER_PAGE_KINDS, type IUserPageStore, type UserPageChanges, type UserPageKind, type UserPages } from '../store/IUserPageStore';
import { statsKeyOf } from './KennelStatsService';

/** Die eigenen Seiten eines Nutzers: je Art die lineageId, null = Default-Seite. */
export type MyPagesView = Record<UserPageKind, string | null>;

/** Woher der Dienst Kennels aufloest — dieselbe Aufloesung wie `/k/:id` (KennelController.getById). */
export interface MyPagesKennelSource {
    getById(id: string): Promise<{ ok: boolean; data?: IKennelConfig | null }>;
}

/** Ein abgelehnter Zugriff auf die eigenen Seiten — Status und Code wie in der REST-Antwort. */
export class MyPagesError extends Error {
    constructor(
        readonly status: 400 | 401 | 403 | 404 | 503,
        readonly code: string,
        description?: string,
    ) {
        super(description ?? code);
        this.name = 'MyPagesError';
    }
}

export class MyPagesService {
    /** Scheitert das Lesen gerade? Dann schweigt das Log bis zum naechsten erfolgreichen Lesen. */
    private readFailing = false;

    constructor(
        private readonly store: IUserPageStore,
        private readonly kennels: MyPagesKennelSource,
    ) {}

    /** Die gespeicherten Seiten des Aufrufers. Wirft MyPagesError (401, 403 no_identity). */
    async get(ctx: AuthCtx | undefined): Promise<MyPagesView> {
        return MyPagesService.view(await this.read(MyPagesService.userOf(ctx)));
    }

    /**
     * `{ landing?, list? }`: nur genannte Arten aendern sich; null oder '' setzt auf den Default zurueck. Jeder Wert wird
     * aufgeloest wie `/k/:id`; gespeichert wird die lineageId des Kennels. Wirft MyPagesError.
     */
    async set(ctx: AuthCtx | undefined, input: unknown): Promise<MyPagesView> {
        const userId = MyPagesService.userOf(ctx);
        const changes = await this.resolve(MyPagesService.requested(input), ctx);
        try {
            await this.store.writeUserPages(userId, changes);
        } catch (err) {
            console.warn(`[MyPagesService] Schreiben gescheitert (${MyPagesService.reason(err)})`);
            throw new MyPagesError(503, 'my_pages_unavailable', 'Your pages cannot be saved on this server right now.');
        }
        return this.get(ctx);
    }

    /**
     * Wohin `/` bzw. `/kennels` diesen Aufrufer umleiten: die gespeicherte lineageId, wenn der Kennel noch da ist, fuer ihn
     * sichtbar und mit Dogs — sonst null (Default-Seite). Kein Lauf, wirft nie.
     */
    async target(ctx: AuthCtx | undefined, kind: UserPageKind): Promise<string | null> {
        const userId = ctx?.user?.id;
        if (!userId) return null;
        const lineageId = (await this.read(userId))[kind];
        if (!lineageId) return null;
        const head = await this.load(lineageId);
        return head && MyPagesService.servable(head, ctx) ? lineageId : null;
    }

    /** Jede genannte Seite aufloesen; die erste, die nicht taugt, weist den ganzen Aufruf ab (nichts wird geschrieben). */
    private async resolve(requested: UserPageChanges, ctx: AuthCtx | undefined): Promise<UserPageChanges> {
        const changes: UserPageChanges = {};
        for (const kind of USER_PAGE_KINDS) {
            const ref = requested[kind];
            if (ref === undefined) continue;
            changes[kind] = ref === null ? null : await this.lineageFor(ref, ctx);
        }
        return changes;
    }

    /** Kennel-ID oder Versions-GUID -> die lineageId; geprueft wird der Kopf der Lineage, den `/k/<lineageId>` zeigt. */
    private async lineageFor(ref: string, ctx: AuthCtx | undefined): Promise<string> {
        const resolved = await this.load(ref);
        if (!resolved) throw MyPagesService.notFound();
        const lineageId = statsKeyOf(resolved);
        const head = lineageId === ref ? resolved : await this.load(lineageId);
        // Fehlt der Kopf oder ist er unsichtbar: dieselbe Antwort, sie verraet nicht, ob es ihn gibt.
        if (!head || accessOf(head, ctx) === 'none') throw MyPagesService.notFound();
        if (!MyPagesService.hasDogs(head)) {
            throw new MyPagesError(400, 'kennel_has_no_dogs', 'This kennel has no dogs yet, so it would show nothing.');
        }
        return lineageId;
    }

    private static notFound(): MyPagesError {
        return new MyPagesError(404, 'kennel_not_found', 'Kennel not found.');
    }

    /** Die gespeicherten Seiten; scheitert die DB (auch: die Tabelle fehlt), gilt "keine Einstellung". */
    private async read(userId: string): Promise<UserPages> {
        try {
            const pages = await this.store.readUserPages(userId);
            this.readFailing = false;
            return pages;
        } catch (err) {
            if (!this.readFailing)
                console.warn(`[MyPagesService] Lesen gescheitert, es gelten die Default-Seiten (${MyPagesService.reason(err)})`);
            this.readFailing = true;
            return {};
        }
    }

    private async load(id: string): Promise<IKennelConfig | null> {
        const result = await this.kennels.getById(id);
        return result.ok && result.data ? result.data : null;
    }

    /** Was `/k/` fuer diesen Aufrufer ausliefern wuerde: sichtbar (RUN reicht) und mit mindestens einem Dog. */
    private static servable(kennel: IKennelConfig, ctx: AuthCtx | undefined): boolean {
        return accessOf(kennel, ctx) !== 'none' && MyPagesService.hasDogs(kennel);
    }

    private static hasDogs(kennel: IKennelConfig): boolean {
        return Array.isArray(kennel.dogIds) && kennel.dogIds.length > 0;
    }

    /** Wessen Seiten: der eingeloggte Nutzer (lokal: `local`); ohne Login 401, der Dev-Super-User ohne Nutzer 403. */
    private static userOf(ctx: AuthCtx | undefined): string {
        const userId = ctx?.user?.id;
        if (userId) return userId;
        if (ctx?.isSuperUser)
            throw new MyPagesError(403, 'no_identity', 'Your pages belong to a real user — the super-user has no identity.');
        throw new MyPagesError(401, 'unauthorized', 'Login required for your pages.');
    }

    /** Die Eingabe pruefen: je Art ein Text (Kennel-ID oder Versions-GUID) oder null; '' zaehlt als null. */
    private static requested(input: unknown): UserPageChanges {
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new MyPagesError(400, 'invalid_request', 'Send { "landing": "<kennel id>" | null, "list": "<kennel id>" | null }.');
        }
        const requested: UserPageChanges = {};
        for (const kind of USER_PAGE_KINDS) {
            const raw = (input as Record<string, unknown>)[kind];
            if (raw === undefined) continue;
            if (raw !== null && typeof raw !== 'string')
                throw new MyPagesError(400, 'invalid_request', `${kind}: a kennel id, or null for the default.`);
            requested[kind] = raw?.trim() || null;
        }
        return requested;
    }

    private static view(pages: UserPages): MyPagesView {
        return { landing: pages.landing ?? null, list: pages.list ?? null };
    }

    /** Fuers Log nur der Code bzw. die Fehlerklasse — eine DB-Meldung kann Eingabewerte zitieren. */
    private static reason(err: unknown): string {
        const code = (err as { code?: unknown })?.code;
        return typeof code === 'string' ? code : ((err as Error)?.name ?? 'Error');
    }
}
