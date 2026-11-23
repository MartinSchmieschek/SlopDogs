// MyPagesRouteHandler — die eigenen Seiten ueber REST: GET/PUT /api/my-pages mit `{ landing, list }` (lineageIds,
// null = Default-Seite). Die Regeln traegt MyPagesService; hier nur Identitaet, Herkunft, Antwort- und Fehlerform
// (Muster KeysRouteHandler). UI: /account, Profil-Tab.
//
// PUT mit der Browser-Session (Cookie) nimmt nur Anfragen eigener Seiten an — dieselbe Regel wie /auth/tokens
// (SameOriginGuard). Bearer-Clients (PAT, OAuth) und der lokale Modus schicken kein Cookie mit und gehen wie bei
// /api/keys ohne diese Pruefung durch; im lokalen Modus prueft die Netzgrenze die Origin jedes Schreibzugriffs.
import type { Application, Request, Response } from 'express';
import { MyPagesError, type MyPagesService, type MyPagesView } from '../../services/MyPagesService';
import { SameOriginGuard } from '../../mcp/auth/sameOriginGuard';
import { requireLogin } from './ConfigRouteHandler';
import { API_ROUTE } from './routeTable';

export class MyPagesRouteHandler {
    constructor(
        private readonly myPages: MyPagesService,
        private readonly sameOrigin: SameOriginGuard,
    ) {}

    /** VOR ConfigRouteHandler registrieren — sonst antwortet `/api/:subpath` fuer `my-pages`. */
    registerRoutes(app: Application): void {
        app.get(API_ROUTE.myPages, (req: Request, res: Response) => this.handleGet(req, res));
        app.put(API_ROUTE.myPages, (req: Request, res: Response) => this.handlePut(req, res));
    }

    private async handleGet(req: Request, res: Response): Promise<void> {
        await this.respond(req, res, () => this.myPages.get(req.ctx));
    }

    private async handlePut(req: Request, res: Response): Promise<void> {
        if (req.ctx?.via === 'session' && !this.sameOrigin.allows(req)) {
            res.setHeader('Cache-Control', 'no-store');
            res.status(403).json({ error: SameOriginGuard.ERROR, error_description: SameOriginGuard.MESSAGE });
            return;
        }
        await this.respond(req, res, () => this.myPages.set(req.ctx, req.body ?? {}));
    }

    private async respond(req: Request, res: Response, action: () => Promise<MyPagesView>): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');
        if (!requireLogin(req, res)) return;
        try {
            res.status(200).json({ ok: true, ...(await action()) });
        } catch (err) {
            if (err instanceof MyPagesError) {
                res.status(err.status).json({ error: err.code, error_description: err.message });
                return;
            }
            // Nur die Klasse des Fehlers ins Log — ein DB-Fehler koennte Eingabewerte zitieren.
            console.error('[MyPagesRouteHandler]', (err as Error)?.name ?? 'Error');
            res.status(500).json({ error: 'internal_error' });
        }
    }
}
