// KennelRatingHandler — Sterne fuer Kennels (P4 4.6): GET/PUT/DELETE /api/kennels/:id/rating.
// `:id` ist lineageId oder Version-GUID; gespeichert wird immer auf die Lineage. Die Regeln
// (4.4.1) traegt KennelStatsService; hier nur Aufloesung und Antwortform.
import { Request, Response } from 'express';
import { KennelController } from '../KennelController';
import { KennelStatsService, RatingError, statsKeyOf, type RatableKennel } from '../../services/KennelStatsService';
import { canRun } from '../../mcp/auth/visibility';
import { paramString } from '../utils/routeParams';
import { sendLoginRequired } from './ConfigRouteHandler';
import { API_ROUTE } from './routeTable';

export class KennelRatingHandler {
    constructor(
        private readonly kennelsController: KennelController,
        private readonly stats: KennelStatsService,
    ) { }

    registerRoutes(app: any): void {
        app.get(API_ROUTE.kennelRating, (req: Request, res: Response) => this.handleGet(req, res));
        app.put(API_ROUTE.kennelRating, (req: Request, res: Response) => this.handlePut(req, res));
        app.delete(API_ROUTE.kennelRating, (req: Request, res: Response) => this.handleDelete(req, res));
    }

    /** Aggregat, Verteilung und die eigene Bewertung (mine null anonym/unbewertet). Gate RUN. */
    private async handleGet(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, async (kennel) => {
            if (!canRun(kennel, req.ctx)) throw new RatingError(404, 'not_found', 'Kennel not found');
            return this.stats.ratingView(statsKeyOf(kennel), req.ctx?.user?.id ?? null);
        });
    }

    private async handlePut(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, (kennel) => this.stats.setRating(kennel, req.ctx, req.body?.stars));
    }

    private async handleDelete(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, (kennel) => this.stats.clearRating(kennel, req.ctx));
    }

    /** Regel 1 (Kennel aufloesbar), dann die Aktion; RatingError wird zur Fehlerform des Bestands. */
    private async respond(
        req: Request,
        res: Response,
        action: (kennel: RatableKennel) => Promise<object>,
    ): Promise<void> {
        try {
            const found = await this.kennelsController.getById(paramString(req.params.id));
            if (!found.ok || !found.data) throw new RatingError(404, 'not_found', 'Kennel not found');
            const kennel = found.data as unknown as RatableKennel;
            const view = await action(kennel);
            res.status(200).json({ ok: true, ...view });
        } catch (err) {
            if (!(err instanceof RatingError)) {
                console.error('[KennelRatingHandler]', err);
                res.status(500).json({ error: 'internal_error' });
                return;
            }
            if (err.status === 401) {
                sendLoginRequired(req, res, err.message);
                return;
            }
            res.status(err.status).json({ error: err.code, error_description: err.message });
        }
    }
}
