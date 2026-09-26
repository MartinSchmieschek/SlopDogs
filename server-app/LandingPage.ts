import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import type { KennelRunAttribution } from '../api/routes/KennelRunHandler';
import { isHtmlResultString } from '../services/leadResultStringFormat';
import { LandingKennels } from '../mcp/auth/landingKennels';
import { BetaKeys } from '../mcp/auth/betaKeys';

/** Wer die Lead-Ausgabe eines Kennels liefert — der KennelRunHandler (P5: `runLeadAsAnonymous`). */
export interface LandingRunner {
    runLeadAsAnonymous(kennelId: string, query: Record<string, string>, attribution: KennelRunAttribution): Promise<unknown | null>;
}

export interface LandingPageOptions {
    /** `public/` — dort liegt der statische Fallback `landing/index.html`. */
    publicDir: string | null;
    /** Env LANDING_KENNEL_IDS (Alias LANDING_KENNEL_ID): die Kennels, zwischen denen `/` rotiert. Leer = nur der Default. */
    kennelIds: readonly string[];
    /** Der absolute Standard hinter der Liste: der geseedete `slopdogs-landing`. */
    defaultKennelId?: string;
    /** Env LANDING_HTML_MEMO_MS, Default 300000 (je Kennel). */
    memoMs: number;
    now?: () => number;
    /** Zufall fuer die Rotation, [0, 1) — Tests setzen ihn fest. */
    random?: () => number;
}

/** Die gemerkte Seite eines Kennels. `html: null` = Kennel fehlt oder lieferte nichts — bis `at + memoMs` wird er uebersprungen. */
interface LandingMemoEntry {
    html: string | null;
    at: number;
}

export interface LandingPageResult {
    html: string;
    source: 'kennel' | 'fallback';
    /** Welcher Kennel die Seite geliefert hat (nur bei `source: 'kennel'`). */
    kennelId?: string;
}

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * `/` ist ein Kennel (PLAN P5, Dogfooding) — seit 2026-09-26 einer aus einer Rotation: die Env LANDING_KENNEL_IDS
 * listet Kennels, jeder Besuch zieht gleichverteilt zufaellig einen davon (`?landing=<id>` erzwingt einen aus der
 * Liste). Warum Zufall je Besuch: zustandslos (kein Cookie, kein Zaehler, der ueber Prozesse hinweg stimmen muesste),
 * jeder gelistete Kennel kommt auf Dauer gleich oft dran, und das Memo je Kennel haelt die Kosten bei einem Lauf je
 * Kennel und Fenster — egal, wie viele Besucher kommen. Ein gelisteter Kennel, der fehlt, nicht oeffentlich ist oder
 * kein HTML liefert, wird fuer das Memo-Fenster uebersprungen; der naechste aus der gemischten Liste springt ein.
 *
 * Dahinter der absolute Standard `slopdogs-landing` (geseedet, nur Mixtape): er greift, wenn die Liste leer ist oder
 * keiner der gelisteten laeuft. Dahinter der statische Fallback `public/landing/index.html` — die Seite ist nie leer.
 * Laeufe zaehlen mit der Quelle `landing` (ranken nicht). Ein abgelaufenes Memo liefert sofort und erneuert im
 * Hintergrund. Der Host (`‹host›` in der Ausgabe) kommt je Anfrage aus MCP_BASE_URL bzw. dem Request, nie ins Memo.
 */
export class LandingPage {
    static readonly DEFAULT_KENNEL_ID = 'slopdogs-landing';
    static readonly DEFAULT_MEMO_MS = 300_000;
    static readonly CACHE_CONTROL = 'public, max-age=300';
    /** Rotiert `/` zwischen mehreren Kennels, darf kein Cache einen Besuch fuer fuenf Minuten festhalten. */
    static readonly ROTATION_CACHE_CONTROL = 'no-cache';
    /** `?landing=<id>` erzwingt einen gelisteten Kennel. */
    static readonly FORCE_PARAM = 'landing';
    /** So zeigen die Skins den Platzhalter `<host>` an. */
    static readonly HOST_MARK = '‹host›';
    /** Der Stage-Platzhalter in `<html data-stage="…">` (Skin C, "STAGE FLAG"): SLOPDOGS_STAGE, sonst leer. */
    static readonly STAGE_MARK = '‹stage›';

    readonly kennelIds: readonly string[];
    readonly defaultKennelId: string;
    readonly memoMs: number;
    private readonly now: () => number;
    private readonly random: () => number;
    private readonly fallbackFile: string | null;
    private fallbackHtml: string | null = null;
    private runner: LandingRunner | null = null;
    private readonly memo = new Map<string, LandingMemoEntry>();
    private readonly inFlight = new Map<string, Promise<LandingMemoEntry>>();
    private runCount = 0;

    constructor(options: LandingPageOptions) {
        const seen = new Set<string>();
        this.kennelIds = options.kennelIds.map((id) => id.trim()).filter((id) => id && !seen.has(id) && seen.add(id));
        this.defaultKennelId = options.defaultKennelId ?? LandingPage.DEFAULT_KENNEL_ID;
        this.memoMs = options.memoMs;
        this.now = options.now ?? (() => Date.now());
        this.random = options.random ?? Math.random;
        this.fallbackFile = options.publicDir ? path.join(options.publicDir, 'landing', 'index.html') : null;
    }

    static fromEnv(publicDir: string | null): LandingPage {
        const landing = new LandingPage({
            publicDir,
            kennelIds: LandingKennels.ids(),
            memoMs: positiveIntFromEnv('LANDING_HTML_MEMO_MS', LandingPage.DEFAULT_MEMO_MS),
        });
        console.log(landing.kennelIds.length
            ? `[LandingPage] / rotiert zwischen ${landing.kennelIds.join(', ')} (schreibgeschuetzt); Standard ${landing.defaultKennelId}`
            : `[LandingPage] / liefert ${landing.defaultKennelId} (LANDING_KENNEL_IDS leer)`);
        return landing;
    }

    /** Der Lauf-Lieferant kommt nach dem Montieren der Routen (createHttpApplication); bis dahin gilt der Fallback. */
    useRunner(runner: LandingRunner): void {
        this.runner = runner;
    }

    /** Wie viele Kennel-Laeufe die Landing ausgeloest hat — Messpunkt fuer "kein Lauf je Besuch". */
    get runs(): number {
        return this.runCount;
    }

    /** Rotiert `/` gerade zwischen mehreren Kennels? Dann kein oeffentliches Caching. */
    get rotates(): boolean {
        return this.kennelIds.length > 1;
    }

    /** Ein erzwungener Kennel zaehlt nur, wenn er in der Liste steht — `?landing=` oeffnet keinen beliebigen Kennel. */
    forcedOf(raw: unknown): string | null {
        const wanted = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase();
        return wanted ? this.kennelIds.find((id) => id.toLowerCase() === wanted) ?? null : null;
    }

    /**
     * Die Reihenfolge fuer einen Besuch: der erzwungene zuerst, sonst die Liste gleichverteilt gemischt
     * (Fisher-Yates); der Default ganz hinten, sofern er nicht selbst gelistet ist.
     */
    private candidates(forced: string | null): string[] {
        const rest = this.kennelIds.filter((id) => id !== forced);
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.min(i, Math.floor(this.random() * (i + 1)));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        const order = forced ? [forced, ...rest] : rest;
        if (!order.includes(this.defaultKennelId)) order.push(this.defaultKennelId);
        return order;
    }

    /**
     * Die Seite fuer einen Besuch: der erste Kennel der Reihenfolge, der eine Seite hat — frisch aus dem Memo;
     * abgelaufen aus dem Memo mit Refresh im Hintergrund; ohne Memo ein Lauf (je Kennel hoechstens einer gleichzeitig).
     * Ein Kennel, dessen Memo "nichts" sagt, wird bis zum Ende des Fensters uebersprungen. `null` nur, wenn weder ein
     * Kennel noch der Fallback da sind.
     */
    async page(forced: string | null = null): Promise<LandingPageResult | null> {
        for (const kennelId of this.candidates(forced)) {
            const entry = this.memo.get(kennelId);
            if (entry) {
                if (this.now() - entry.at >= this.memoMs) void this.refresh(kennelId);
                if (entry.html) return { html: entry.html, source: 'kennel', kennelId };
                continue;
            }
            if (!this.runner) continue;
            const fresh = await this.refresh(kennelId);
            if (fresh.html) return { html: fresh.html, source: 'kennel', kennelId };
        }
        return this.fallbackResult();
    }

    async handleGet(req: Request, res: Response, next: NextFunction): Promise<void> {
        const forced = this.forcedOf(req.query?.[LandingPage.FORCE_PARAM]);
        let page: LandingPageResult | null;
        try {
            page = await this.page(forced);
        } catch (err) {
            console.error('[LandingPage]', err);
            page = this.fallbackResult();
        }
        if (!page) {
            next();
            return;
        }
        this.setHeaders(res, page, !!forced);
        res.status(200).send(LandingPage.withHost(page.html, LandingPage.baseOf(req), BetaKeys.stage()));
    }

    /** HEAD / (Keepalive, ki-fruechte): nie ein Lauf — nur, was Memo oder Fallback schon haben. */
    handleHead(req: Request, res: Response, next: NextFunction): void {
        const forced = this.forcedOf(req.query?.[LandingPage.FORCE_PARAM]);
        const kennelId = this.candidates(forced).find((id) => this.memo.get(id)?.html);
        const page = kennelId ? { html: this.memo.get(kennelId)!.html!, source: 'kennel' as const, kennelId } : this.fallbackResult();
        if (!page) {
            next();
            return;
        }
        this.setHeaders(res, page, !!forced);
        res.status(200).end();
    }

    /**
     * `https://‹host›` wird die Basis-URL, jedes weitere `‹host›` ihr Host; ohne gueltige Basis bleibt der Platzhalter.
     * `‹stage›` wird die Stage (SLOPDOGS_STAGE, normalisiert auf [a-z0-9-]): `beta` zeigt den Beta-Sticker, leer nichts.
     * Gilt fuer die Kennel-Ausgabe und den statischen Fallback gleich.
     */
    static withHost(html: string, base: URL | null, stage = ''): string {
        const staged = html.split(LandingPage.STAGE_MARK).join(stage);
        if (!base) return staged;
        return staged.split(`https://${LandingPage.HOST_MARK}`).join(base.origin).split(LandingPage.HOST_MARK).join(base.host);
    }

    /** Die oeffentliche Basis: MCP_BASE_URL, sonst Protokoll + Host der Anfrage — nur, was als Host taugt. */
    static baseOf(req: Request): URL | null {
        const raw = process.env.MCP_BASE_URL?.trim() || `${req.protocol}://${req.get('host') ?? ''}`;
        try {
            const url = new URL(raw);
            if (!/^https?:$/.test(url.protocol) || !/^[a-z0-9.:\-[\]]+$/i.test(url.host)) return null;
            return url;
        } catch {
            return null;
        }
    }

    private setHeaders(res: Response, page: LandingPageResult, forced: boolean): void {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', this.rotates && !forced ? LandingPage.ROTATION_CACHE_CONTROL : LandingPage.CACHE_CONTROL);
        res.setHeader('X-Landing-Source', page.source);
        if (page.kennelId) res.setHeader('X-Landing-Kennel', page.kennelId);
    }

    private fallbackResult(): LandingPageResult | null {
        const fallback = this.fallback();
        return fallback ? { html: fallback, source: 'fallback' } : null;
    }

    /** Die gebaute Seite; einmal gelesen, danach aus dem Speicher. */
    private fallback(): string | null {
        if (this.fallbackHtml !== null) return this.fallbackHtml;
        if (!this.fallbackFile || !fs.existsSync(this.fallbackFile)) return null;
        this.fallbackHtml = fs.readFileSync(this.fallbackFile, 'utf8');
        return this.fallbackHtml;
    }

    /**
     * Ein Lauf je Kennel zur Zeit. Wirft er, bleibt eine vorhandene Seite fuer ein weiteres Fenster stehen, sonst wird
     * der Kennel uebersprungen; liefert er nichts (Kennel weg, nicht oeffentlich, Lead ohne HTML), wird er
     * uebersprungen — auch nach einer guten Seite.
     */
    private refresh(kennelId: string): Promise<LandingMemoEntry> {
        const running = this.inFlight.get(kennelId);
        if (running) return running;
        const previous = this.memo.get(kennelId);
        const run = this.render(kennelId)
            .catch((err) => {
                console.warn(`[LandingPage] ${kennelId}: Lauf gescheitert —`, (err as Error)?.message ?? err);
                return previous?.html ?? null;
            })
            .then((html) => {
                const entry: LandingMemoEntry = { html, at: this.now() };
                this.memo.set(kennelId, entry);
                return entry;
            })
            .finally(() => {
                if (this.inFlight.get(kennelId) === run) this.inFlight.delete(kennelId);
            });
        this.inFlight.set(kennelId, run);
        return run;
    }

    private async render(kennelId: string): Promise<string | null> {
        if (!this.runner) return null;
        this.runCount += 1;
        const startedAt = Date.now();
        const rssBefore = process.memoryUsage().rss;
        const result = await this.runner.runLeadAsAnonymous(kennelId, {}, { source: 'landing' });
        const html = typeof result === 'string' && isHtmlResultString(result) ? result : null;
        const mb = (bytes: number) => Math.round(bytes / 1048576);
        console.log(`[LandingPage] ${kennelId}: ${html ? `${Buffer.byteLength(html)} B` : 'keine HTML-Ausgabe (uebersprungen)'} in ${Date.now() - startedAt} ms, RSS ${mb(rssBefore)} -> ${mb(process.memoryUsage().rss)} MB`);
        return html;
    }
}
