// HealthRouteHandler — GET /api/health: lebt der Dienst, und welcher Stand laeuft. Oeffentlich, ohne Login, billig
// (keine Datenbank, kein Kennel-Lauf), nie gecacht. Die Landing und die Kennel-Liste zeigen daraus die Versionszeile
// im Fuss. Nur Namen und Versionen (ServerVersion); Speicher, Last und Nutzer bleiben im MCP-Tool health_check.
import type { Application, Request, Response } from 'express';
import { ServerVersion, type ServerMode } from '../../services/ServerVersion';
import { API_ROUTE } from './routeTable';

export class HealthRouteHandler {
    constructor(
        private readonly version: ServerVersion,
        private readonly mode: ServerMode,
        private readonly uptimeSec: () => number = () => Math.round(process.uptime()),
    ) {}

    /** VOR ConfigRouteHandler registrieren — sonst antwortet `/api/:subpath` fuer `health`. */
    registerRoutes(app: Pick<Application, 'get'>): void {
        app.get(API_ROUTE.health, (req: Request, res: Response) => this.handleHealth(req, res));
    }

    handleHealth(_req: Request, res: Response): void {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({
            ok: true,
            ...this.version.block(),
            stage: this.version.stage(),
            mode: this.mode,
            uptimeSec: this.uptimeSec(),
        });
    }
}
