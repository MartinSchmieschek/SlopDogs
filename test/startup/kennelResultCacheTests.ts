/**
 * Ergebnis-Cache P3 — der Cache ganzer Kennel-Laeufe (PLAN-KENNEL-CACHE 4, D1-D4, D8, E7):
 *
 * 1. Treffer: zweiter Aufruf ohne Lauf (kein KennelRun, kein Worker), Kopfzeilen `X-SlopDogs-Cache` und `Age`, /k/ und
 *    /execute und MCP teilen den Eintrag; nur der Besitzer erzwingt frisch; TTL 0 cacht nicht.
 * 2. Fingerabdruck: neue Dog-Version, Pin, displayName-Verweis, Heal (dogIds), ACL, Server-Stand — jeder macht einen
 *    neuen Schluessel; das Memo faellt mit invalidate().
 * 3. Scopes: anonym geteilt, persoenlich und privat je Nutzer, anonym auf persoenlich gar nicht, fremder Dog je Nutzer.
 * 4. Tor: ein gescheiterter Dog oder eine verdeckte persoenliche Nutzung legt nichts ab.
 * 5. Schleusen: ein Treffer nimmt kein Lauf-Token, nur sein eigenes Budget; ein Fehlschlag nimmt eins.
 * 6. Statistik: Doku-Laeufe zaehlen nicht (D8); Treffer zaehlen als Aufruf und in `cached`.
 * 7. P4: Landing und Liste im Scope `landing` (jede Klasse, Fenster des alten Memos), die Auskunft
 *    GET /api/kennels/:id/result-cache (READ, Besitzer mit Hinweis) und die Herabstufung in get_kennel.
 */
import express from 'express';
import type { IStore } from '../../store/IStore';
import type { KennelController } from '../../api/KennelController';
import { KennelRunHandler, type IKennelRunDeps } from '../../api/routes/KennelRunHandler';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getKennelTools } from '../../mcp/tools/kennels';
import type { ToolDeps } from '../../mcp/tools/types';
import { SecurityHeaders } from '../../server-app/SecurityHeaders';
import { CorsHeaders } from '../../server-app/CorsHeaders';
import { RunAdmission, RunGates, SourceRunGate } from '../../server-app/runAdmission';
import { KennelCallCounter, utcDay } from '../../services/KennelCallCounter';
import type { IKennelStatsStore } from '../../store/IKennelStatsStore';
import { KennelFingerprints } from '../../services/kennelCache/KennelFingerprint';
import { KennelResultCache } from '../../services/kennelCache/KennelResultCache';
import type { IKennelResultStore, KennelResultEntry } from '../../services/kennelCache/KennelResultStore';
import type { IKennelConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { MiniHttp, type MiniReply } from './miniHttp';
import { TestKennels } from './testKennels';
import type { TestResultSink } from './packageCandidates';
import { KennelResultCacheHandler } from '../../api/routes/KennelResultCacheHandler';
import type { KennelStatsService } from '../../services/KennelStatsService';

export interface KennelResultCacheTestDeps {
    nodesStore: IStore;
    kennelsController: KennelController;
    baseDogsMap: IKennelRunDeps['baseDogsMap'];
    /** Die echte Ablage (Cache-DB) — ohne: eine im Speicher. */
    resultStore?: IKennelResultStore;
    toolDepsFor: (handler: KennelRunHandler) => ToolDeps;
}

/** Eine Ablage im Speicher — dieselbe Schnittstelle wie PrismaKennelResultStore. */
export class MemoryKennelResultStore implements IKennelResultStore {
    private readonly rows = new Map<string, KennelResultEntry>();

    async get(key: string): Promise<KennelResultEntry | null> {
        const row = this.rows.get(key);
        return row ? { ...row } : null;
    }

    async put(entry: KennelResultEntry, maxPerKennel: number): Promise<void> {
        this.rows.set(entry.key, { ...entry });
        const mine = [...this.rows.values()].filter((r) => r.lineageId === entry.lineageId).sort((a, b) => a.lastHitAt - b.lastHitAt);
        for (const row of mine.slice(0, Math.max(0, mine.length - maxPerKennel))) this.rows.delete(row.key);
    }

    async touch(key: string, lastHitAt: number, expiresAt: number | null): Promise<void> {
        const row = this.rows.get(key);
        if (!row) return;
        row.lastHitAt = lastHitAt;
        if (expiresAt !== null) row.expiresAt = expiresAt;
    }

    async deleteLineage(lineageId: string): Promise<number> {
        let n = 0;
        for (const [key, row] of this.rows) if (row.lineageId === lineageId && this.rows.delete(key)) n++;
        return n;
    }

    async prune(before: number): Promise<number> {
        let n = 0;
        for (const [key, row] of this.rows) if (row.expiresAt < before && this.rows.delete(key)) n++;
        return n;
    }

    async countLineage(lineageId: string): Promise<number> {
        return [...this.rows.values()].filter((r) => r.lineageId === lineageId).length;
    }
}

/** Ein Handler mit eigenem Cache, eigenem Zaehler und einem Laufzaehler — und die App mit seinen Routen. */
class CacheRig {
    private runs = 0;
    readonly cache: KennelResultCache;
    readonly app: express.Application;

    constructor(
        readonly handler: KennelRunHandler,
        store: IKennelResultStore,
        readonly counter: KennelCallCounter,
        stamp = 'test-server',
    ) {
        this.cache = new KennelResultCache(store, new KennelFingerprints(handler.cacheClasses, () => stamp, 0));
        handler.useResultCache(this.cache);
        const run = handler.runKennel.bind(handler);
        handler.runKennel = (async (...args: Parameters<KennelRunHandler['runKennel']>) => {
            this.runs++;
            return run(...args);
        }) as KennelRunHandler['runKennel'];
        this.app = express();
        this.app.use(express.json());
        this.app.use(new SecurityHeaders().middleware());
        this.app.use(new CorsHeaders(() => undefined).middleware());
        this.app.use(MiniHttp.identity());
        handler.registerRoutes(this.app);
    }

    /** Wie oft der Handler einen Kennel-Lauf gestartet hat. */
    ran(): number {
        return this.runs;
    }
}

export class KennelResultCacheTests {
    static readonly PURE = 'startup-rc-pure';
    static readonly NO_TTL = 'startup-rc-nottl';
    static readonly FP = 'startup-rc-fp';
    static readonly FP_PINNED = 'startup-rc-fp-pinned';
    static readonly FP_NAME = 'startup-rc-fp-name';
    static readonly PERSONAL = 'startup-rc-personal';
    static readonly PRIVATE = 'startup-rc-private';
    static readonly FOREIGN = 'startup-rc-foreign';
    static readonly FAILING = 'startup-rc-failing';
    static readonly HIDDEN = 'startup-rc-hidden';
    static readonly LIMIT_HIT = 'startup-rc-limit-hit';
    static readonly LIMIT_RUN = 'startup-rc-limit-run';
    static readonly DOCS = 'startup-rc-docs';
    static readonly LANDING = 'startup-rc-landing';
    static readonly ADVICE = 'startup-rc-advice';
    static readonly HIDDEN_OWNED = 'startup-rc-hidden-owned';
    private static readonly ALL = [
        KennelResultCacheTests.PURE,
        KennelResultCacheTests.NO_TTL,
        KennelResultCacheTests.FP,
        KennelResultCacheTests.FP_PINNED,
        KennelResultCacheTests.FP_NAME,
        KennelResultCacheTests.PERSONAL,
        KennelResultCacheTests.PRIVATE,
        KennelResultCacheTests.FOREIGN,
        KennelResultCacheTests.FAILING,
        KennelResultCacheTests.HIDDEN,
        KennelResultCacheTests.LIMIT_HIT,
        KennelResultCacheTests.LIMIT_RUN,
        KennelResultCacheTests.DOCS,
        KennelResultCacheTests.LANDING,
        KennelResultCacheTests.ADVICE,
        KennelResultCacheTests.HIDDEN_OWNED,
    ];
    private static readonly OWNER = 'URO';

    /** Statistik-Store ohne Zeilen — die Testzaehler flushen nie. */
    private static readonly NO_STATS: IKennelStatsStore = {
        incrementKennelCalls: async () => {},
        readKennelCallAggregates: async () => [],
        upsertKennelRating: async () => {},
        readKennelRatingAggregates: async () => [],
        readUserRatings: async () => [],
        deleteKennelStats: async () => {},
    } as unknown as IKennelStatsStore;

    private readonly store: IKennelResultStore;

    constructor(
        private readonly addResult: TestResultSink,
        private readonly deps: KennelResultCacheTestDeps,
    ) {
        this.store = deps.resultStore ?? new MemoryKennelResultStore();
    }

    async run(): Promise<void> {
        const kennels = new TestKennels(this.deps.nodesStore, this.deps.kennelsController);
        try {
            await kennels.removeLeftovers(KennelResultCacheTests.ALL);
            await this.check('Ergebnis-Cache: Treffer ohne Lauf, Kopfzeilen, /k/ + /execute + MCP, Bypass nur Besitzer, TTL 0 ohne', () =>
                this.hitCases(kennels),
            );
            await this.check('Ergebnis-Cache: Fingerabdruck faellt bei Dog-Save, Pin, displayName, Heal, ACL, Server-Stand', () =>
                this.fingerprintCases(kennels),
            );
            await this.check('Ergebnis-Cache: Scopes getrennt (anon, je Nutzer, persoenlich, privat, fremder Dog)', () =>
                this.scopeCases(kennels),
            );
            await this.check('Ergebnis-Cache: Tor legt nicht ab (Dog gescheitert, verdeckte persoenliche Nutzung)', () =>
                this.gateCases(kennels),
            );
            await this.check('Ergebnis-Cache: Treffer ohne Lauf-Token (eigenes Budget), Fehlschlag mit, 429 mit lesbarem Retry-After', () =>
                this.limiterCases(kennels),
            );
            await this.check('Ergebnis-Cache: Doku-Laeufe zaehlen nicht, Treffer zaehlen in cached', () => this.statsCases(kennels));
            await this.check(
                'Ergebnis-Cache P4: Landing im Scope landing, Auskunft REST (READ, Besitzer-Hinweis), Herabstufung in get_kennel',
                () => this.p4Cases(kennels),
            );
        } finally {
            for (const id of KennelResultCacheTests.ALL) await this.store.deleteLineage(id).catch(() => 0);
            await kennels.cleanup();
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

    // --- 1. Treffer ---

    private async hitCases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const id = KennelResultCacheTests.PURE;
        const dog = await kennels.codeDog('RcPure', 'return "<p>rein</p>";');
        await kennels.kennel({
            id,
            name: 'RC rein',
            dogIds: [dog.lineageId],
            visibility: 'public',
            ownerId: KennelResultCacheTests.OWNER,
            resultCacheTtl: 600,
        });
        const nottl = await kennels.codeDog('RcNoTtl', 'return "<p>ohne</p>";');
        await kennels.kennel({ id: KennelResultCacheTests.NO_TTL, dogIds: [nottl.lineageId], visibility: 'public', ownerId: null });

        const server = await MiniHttp.start(rig.app);
        try {
            const first = await server.request('GET', `/k/${id}`);
            KennelResultCacheTests.expect(first, 200, 'miss', 'erster Aufruf');
            if (rig.ran() !== 1) throw new Error(`erster Aufruf: ${rig.ran()} Laeufe`);
            const second = await server.request('GET', `/k/${id}`);
            KennelResultCacheTests.expect(second, 200, 'hit', 'zweiter Aufruf');
            if (rig.ran() !== 1) throw new Error(`Treffer ist gelaufen (${rig.ran()})`);
            if (second.body !== first.body) throw new Error('Treffer liefert anderen Rumpf');
            if (!/^\d+$/.test(String(second.headers.age ?? ''))) throw new Error(`Age fehlt: ${String(second.headers.age)}`);
            if (!String(second.headers['content-type']).includes('text/html'))
                throw new Error(`Art verloren: ${second.headers['content-type']}`);

            const execute = await server.request('GET', `/api/kennels/${id}/execute`, { accept: 'application/json' });
            KennelResultCacheTests.expect(execute, 200, 'hit', '/execute');

            const anonFresh = await server.request('GET', `/k/${id}`, { 'cache-control': 'no-cache' });
            KennelResultCacheTests.expect(anonFresh, 200, 'hit', 'no-cache eines Fremden');
            const ownerFresh = await server.request('GET', `/k/${id}`, {
                'cache-control': 'no-cache',
                [MiniHttp.USER]: KennelResultCacheTests.OWNER,
            });
            KennelResultCacheTests.expect(ownerFresh, 200, 'bypass', 'no-cache des Besitzers');
            if (rig.ran() !== 2) throw new Error(`Bypass ohne Lauf (${rig.ran()})`);

            for (let i = 0; i < 2; i++) {
                const plain = await server.request('GET', `/k/${KennelResultCacheTests.NO_TTL}`);
                if (plain.status !== 200 || plain.headers['x-slopdogs-cache'] !== undefined)
                    throw new Error(`TTL 0: ${plain.status} ${String(plain.headers['x-slopdogs-cache'])}`);
            }
            if (rig.ran() !== 4) throw new Error(`TTL 0 cacht (${rig.ran()} Laeufe)`);
        } finally {
            await server.close();
        }

        const anon: AuthCtx = { user: null, isSuperUser: false };
        const viaMcp = await this.tool(rig, 'execute_kennel', { id }, anon);
        if (viaMcp.isError || viaMcp.text !== '<p>rein</p>' || rig.ran() !== 4)
            throw new Error(`MCP-Treffer: ${viaMcp.text} (${rig.ran()})`);
        const stranger = await this.tool(rig, 'execute_kennel', { id, bypassCache: true }, KennelResultCacheTests.user('URX'));
        if (!stranger.isError || !stranger.text.includes('Only the owner may bypass'))
            throw new Error(`MCP-Bypass Fremder: ${stranger.text}`);
        const owner = await this.tool(
            rig,
            'execute_kennel',
            { id, bypassCache: true },
            KennelResultCacheTests.user(KennelResultCacheTests.OWNER),
        );
        if (owner.isError || rig.ran() !== 5) throw new Error(`MCP-Bypass Besitzer: ${owner.text} (${rig.ran()})`);
    }

    // --- 2. Fingerabdruck ---

    private async fingerprintCases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const prints = rig.cache.fingerprints;
        const dog = await kennels.codeDog('RcFp', 'return 1;');
        await kennels.kennel({
            id: KennelResultCacheTests.FP,
            dogIds: [dog.lineageId],
            visibility: 'public',
            ownerId: KennelResultCacheTests.OWNER,
        });
        await kennels.kennel({
            id: KennelResultCacheTests.FP_PINNED,
            dogIds: [dog.versionId],
            visibility: 'public',
            ownerId: KennelResultCacheTests.OWNER,
        });
        const name = `RcFpName${Date.now()}`;
        const named = await kennels.codeDog(name, 'return 2;');
        await kennels.kennel({
            id: KennelResultCacheTests.FP_NAME,
            dogIds: [name],
            visibility: 'public',
            ownerId: KennelResultCacheTests.OWNER,
        });
        void named;

        const fp = async (id: string) => (await prints.of(await this.config(rig, id))).hash;
        const before = await fp(KennelResultCacheTests.FP);
        const pinnedBefore = await fp(KennelResultCacheTests.FP_PINNED);
        const nameBefore = await fp(KennelResultCacheTests.FP_NAME);

        await kennels.codeDog('RcFp', 'return 3;', undefined, dog.lineageId);
        if ((await fp(KennelResultCacheTests.FP)) === before) throw new Error('neue Dog-Version: gleicher Fingerabdruck');
        if ((await fp(KennelResultCacheTests.FP_PINNED)) !== pinnedBefore)
            throw new Error('Pin: neue Version hat den gepinnten Abdruck veraendert');

        await kennels.codeDog(name, 'return 4;');
        if ((await fp(KennelResultCacheTests.FP_NAME)) === nameBefore)
            throw new Error('displayName-Verweis: neuer Dog gleichen Namens, gleicher Abdruck');

        const config = await this.config(rig, KennelResultCacheTests.FP);
        const base = (await prints.of(config)).hash;
        const healed = (await prints.of({ ...config, dogIds: [...(config.dogIds ?? []), 'base:QueryRetriever'] })).hash;
        if (healed === base) throw new Error('Heal (dogIds): gleicher Abdruck');
        const editors = (await prints.of({ ...config, editors: 'URZ' } as IKennelConfig)).hash;
        if (editors === base) throw new Error('Kennel-ACL (editors): gleicher Abdruck');

        // Dog-ACL: der Dog wird privat eines Fremden -> darf im Kennel nicht mehr laufen.
        await kennels.codeDog('RcFp', 'return 3;', { visibility: 'private', ownerId: 'URF' }, dog.lineageId);
        const foreign = await prints.of(await this.config(rig, KennelResultCacheTests.FP));
        if (foreign.hash === base || foreign.runnable.length !== 0) throw new Error(`Dog-ACL: ${foreign.runnable.length} laufende Dogs`);

        const deployed = new KennelFingerprints(rig.handler.cacheClasses, () => 'next-deploy', 0);
        if ((await deployed.of(config)).hash === base) throw new Error('Server-Stand: gleicher Abdruck');

        const memo = new KennelFingerprints(rig.handler.cacheClasses, () => 'memo', 60_000);
        const memoBefore = (await memo.of(config)).hash;
        await kennels.codeDog('RcFp', 'return 5;', undefined, dog.lineageId);
        if ((await memo.of(config)).hash !== memoBefore) throw new Error('Memo haelt nicht');
        memo.invalidate();
        if ((await memo.of(config)).hash === memoBefore) throw new Error('invalidate() verwirft das Memo nicht');
    }

    // --- 3. Scopes ---

    private async scopeCases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const owner = KennelResultCacheTests.OWNER;
        const scope = async (id: string, ctx: AuthCtx | undefined) => {
            const config = await this.config(rig, id);
            return KennelResultCache.scopeFor(config, await rig.cache.fingerprints.of(config), ctx);
        };
        const pure = await kennels.codeDog('RcScopePure', 'return "x";');
        await kennels.kennel({
            id: KennelResultCacheTests.PRIVATE,
            dogIds: [pure.lineageId],
            visibility: 'private',
            ownerId: owner,
            resultCacheTtl: 60,
        });
        if ((await scope(KennelResultCacheTests.PRIVATE, KennelResultCacheTests.user(owner))) !== `user:${owner}`)
            throw new Error('privat: nicht je Nutzer');

        const personal = await kennels.codeDog('RcScopePersonal', 'return (await jsonStore.get("rc-scope")) ?? "leer";');
        await kennels.kennel({
            id: KennelResultCacheTests.PERSONAL,
            dogIds: [personal.lineageId],
            visibility: 'public',
            ownerId: owner,
            resultCacheTtl: 60,
        });
        if ((await scope(KennelResultCacheTests.PERSONAL, undefined)) !== null) throw new Error('persoenlich + anonym: Scope vergeben');
        if ((await scope(KennelResultCacheTests.PERSONAL, KennelResultCacheTests.user('URA'))) !== 'user:URA')
            throw new Error('persoenlich: nicht je Nutzer');

        const secret = await kennels.codeDog('RcScopeForeign', 'return "y";', { visibility: 'private', ownerId: owner });
        await kennels.kennel({
            id: KennelResultCacheTests.FOREIGN,
            dogIds: [secret.lineageId],
            visibility: 'public',
            ownerId: owner,
            resultCacheTtl: 60,
        });
        if ((await scope(KennelResultCacheTests.FOREIGN, undefined)) !== 'anon') throw new Error('anonym: nicht anon');
        if ((await scope(KennelResultCacheTests.FOREIGN, KennelResultCacheTests.user(owner))) !== 'anon')
            throw new Error('eigener Dog: nicht anon');
        if ((await scope(KennelResultCacheTests.FOREIGN, KennelResultCacheTests.user('URZ'))) !== 'user:URZ')
            throw new Error('fremder Dog: nicht je Nutzer');

        const server = await MiniHttp.start(rig.app);
        try {
            const as = (userId?: string): Record<string, string> => (userId ? { [MiniHttp.USER]: userId } : {});
            const anon = await server.request('GET', `/k/${KennelResultCacheTests.PERSONAL}`, as());
            if (anon.status !== 200 || anon.headers['x-slopdogs-cache'] !== undefined)
                throw new Error(`persoenlich anonym: ${String(anon.headers['x-slopdogs-cache'])}`);
            KennelResultCacheTests.expect(
                await server.request('GET', `/k/${KennelResultCacheTests.PERSONAL}`, as('URA')),
                200,
                'miss',
                'URA erst',
            );
            KennelResultCacheTests.expect(
                await server.request('GET', `/k/${KennelResultCacheTests.PERSONAL}`, as('URA')),
                200,
                'hit',
                'URA dann',
            );
            KennelResultCacheTests.expect(
                await server.request('GET', `/k/${KennelResultCacheTests.PERSONAL}`, as('URB')),
                200,
                'miss',
                'URB nicht aus URA',
            );
        } finally {
            await server.close();
        }
    }

    // --- 4. Tor ---

    private async gateCases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const lead = await kennels.codeDog('RcGateLead', 'return "ok";');
        const broken = await kennels.codeDog('RcGateBroken', 'throw new Error("kaputt");');
        await kennels.kennel({
            id: KennelResultCacheTests.FAILING,
            dogIds: [lead.lineageId, broken.lineageId],
            visibility: 'public',
            ownerId: null,
            resultCacheTtl: 600,
        });
        const hidden = await kennels.codeDog(
            'RcGateHidden',
            'const s = globalThis["json" + "Store"]; return String(await s.has("rc-gate"));',
        );
        await kennels.kennel({
            id: KennelResultCacheTests.HIDDEN,
            dogIds: [hidden.lineageId],
            visibility: 'public',
            ownerId: null,
            resultCacheTtl: 600,
        });

        const server = await MiniHttp.start(rig.app);
        try {
            for (const label of ['erst', 'dann']) {
                const reply = await server.request('GET', `/k/${KennelResultCacheTests.FAILING}`);
                KennelResultCacheTests.expect(reply, 200, 'miss', `Dog gescheitert, ${label}`);
            }
            if (rig.ran() !== 2) throw new Error(`Dog gescheitert: ${rig.ran()} Laeufe`);
            for (const label of ['erst', 'dann']) {
                const reply = await server.request('GET', `/k/${KennelResultCacheTests.HIDDEN}`);
                KennelResultCacheTests.expect(reply, 200, 'miss', `verdeckt persoenlich, ${label}`);
            }
            const config = await this.config(rig, KennelResultCacheTests.HIDDEN);
            const print = await rig.cache.fingerprints.of(config);
            if (print.classification.klasse === 'persoenlich') throw new Error('Fall ungeeignet: Klassifizierer hat den Zugriff erkannt');
            const downgrade = rig.cache.downgradeOf(KennelResultCacheTests.HIDDEN, print.hash);
            if (!downgrade?.reason.includes('jsonStore')) throw new Error(`Herabstufung fehlt: ${JSON.stringify(downgrade)}`);
            if ((await this.store.countLineage(KennelResultCacheTests.HIDDEN)) !== 0) throw new Error('verdeckt persoenlich doch abgelegt');
        } finally {
            await server.close();
        }
    }

    // --- 5. Schleusen ---

    private async limiterCases(kennels: TestKennels): Promise<void> {
        const pot = (name: string) => new RunAdmission({ name, maxConcurrent: 4, queueTimeoutMs: 2_000, queueMax: 10 });
        const gates = new RunGates(
            pot('heavy'),
            pot('public'),
            new SourceRunGate({ maxInflight: 4, perMinute: 2, burst: 2 }),
            new SourceRunGate({ maxInflight: 10, perMinute: 3, burst: 3 }),
        );
        const rig = this.rig(gates);
        const cached = await kennels.codeDog('RcLimitHit', 'return "h";');
        await kennels.kennel({
            id: KennelResultCacheTests.LIMIT_HIT,
            dogIds: [cached.lineageId],
            visibility: 'public',
            ownerId: null,
            resultCacheTtl: 600,
        });
        const plain = await kennels.codeDog('RcLimitRun', 'return "r";');
        await kennels.kennel({ id: KennelResultCacheTests.LIMIT_RUN, dogIds: [plain.lineageId], visibility: 'public', ownerId: null });

        const server = await MiniHttp.start(rig.app);
        try {
            KennelResultCacheTests.expect(
                await server.request('GET', `/k/${KennelResultCacheTests.LIMIT_HIT}`),
                200,
                'miss',
                'Fehlschlag (Token 1)',
            );
            for (let i = 1; i <= 3; i++) {
                KennelResultCacheTests.expect(
                    await server.request('GET', `/k/${KennelResultCacheTests.LIMIT_HIT}`),
                    200,
                    'hit',
                    `Treffer ${i}`,
                );
            }
            const overHits = await server.request('GET', `/k/${KennelResultCacheTests.LIMIT_HIT}`);
            if (overHits.status !== 429) throw new Error(`Treffer-Budget: ${overHits.status}`);
            KennelResultCacheTests.expectRetryAfterReadable(overHits, 'Treffer-Budget');
            const run = await server.request('GET', `/k/${KennelResultCacheTests.LIMIT_RUN}`);
            if (run.status !== 200) throw new Error(`Treffer haben Lauf-Token genommen: ${run.status} ${run.body.slice(0, 120)}`);
            const overRuns = await server.request('GET', `/k/${KennelResultCacheTests.LIMIT_RUN}`);
            if (overRuns.status !== 429) throw new Error(`Fehlschlag ohne Token: ${overRuns.status}`);
            KennelResultCacheTests.expectRetryAfterReadable(overRuns, 'Fehlschlag ohne Token');
            if (rig.ran() !== 2) throw new Error(`${rig.ran()} Laeufe statt 2`);
        } finally {
            await server.close();
        }
    }

    // --- 6. Statistik ---

    private async statsCases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const dog = await kennels.codeDog('RcDocs', 'return "d";');
        await kennels.kennel({
            id: KennelResultCacheTests.DOCS,
            dogIds: [dog.lineageId],
            visibility: 'public',
            ownerId: null,
            resultCacheTtl: 600,
        });
        const config = await this.config(rig, KennelResultCacheTests.DOCS);
        await rig.handler.runKennel(config, {}, undefined, undefined, undefined, { source: 'swagger' });
        const since = utcDay(new Date(Date.now() - 30 * 86_400_000));
        if (rig.counter.pendingAggregates(since).has(KennelResultCacheTests.DOCS)) throw new Error('Doku-Lauf gezaehlt');
        if (rig.counter.pendingDogAggregates(since).size !== 0) throw new Error('Doku-Lauf hat Dog-Zeilen');

        const server = await MiniHttp.start(rig.app);
        try {
            KennelResultCacheTests.expect(await server.request('GET', `/k/${KennelResultCacheTests.DOCS}`), 200, 'miss', 'Statistik erst');
            KennelResultCacheTests.expect(await server.request('GET', `/k/${KennelResultCacheTests.DOCS}`), 200, 'hit', 'Statistik dann');
        } finally {
            await server.close();
        }
        const agg = rig.counter.pendingAggregates(since).get(KennelResultCacheTests.DOCS);
        if (!agg || agg.last30d !== 2 || agg.cached30d !== 1) throw new Error(`Zaehlung: ${JSON.stringify(agg)}`);
        const dogRuns = [...rig.counter.pendingDogAggregates(since).values()].reduce((n, d) => n + d.count30d, 0);
        if (dogRuns !== 1) throw new Error(`Dog-Zeilen: ${dogRuns} statt 1 (Treffer ohne Dog-Lauf)`);
    }

    // --- 7. P4 ---

    private async p4Cases(kennels: TestKennels): Promise<void> {
        const rig = this.rig();
        const owner = KennelResultCacheTests.OWNER;
        const live = await kennels.codeDog('RcLanding', 'return "<!doctype html><html><body>" + Math.random() + "</body></html>";');
        await kennels.kennel({ id: KennelResultCacheTests.LANDING, dogIds: [live.lineageId], visibility: 'public', ownerId: owner });
        const first = await rig.handler.runLeadAsAnonymous(KennelResultCacheTests.LANDING, {}, { source: 'landing' });
        const second = await rig.handler.runLeadAsAnonymous(KennelResultCacheTests.LANDING, {}, { source: 'landing' });
        if (rig.ran() !== 1 || typeof first !== 'string' || first !== second) throw new Error(`Landing: ${rig.ran()} Laeufe`);
        if ((await this.store.countLineage(KennelResultCacheTests.LANDING)) !== 1)
            throw new Error('Landing: kein Eintrag im Scope landing');

        const pure = await kennels.codeDog('RcAdvice', 'return "a";');
        await kennels.kennel({ id: KennelResultCacheTests.ADVICE, dogIds: [pure.lineageId], visibility: 'public', ownerId: owner });
        const hidden = await kennels.codeDog(
            'RcHiddenOwned',
            'const s = globalThis["json" + "Store"]; return String(await s.has("rc-p4"));',
        );
        await kennels.kennel({
            id: KennelResultCacheTests.HIDDEN_OWNED,
            dogIds: [hidden.lineageId],
            visibility: 'public',
            ownerId: owner,
            resultCacheTtl: 600,
        });

        const stats = {
            attachOne: async <T extends object>(k: T) => ({ ...k, stats: { calls: { last30d: 150, cached30d: 0 } } }),
        } as unknown as KennelStatsService;
        const app = express();
        app.use(MiniHttp.identity());
        new KennelResultCacheHandler(this.deps.kennelsController, rig.handler, stats).registerRoutes(app);
        app.use(rig.app);
        const server = await MiniHttp.start(app);
        try {
            const read = async (id: string, userId?: string) => {
                const reply = await server.request('GET', `/api/kennels/${id}/result-cache`, userId ? { [MiniHttp.USER]: userId } : {});
                return { status: reply.status, body: reply.status === 200 ? JSON.parse(reply.body) : reply.body };
            };
            const asOwner = await read(KennelResultCacheTests.ADVICE, owner);
            if (
                asOwner.status !== 200 ||
                asOwner.body.canChange !== true ||
                !String(asOwner.body.cacheClass?.hinweis).includes('set resultCacheTtl')
            )
                throw new Error(`REST Besitzer: ${JSON.stringify(asOwner)}`);
            const asReader = await read(KennelResultCacheTests.ADVICE);
            if (
                asReader.status !== 200 ||
                asReader.body.canChange !== false ||
                asReader.body.cacheClass?.hinweis !== undefined ||
                asReader.body.cacheClass?.klasse !== 'rein'
            )
                throw new Error(`REST Leser: ${JSON.stringify(asReader)}`);
            const hiddenPrivate = await read(KennelResultCacheTests.PRIVATE);
            if (hiddenPrivate.status !== 404) throw new Error(`REST privat anonym: ${hiddenPrivate.status}`);

            KennelResultCacheTests.expect(
                await server.request('GET', `/k/${KennelResultCacheTests.HIDDEN_OWNED}`),
                200,
                'miss',
                'Herabstufung',
            );
            const header = await this.tool(
                rig,
                'get_kennel',
                { id: KennelResultCacheTests.HIDDEN_OWNED },
                KennelResultCacheTests.user(owner),
            );
            const shown = JSON.parse(header.text);
            if (!String(shown.cacheClass?.herabgestuft).includes('jsonStore'))
                throw new Error(`get_kennel Besitzer: ${JSON.stringify(shown.cacheClass)}`);
            const stranger = JSON.parse(
                (await this.tool(rig, 'get_kennel', { id: KennelResultCacheTests.HIDDEN_OWNED }, KennelResultCacheTests.user('URX'))).text,
            );
            if (stranger.cacheClass?.herabgestuft !== undefined || stranger.cacheClass?.hinweis !== undefined)
                throw new Error(`get_kennel Fremder sieht Besitzer-Notizen: ${JSON.stringify(stranger.cacheClass)}`);
        } finally {
            await server.close();
        }
    }

    // --- Hilfen ---

    private rig(gates?: RunGates): CacheRig {
        const counter = new KennelCallCounter(KennelResultCacheTests.NO_STATS, { flushIntervalMs: 0 });
        const handler = new KennelRunHandler({
            kennelsController: this.deps.kennelsController,
            nodesStore: this.deps.nodesStore,
            baseDogsMap: this.deps.baseDogsMap,
            callCounter: counter,
            ...(gates ? { runGates: gates } : {}),
        });
        return new CacheRig(handler, this.store, counter);
    }

    private async config(rig: CacheRig, id: string): Promise<IKennelConfig> {
        const config = await rig.handler.loadKennelConfig(id);
        if (!config) throw new Error(`Kennel ${id} nicht geladen`);
        return config;
    }

    private async tool(
        rig: CacheRig,
        name: string,
        args: Record<string, unknown>,
        ctx: AuthCtx,
    ): Promise<{ isError: boolean; text: string }> {
        const tool = getKennelTools().find((t) => t.name === name);
        if (!tool) throw new Error(`Werkzeug ${name} fehlt`);
        const result = await tool.handler(args, ctx, this.deps.toolDepsFor(rig.handler));
        return { isError: Boolean(result.isError), text: String(result.content[0]?.text ?? '') };
    }

    private static expect(reply: MiniReply, status: number, cache: string, label: string): void {
        const got = reply.headers['x-slopdogs-cache'];
        if (reply.status !== status || got !== cache)
            throw new Error(`${label}: ${reply.status} X-SlopDogs-Cache=${String(got)} ${reply.body.slice(0, 160)}`);
    }

    /** 429 traegt Retry-After, und CORS gibt es fremdem Browser-Code frei (#24, Punkt 18). */
    private static expectRetryAfterReadable(reply: MiniReply, label: string): void {
        if (!/^\d+$/.test(String(reply.headers['retry-after'] ?? ''))) throw new Error(`${label}: Retry-After fehlt`);
        const exposed = String(reply.headers['access-control-expose-headers'] ?? '')
            .split(',')
            .map((name) => name.trim().toLowerCase());
        for (const name of ['retry-after', 'x-slopdogs-cache', 'age']) {
            if (!exposed.includes(name))
                throw new Error(`${label}: ${name} nicht in Access-Control-Expose-Headers (${exposed.join(', ')})`);
        }
    }

    private static user(id: string): AuthCtx {
        return { user: { id, email: `${id.toLowerCase()}@test.invalid`, name: null }, isSuperUser: false };
    }
}
