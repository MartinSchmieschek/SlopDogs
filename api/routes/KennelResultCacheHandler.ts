// KennelResultCacheHandler — GET /api/kennels/:id/result-cache (Ergebnis-Cache P4, D10): die Auskunft fuer die
// Kennel-Einstellungen der UI. Dieselbe Sicht wie `cacheClass` in get_kennel: TTL, Klasse, Gruende (fuer den Aufrufer
// geschwaerzt), erlaubte Werte, `ruht`; der Besitzer zusaetzlich Herabstufung und Hinweis aus der Statistik.
// Gesetzt wird die TTL weiter ueber PUT /api/kennels/:id (nur der Besitzer, P2). Gate READ, wie get_kennel.
import type { Request, Response } from 'express';
import type { IKennelConfig } from '@martinschmieschek/slopdogs-core/runtime';
import type { KennelController } from '../KennelController';
import type { KennelStatsService } from '../../services/KennelStatsService';
import { canManageAcl, canRead, type AclEntity } from '../../mcp/auth/visibility';
import { paramString } from '../utils/routeParams';
import type { KennelRunHandler } from './KennelRunHandler';
import { API_ROUTE } from './routeTable';

export class KennelResultCacheHandler {
    constructor(
        private readonly kennelsController: KennelController,
        private readonly runHandler: KennelRunHandler,
        private readonly stats: KennelStatsService,
    ) {}

    registerRoutes(app: { get: (path: string, handler: (req: Request, res: Response) => void) => void }): void {
        app.get(API_ROUTE.kennelResultCache, (req: Request, res: Response) => void this.handleGet(req, res));
    }

    private async handleGet(req: Request, res: Response): Promise<void> {
        try {
            const found = await this.kennelsController.getById(paramString(req.params.id));
            const kennel = found.ok ? (found.data as IKennelConfig | undefined) : undefined;
            if (!kennel || !canRead(kennel as AclEntity, req.ctx)) {
                res.status(404).json({ error: 'not_found', error_description: 'Kennel not found' });
                return;
            }
            const owner = canManageAcl(kennel as AclEntity, req.ctx);
            const calls = owner
                ? (await this.stats.attachOne({ id: String(kennel.id), lineageId: KennelResultCacheHandler.lineageOf(kennel) })).stats.calls
                : null;
            const report = await this.runHandler.resultCacheReport(kennel, req.ctx, calls);
            res.status(200).json({ ok: true, ...report, canChange: owner });
        } catch (err) {
            console.error('[KennelResultCacheHandler]', err);
            res.status(500).json({ error: 'internal_error' });
        }
    }

    private static lineageOf(kennel: IKennelConfig): string {
        return (kennel as IKennelConfig & { lineageId?: string }).lineageId || String(kennel.id);
    }
}
