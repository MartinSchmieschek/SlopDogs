// The AclRouteHandler — die REST-Tuer zur Rechteverwaltung (P3.5 3.5.6).
// Spiegelt mcp/tools/acl.ts: dieselbe AclManager-Instanz, dieselben Gates, andere Sprache.
import type { Request, Response } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import type { KennelController } from '../KennelController';
import type { Controller } from '../Controller';
import { AclError, AclManager, type EntityType } from '../../mcp/tools/acl';
import { paramString } from '../utils/routeParams';
import { ACL_ROUTE } from './routeTable';

/** Subpath der URL -> Entitaetsart der ACL-Werkzeuge. */
const ENTITY_OF_SUBPATH: Record<string, EntityType> = { kennels: 'kennel', nodes: 'node' };

/** HTTP-Status je AclError-Code. Nicht gefunden und nicht erlaubt zu sehen sind dasselbe: 404. */
const STATUS_OF: Record<AclError['code'], number> = {
    not_found: 404,
    forbidden: 403,
    frozen: 409,
    locked_landing: 403,
    invalid_user: 400,
    invalid_visibility: 400,
    failed: 500,
};

export class AclRouteHandler {
    private readonly manager: AclManager;

    constructor(kennelsController: KennelController, nodesController: Controller<any>, prisma: PrismaClient) {
        this.manager = new AclManager({ kennelsController, nodesController, prisma });
    }

    registerRoutes(app: any): void {
        // GET antwortet auch Anonymen — mit 404, wie jedem, der nicht Owner oder Editor ist.
        app.get(ACL_ROUTE.acl, (req: Request, res: Response) =>
            this.handle(req, res, (t, id) => this.manager.view(t, id, req.ctx), false),
        );
        app.put(ACL_ROUTE.acl, (req: Request, res: Response) =>
            this.handle(req, res, (t, id) => this.manager.replace(t, id, req.body ?? {}, req.ctx)),
        );
        app.post(ACL_ROUTE.transfer, (req: Request, res: Response) =>
            // Nach dem Transfer ist der Aufrufer nicht mehr Owner — die Antwort traegt den neuen.
            this.handle(req, res, async (t, id) => ({ ok: true, ...(await this.manager.transfer(t, id, String(req.body?.toUserId ?? ''), req.ctx)) })),
        );
        app.post(ACL_ROUTE.freeze, (req: Request, res: Response) =>
            this.handle(req, res, async (t, id) => ({ ok: true, ...(await this.manager.setFrozen(t, id, true, req.ctx)) })),
        );
        app.post(ACL_ROUTE.unfreeze, (req: Request, res: Response) =>
            this.handle(req, res, async (t, id) => ({ ok: true, ...(await this.manager.setFrozen(t, id, false, req.ctx)) })),
        );
    }

    /**
     * Gemeinsamer Rahmen: Subpath pruefen, fuer Aenderungen Login verlangen (anonyme Aufrufer
     * verwalten nichts), AclError in Status und `{ error }` uebersetzen.
     */
    private async handle(
        req: Request,
        res: Response,
        run: (entityType: EntityType, id: string) => Promise<unknown>,
        requireLogin = true,
    ): Promise<void> {
        const entityType = ENTITY_OF_SUBPATH[paramString(req.params.subpath)];
        const id = paramString(req.params.id);
        if (!entityType) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (requireLogin && !req.ctx?.user && !req.ctx?.isSuperUser) {
            res.status(401).json({ error: 'unauthorized', error_description: 'Login required to manage access.' });
            return;
        }
        try {
            res.status(200).json(await run(entityType, id));
        } catch (err: any) {
            if (err instanceof AclError) {
                res.status(STATUS_OF[err.code]).json({ error: err.code, error_description: err.message });
                return;
            }
            console.error('[AclRouteHandler]', err);
            res.status(500).json({ error: 'failed' });
        }
    }
}
