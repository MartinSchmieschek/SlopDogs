// KeysRouteHandler — der Key-Store ueber REST (P4c 4c.3): GET/POST /api/keys, DELETE /api/keys/:alias.
// Login plus echte user.id; der Super-User ohne user bekommt 403 no_identity. Kein Klartext in
// irgendeiner Antwort, kein GET-by-alias mit Wert. Die Regeln traegt KeyStoreService; hier nur
// Identitaet, Antwortform und Fehlerform. UI: /account?tab=keys (P6 U7).
import { Request, Response } from 'express';
import { KeyStoreError, KeyStoreService } from '../../services/KeyStoreService';
import { paramString } from '../utils/routeParams';
import { requireLogin } from './ConfigRouteHandler';
import { API_ROUTE } from './routeTable';

export class KeysRouteHandler {
    constructor(private readonly keyStore: KeyStoreService) {}

    /** VOR ConfigRouteHandler registrieren — sonst antwortet `/api/:subpath` fuer `keys`. */
    registerRoutes(app: any): void {
        app.get(API_ROUTE.keys, (req: Request, res: Response) => this.handleList(req, res));
        app.post(API_ROUTE.keys, (req: Request, res: Response) => this.handleSet(req, res));
        app.delete(API_ROUTE.keyByAlias, (req: Request, res: Response) => this.handleDelete(req, res));
    }

    /** Nur die eigenen Keys, maskiert. */
    private async handleList(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, async (owner) => ({ keys: await this.keyStore.list(owner) }));
    }

    /** Upsert je (owner, alias); Antwort: die maskierte Sicht. */
    private async handleSet(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, async (owner) => ({ key: await this.keyStore.set(owner, req.body ?? {}) }));
    }

    /** Idempotent fuer die eigenen; fremd und unbekannt sehen gleich aus (404, nichts verraten). */
    private async handleDelete(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, async (owner) => {
            const deleted = await this.keyStore.delete(owner, paramString(req.params.alias));
            if (!deleted) throw new KeyStoreError(404, 'not_found', 'Key not found');
            return {};
        });
    }

    private async respond(req: Request, res: Response, action: (owner: string) => Promise<object>): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');
        if (!requireLogin(req, res)) return;
        try {
            const owner = this.keyStore.requireOwner(req.ctx);
            const view = await action(owner);
            res.status(200).json({ ok: true, ...view });
        } catch (err) {
            if (err instanceof KeyStoreError) {
                res.status(err.status).json({ error: err.code, error_description: err.message });
                return;
            }
            // Nur die Klasse des Fehlers ins Log — ein Prisma-Fehler koennte Eingabewerte zitieren.
            console.error('[KeysRouteHandler]', (err as Error)?.name ?? 'Error');
            res.status(500).json({ error: 'internal_error' });
        }
    }
}
