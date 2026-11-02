import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { isHtmlResultString } from '../services/leadResultStringFormat';
import { BetaKeys } from '../mcp/auth/betaKeys';
import { LandingPage, type LandingRunner } from './LandingPage';

/** Die Kopfversion eines Dogs, soweit der Fingerabdruck sie braucht. */
export interface KennelListDogHead {
    lineageId?: string;
    id?: string;
    parentsRequired?: unknown;
    parentsOptional?: unknown;
}

/** Was die Seite vom Server liest, um zu merken, dass sich ihr Kennel geaendert hat. */
export interface KennelListPageDeps {
    /** Kopfversion des Kennels (Versions-ID und dogIds); null, wenn es ihn nicht gibt. */
    kennelHead(kennelId: string): Promise<{ id: string; dogIds: string[] } | null>;
    /** Referenz -> lineageId; null fuer Base-Dogs. */
    lineageOf(ref: string): Promise<string | null>;
    /** Kopfversionen dieser Lineages. */
    dogHeads(lineageIds: string[]): Promise<KennelListDogHead[]>;
}

export interface KennelListPageOptions {
    kennelId?: string;
    /** Env KENNEL_LIST_PAGE: `off` schaltet ab, /kennels bleibt die Angular-Liste. */
    enabled: boolean;
    /** Env LANDING_HTML_MEMO_MS (gleiches Fenster wie die Landing), Default 300000. */
    memoMs: number;
    now?: () => number;
    /** Obergrenze der besuchten Dogs je Fingerabdruck. */
    maxDogs?: number;
}

/** Die gemerkte Seite. `html: null` = Kennel fehlt oder lieferte nichts — bis `at + memoMs` gilt er als aus. */
interface KennelListMemo {
    html: string | null;
    at: number;
    fingerprint: string | null;
}

function refList(raw: unknown): string[] {
    let list: unknown = raw;
    if (typeof raw === 'string') {
        try {
            list = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}

/**
 * `/kennels` ist ein Kennel (Spur K): die Lead-Ausgabe von `slopdogs-kennels`, anonym gelaufen und fuer alle gleich
 * (alles Persoenliche holt die Seite im Browser per same-origin fetch). Liefert der Lauf nichts, reicht der Haken
 * per next() weiter — in prod/lokal an den SPA-Fallback, also die Angular-Liste.
 *
 * Live anpassbar: jede Aenderung am Referenzindex (neue Dog- oder Kennel-Version) markiert die Seite; die naechste
 * Anfrage rechnet den Fingerabdruck (Kennel-Kopf + Kopfversionen aller Dogs, transitiv ueber Parents) und verwirft
 * das Memo, wenn er sich geaendert hat — die naechste Seite zeigt die neue Version sofort. Antwort mit ETag und
 * `Cache-Control: no-cache` statt max-age: kein Browser haelt eine alte Fassung fest, unveraendert kommt 304.
 */
export class KennelListPage {
    static readonly KENNEL_ID = 'slopdogs-kennels';
    static readonly CACHE_CONTROL = 'no-cache';
    static readonly DEFAULT_MAX_DOGS = 200;

    readonly kennelId: string;
    readonly enabled: boolean;
    readonly memoMs: number;
    private readonly now: () => number;
    private readonly maxDogs: number;
    private runner: LandingRunner | null = null;
    private deps: KennelListPageDeps | null = null;
    private memo: KennelListMemo | null = null;
    private inFlight: Promise<KennelListMemo> | null = null;
    /** Seit der letzten Pruefung hat sich am Referenzindex etwas getan. */
    private dirty = true;
    private runCount = 0;

    constructor(options: KennelListPageOptions) {
        this.kennelId = options.kennelId ?? KennelListPage.KENNEL_ID;
        this.enabled = options.enabled;
        this.memoMs = options.memoMs;
        this.now = options.now ?? (() => Date.now());
        this.maxDogs = options.maxDogs ?? KennelListPage.DEFAULT_MAX_DOGS;
    }

    static fromEnv(env: NodeJS.ProcessEnv = process.env): KennelListPage {
        const enabled = (env.KENNEL_LIST_PAGE ?? '').trim().toLowerCase() !== 'off';
        const parsed = Number.parseInt((env.LANDING_HTML_MEMO_MS ?? '').trim(), 10);
        const page = new KennelListPage({ enabled, memoMs: Number.isInteger(parsed) && parsed > 0 ? parsed : LandingPage.DEFAULT_MEMO_MS });
        console.log(
            enabled
                ? `[KennelListPage] /kennels liefert ${page.kennelId}, solange er laeuft (sonst die Angular-Liste)`
                : '[KennelListPage] aus (KENNEL_LIST_PAGE=off) — /kennels ist die Angular-Liste',
        );
        return page;
    }

    /** Lauf-Lieferant und Fingerabdruck kommen nach dem Montieren der Routen (createHttpApplication). */
    use(runner: LandingRunner, deps: KennelListPageDeps): void {
        this.runner = runner;
        this.deps = deps;
    }

    /** Vom Referenzindex: irgendein Dog oder Kennel bekam eine neue Version — die naechste Anfrage prueft nach. */
    markChanged(): void {
        this.dirty = true;
    }

    /** Wie viele Kennel-Laeufe die Seite ausgeloest hat. */
    get runs(): number {
        return this.runCount;
    }

    /**
     * Fuer die Angular-App (GET /api/kennel-list): liefert `/kennels` gerade den Kennel? Ohne Lauf im Fenster gilt er
     * als aktiv, solange es ihn gibt — die erste Seite laeuft ihn; scheitert sie, faellt der Server zurueck.
     */
    async status(): Promise<{ active: boolean; kennelId: string }> {
        if (!this.enabled || !this.runner || !this.deps) return { active: false, kennelId: this.kennelId };
        await this.checkFingerprint();
        const memo = this.memo;
        const active = memo ? !!memo.html || (memo.fingerprint !== null && this.now() - memo.at >= this.memoMs) : true;
        return { active, kennelId: this.kennelId };
    }

    /** Die Seite (ohne Host/Stage), oder null — dann gilt der Rueckfall. */
    async page(): Promise<string | null> {
        if (!this.enabled || !this.runner || !this.deps) return null;
        await this.checkFingerprint();
        const memo = this.memo;
        if (memo) {
            if (this.now() - memo.at < this.memoMs) return memo.html;
            if (memo.html) {
                void this.refresh();
                return memo.html;
            }
        }
        return (await this.refresh()).html;
    }

    async handleGet(req: Request, res: Response, next: NextFunction): Promise<void> {
        let html: string | null;
        try {
            html = await this.page();
        } catch (err) {
            console.error('[KennelListPage]', err);
            html = null;
        }
        if (!html) {
            next();
            return;
        }
        const body = LandingPage.withHost(html, LandingPage.baseOf(req), BetaKeys.stage());
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', KennelListPage.CACHE_CONTROL);
        res.setHeader('ETag', `"kl-${createHash('sha1').update(body).digest('base64url').slice(0, 27)}"`);
        res.setHeader('X-Kennel-List', this.kennelId);
        // Express antwortet 304, wenn If-None-Match dieses ETag traegt (req.fresh in res.send).
        res.status(200).send(body);
    }

    /** HEAD /kennels: nie ein Lauf — nur, was das Memo schon hat; sonst der Rueckfall. */
    handleHead(_req: Request, res: Response, next: NextFunction): void {
        if (!this.enabled || !this.memo?.html) {
            next();
            return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', KennelListPage.CACHE_CONTROL);
        res.setHeader('X-Kennel-List', this.kennelId);
        res.status(200).end();
    }

    /** Nach einer Index-Aenderung: Fingerabdruck neu; anders als der gemerkte -> Memo weg. Wirft nie. */
    private async checkFingerprint(): Promise<void> {
        if (!this.dirty || !this.deps) return;
        this.dirty = false;
        try {
            const fingerprint = await this.fingerprint();
            // Kennel weg (geloescht): gleich als "aus" merken — /kennels und /api/kennel-list fallen ohne Lauf zurueck.
            if (this.memo && this.memo.fingerprint !== fingerprint)
                this.memo = fingerprint === null ? { html: null, at: this.now(), fingerprint: null } : null;
        } catch (err) {
            console.warn('[KennelListPage] Fingerabdruck gescheitert — Memo verworfen:', (err as Error)?.message ?? err);
            this.memo = null;
        }
    }

    /** Kennel-Kopf + Kopfversionen aller Dogs, die er nutzt (dogIds und Parents, transitiv); null = Kennel fehlt. */
    async fingerprint(): Promise<string | null> {
        const deps = this.deps;
        if (!deps) return null;
        const head = await deps.kennelHead(this.kennelId);
        if (!head) return null;
        const seen = new Set<string>();
        const versions: string[] = [];
        let frontier = [...head.dogIds];
        while (frontier.length > 0 && seen.size < this.maxDogs) {
            const next: string[] = [];
            for (const ref of frontier) {
                const lineageId = await deps.lineageOf(ref);
                if (!lineageId || seen.has(lineageId)) continue;
                seen.add(lineageId);
                next.push(lineageId);
            }
            if (next.length === 0) break;
            frontier = [];
            for (const dog of await deps.dogHeads(next)) {
                versions.push(`${dog.lineageId ?? dog.id}:${dog.id}`);
                frontier.push(...refList(dog.parentsRequired), ...refList(dog.parentsOptional));
            }
        }
        return `${head.id}|${versions.sort().join(',')}`;
    }

    /** Ein Lauf zur Zeit. Wirft er, bleibt eine vorhandene Seite fuer ein weiteres Fenster stehen. */
    private refresh(): Promise<KennelListMemo> {
        if (this.inFlight) return this.inFlight;
        const previous = this.memo;
        const run = (async (): Promise<KennelListMemo> => {
            const fingerprint = await this.fingerprint().catch(() => previous?.fingerprint ?? null);
            let html: string | null;
            try {
                html = fingerprint === null ? null : await this.render();
            } catch (err) {
                console.warn(`[KennelListPage] ${this.kennelId}: Lauf gescheitert —`, (err as Error)?.message ?? err);
                html = previous?.fingerprint === fingerprint ? (previous?.html ?? null) : null;
            }
            const entry: KennelListMemo = { html, at: this.now(), fingerprint };
            this.memo = entry;
            return entry;
        })().finally(() => {
            if (this.inFlight === run) this.inFlight = null;
        });
        this.inFlight = run;
        return run;
    }

    private async render(): Promise<string | null> {
        if (!this.runner) return null;
        this.runCount += 1;
        const startedAt = Date.now();
        const result = await this.runner.runLeadAsAnonymous(this.kennelId, {}, { source: 'landing' });
        const html = typeof result === 'string' && isHtmlResultString(result) ? result : null;
        console.log(
            `[KennelListPage] ${this.kennelId}: ${html ? `${Buffer.byteLength(html)} B` : 'keine HTML-Ausgabe (Rueckfall Angular-Liste)'} in ${Date.now() - startedAt} ms`,
        );
        return html;
    }
}
