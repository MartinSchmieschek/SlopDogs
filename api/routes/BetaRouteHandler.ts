// BetaRouteHandler — Beta-Stage und Beta-Keys ueber REST (2026-09-26): GET /api/beta (oeffentlich: Stage, werden Keys
// verlangt, darf ich Keys verwalten?), GET/POST /api/beta/keys, DELETE /api/beta/keys/:id (nur Admins:
// BETA_ADMIN_EMAILS, lokal der Super-User). Der Klartext eines Keys steht nur in der Antwort auf POST, einmal.
// UI: /account?tab=beta, das Key-Feld auf /login.
import { Request, Response } from 'express';
import { BetaKeys } from '../../mcp/auth/betaKeys';
import { paramString } from '../utils/routeParams';
import { requireLogin } from './ConfigRouteHandler';
import { API_ROUTE } from './routeTable';

export class BetaRouteHandler {
    constructor(private readonly betaKeys: BetaKeys) {}

    /** VOR ConfigRouteHandler registrieren — sonst antwortet `/api/:subpath` fuer `beta`. */
    registerRoutes(app: any): void {
        app.get(API_ROUTE.beta, (req: Request, res: Response) => this.handleStatus(req, res));
        app.get(API_ROUTE.betaKeys, (req: Request, res: Response) => this.admin(req, res, async () => ({ keys: await this.betaKeys.list() })));
        app.post(API_ROUTE.betaKeys, (req: Request, res: Response) => this.admin(req, res, async () => {
            const createdBy = req.ctx?.user?.email ?? null;
            return this.betaKeys.create(req.body ?? {}, createdBy);
        }, 201));
        app.delete(API_ROUTE.betaKeyById, (req: Request, res: Response) => this.admin(req, res, async () => {
            const key = await this.betaKeys.revoke(paramString(req.params.id));
            return key ? { key } : null;
        }));
    }

    /** Fuer alle: die Login-Seite fragt nach dem Key, die Account-Seite zeigt den Beta-Reiter. */
    private handleStatus(req: Request, res: Response): void {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ stage: BetaKeys.stage() || null, keysRequired: BetaKeys.required(), admin: BetaKeys.isAdmin(req.ctx) });
    }

    private async admin(req: Request, res: Response, action: () => Promise<object | null>, okStatus = 200): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');
        if (!requireLogin(req, res)) return;
        if (!BetaKeys.isAdmin(req.ctx)) {
            res.status(403).json({ error: 'forbidden', error_description: 'Only beta admins manage beta keys.' });
            return;
        }
        try {
            const body = await action();
            if (!body) {
                res.status(404).json({ error: 'not_found' });
                return;
            }
            res.status(okStatus).json({ ok: true, ...body });
        } catch (err) {
            // Nur die Klasse — ein Prisma-Fehler (etwa: Tabelle fehlt, prisma:sync vergessen) nennt Pfade.
            console.error('[BetaRouteHandler]', (err as Error)?.name ?? 'Error', (err as Error)?.message?.split('\n')[0]);
            res.status(500).json({ error: 'internal_error', error_description: 'Beta keys unavailable — is the auth schema synced (npm run prisma:sync)?' });
        }
    }
}
