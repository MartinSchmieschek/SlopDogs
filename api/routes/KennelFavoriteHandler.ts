// KennelFavoriteHandler — Favoriten je Nutzer (Spur U): PUT/DELETE /api/kennels/:id/favorite.
// `:id` ist lineageId oder Version-GUID; gespeichert wird immer auf die Lineage. Die Regeln traegt
// KennelFavoriteService; hier nur Aufloesung und Antwortform (Muster KennelRatingHandler).
import { Request, Response } from 'express';
import { KennelController } from '../KennelController';
import { FavoriteError, KennelFavoriteService, type KennelFavoriteView } from '../../services/KennelFavoriteService';
import type { RatableKennel } from '../../services/KennelStatsService';
import { paramString } from '../utils/routeParams';
import { sendLoginRequired } from './ConfigRouteHandler';
import { API_ROUTE } from './routeTable';

export class KennelFavoriteHandler {
    constructor(
        private readonly kennelsController: KennelController,
        private readonly favorites: KennelFavoriteService,
    ) {}

    registerRoutes(app: any): void {
        app.put(API_ROUTE.kennelFavorite, (req: Request, res: Response) =>
            this.respond(req, res, (kennel) => this.favorites.set(kennel, req.ctx)),
        );
        app.delete(API_ROUTE.kennelFavorite, (req: Request, res: Response) =>
            this.respond(req, res, (kennel) => this.favorites.clear(kennel, req.ctx)),
        );
    }

    /** Kennel aufloesbar (sonst 404), dann die Aktion; FavoriteError wird zur Fehlerform des Bestands. */
    private async respond(req: Request, res: Response, action: (kennel: RatableKennel) => Promise<KennelFavoriteView>): Promise<void> {
        try {
            const found = await this.kennelsController.getById(paramString(req.params.id));
            if (!found.ok || !found.data) throw new FavoriteError(404, 'not_found', 'Kennel not found');
            const view = await action(found.data as unknown as RatableKennel);
            res.status(200).json({ ok: true, ...view });
        } catch (err) {
            if (!(err instanceof FavoriteError)) {
                console.error('[KennelFavoriteHandler]', err);
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
