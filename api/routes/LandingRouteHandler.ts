// LandingRouteHandler — GET /api/landing (P4 4.7): die zwei Ranglisten fuer die Landing, aus einem
// 60-s-Memo. Gelesen wird wie ein Anonymer: dieselbe Landing fuer Owner und Fremde, und nie ein
// Feld, das ein Anonymer nicht ohnehin ueber /api/kennels bekaeme. Oeffentlich = ausfuehrbar und
// sichtbar (8.17): public- und run-only-Kennels erscheinen; defaultQuery steht nur in der url,
// wenn der Kennel fuer Anonyme lesbar ist (READ), sonst bliebe Konfiguration hinter RUN sichtbar.
// P4b: provenDogs — die bewaehrten Dogs (Abzeichen, nach proven.score), SerializedDogs/Mimics, die ein
// Anonymer ausfuehren darf (dieselbe Regel wie die Kennel-Listen); Base-Dogs nie (Infrastruktur dominiert).
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { publicKennelPath } from '@slopdogs/core';
import { KennelController } from '../KennelController';
import { canRead, filterRunnable } from '../../mcp/auth/visibility';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { KennelStatsService, statsKeyOf, type KennelStats } from '../../services/KennelStatsService';
import type { DogStats, DogStatsService } from '../../services/DogStatsService';
import { API_ROUTE } from './routeTable';

export interface LandingEntry {
    id: string;
    lineageId: string;
    name: string | null;
    emoji: string | null;
    description: string | null;
    url: string;
    stats: KennelStats;
}

export interface LandingDogEntry {
    id: string;
    lineageId: string;
    displayName: string | null;
    description: string | null;
    icon: string | null;
    stats: DogStats;
}

/** Woher die Landing ihre Dogs nimmt (P4b): die Kopfversionen und ihre stats. */
export interface LandingDogSource {
    listDogs(): Promise<any[]>;
    dogStats: DogStatsService;
}

interface LandingMemo {
    at: number;
    generatedAt: string;
    topByCalls30d: LandingEntry[];
    topByRating: LandingEntry[];
    provenDogs: LandingDogEntry[];
}

const ANON: AuthCtx = { user: null, isSuperUser: false };
const DESCRIPTION_MAX = 140;

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export class LandingRouteHandler {
    static readonly DEFAULT_LIMIT = 10;
    static readonly MAX_LIMIT = 50;

    private memo: LandingMemo | null = null;
    private loading: Promise<LandingMemo> | null = null;
    private memoLoadCount = 0;
    /** Ein Laden, das eine Invalidierung ueberholt hat, merkt sich nichts. */
    private generation = 0;

    constructor(
        private readonly kennelsController: KennelController,
        private readonly stats: KennelStatsService,
        private readonly dogs?: LandingDogSource,
        private readonly memoMs = positiveIntFromEnv('LANDING_MEMO_MS', 60_000),
        private readonly now: () => number = () => Date.now(),
    ) {
        const invalidate = () => {
            this.memo = null;
            this.loading = null;
            this.generation += 1;
        };
        stats.onInvalidate(invalidate);
        dogs?.dogStats.onInvalidate(invalidate);
    }

    /** Wie oft die Ranglisten neu gebaut wurden (listLatest + stats) — Messpunkt fuer Test 12. */
    get memoLoads(): number {
        return this.memoLoadCount;
    }

    registerRoutes(app: any): void {
        app.get(API_ROUTE.landing, (req: Request, res: Response) => this.handleLanding(req, res));
    }

    private async handleLanding(req: Request, res: Response): Promise<void> {
        try {
            const limit = LandingRouteHandler.parseLimit(req.query?.limit);
            const memo = await this.current();
            const body = {
                ok: true,
                generatedAt: memo.generatedAt,
                windowDays: KennelStatsService.WINDOW_DAYS,
                topByCalls30d: memo.topByCalls30d.slice(0, limit),
                topByRating: memo.topByRating.slice(0, limit),
                provenDogs: memo.provenDogs.slice(0, limit),
            };
            const text = JSON.stringify(body);
            const etag = `"${createHash('sha1').update(text).digest('hex')}"`;
            res.setHeader('Cache-Control', `public, max-age=${Math.round(this.memoMs / 1000)}`);
            res.setHeader('ETag', etag);
            const ifNoneMatch = String(req.get?.('if-none-match') ?? req.headers?.['if-none-match'] ?? '');
            if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(etag)) {
                res.status(304).end();
                return;
            }
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).send(text);
        } catch (err) {
            console.error('[LandingRouteHandler]', err);
            res.status(500).json({ error: 'internal_error' });
        }
    }

    private async current(): Promise<LandingMemo> {
        if (this.memo && this.now() - this.memo.at < this.memoMs) return this.memo;
        if (!this.loading) {
            const loading: Promise<LandingMemo> = this.load().finally(() => {
                if (this.loading === loading) this.loading = null;
            });
            this.loading = loading;
        }
        return this.loading;
    }

    private async load(): Promise<LandingMemo> {
        this.memoLoadCount += 1;
        const at = this.now();
        const generation = this.generation;
        const listed = await this.kennelsController.listLatest();
        if (!listed.ok) throw new Error(listed.error ?? 'listLatest failed');
        const visible = filterRunnable((listed.data ?? []) as any[], ANON);
        const withStats = await this.stats.attach(visible);
        const entries = withStats.map((k) => LandingRouteHandler.entryOf(k));
        const byName = (a: LandingEntry, b: LandingEntry) => String(a.name ?? a.lineageId).localeCompare(String(b.name ?? b.lineageId));
        const topByCalls30d = entries
            .filter((e) => e.stats.calls.ranked30d > 0)
            .sort((a, b) => b.stats.calls.ranked30d - a.stats.calls.ranked30d || b.stats.calls.ranked - a.stats.calls.ranked || byName(a, b))
            .slice(0, LandingRouteHandler.MAX_LIMIT);
        const topByRating = entries
            .filter((e) => e.stats.rating.count > 0)
            .sort((a, b) => b.stats.rating.score - a.stats.rating.score || b.stats.rating.count - a.stats.rating.count || byName(a, b))
            .slice(0, LandingRouteHandler.MAX_LIMIT);
        const provenDogs = await this.loadProvenDogs();
        const memo: LandingMemo = { at, generatedAt: new Date(at).toISOString(), topByCalls30d, topByRating, provenDogs };
        if (generation === this.generation) this.memo = memo;
        return memo;
    }

    /** Bewaehrte Dogs (P4b): nur mit Abzeichen, nach proven.score, dann ranked30d, dann Name. */
    private async loadProvenDogs(): Promise<LandingDogEntry[]> {
        if (!this.dogs) return [];
        const visible = filterRunnable((await this.dogs.listDogs()) as any[], ANON)
            .map((d) => ({ id: d.id, lineageId: d.lineageId || d.id, ownerId: d.ownerId ?? null, displayName: d.displayName ?? null, description: d.description, icon: d.icon }));
        const withStats = await this.dogs.dogStats.attach(visible);
        return withStats
            .filter((d) => d.stats.proven.badge)
            .sort((a, b) => b.stats.proven.score - a.stats.proven.score
                || b.stats.calls.ranked30d - a.stats.calls.ranked30d
                || String(a.displayName ?? a.lineageId).localeCompare(String(b.displayName ?? b.lineageId)))
            .slice(0, LandingRouteHandler.MAX_LIMIT)
            .map((d) => ({
                id: d.id,
                lineageId: d.lineageId,
                displayName: d.displayName,
                description: LandingRouteHandler.shorten(d.description),
                icon: typeof d.icon === 'string' ? d.icon : null,
                stats: d.stats,
            }));
    }

    /** Ein Landing-Eintrag: nur, was ein Anonymer ohnehin sieht, plus stats. */
    private static entryOf(k: any): LandingEntry {
        const lineageId = statsKeyOf(k);
        return {
            id: k.id,
            lineageId,
            name: k.name ?? null,
            emoji: k.emoji ?? null,
            description: LandingRouteHandler.shorten(k.description),
            url: LandingRouteHandler.urlOf(k, lineageId),
            stats: k.stats,
        };
    }

    /** `/k/<lineageId>` plus defaultQuery (wie die Liste) — die Landing kennt das Praefix nicht (W2). */
    private static urlOf(k: any, lineageId: string): string {
        const path = publicKennelPath(lineageId);
        const dq = canRead(k, ANON) ? k.defaultQuery : undefined;
        if (!dq || typeof dq !== 'object') return path;
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(dq)) {
            if (!key.trim()) continue;
            params.set(key, String(value));
        }
        const qs = params.toString();
        return qs ? `${path}?${qs}` : path;
    }

    private static shorten(text: unknown): string | null {
        if (typeof text !== 'string' || text.trim() === '') return null;
        const clean = text.trim();
        if (clean.length <= DESCRIPTION_MAX) return clean;
        return clean.slice(0, DESCRIPTION_MAX - 1).trimEnd() + '…';
    }

    private static parseLimit(raw: unknown): number {
        const value = Number(Array.isArray(raw) ? raw[0] : raw);
        if (!Number.isFinite(value) || value < 1) return LandingRouteHandler.DEFAULT_LIMIT;
        return Math.min(Math.floor(value), LandingRouteHandler.MAX_LIMIT);
    }
}
