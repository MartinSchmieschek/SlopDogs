// SameOriginGuard — Pfade, die mit der Browser-Session etwas ausgeben oder widerrufen (Personal Access Tokens,
// OAuth-Zustimmung), nehmen nur Anfragen der eigenen Seiten an (fix/k-sandbox, 2026-10-31).
//
// Regel, in dieser Reihenfolge:
//   1. `Origin: null` (opake Herkunft, z. B. eine Seite unter CSP-Sandbox) -> abgewiesen.
//   2. `Sec-Fetch-Site: same-origin | none` -> zugelassen (die eigene Seite bzw. eine direkte Navigation).
//   3. `Origin` gesetzt und von der CORS-Regel der App zugelassen (gleicher Host, CORS_ALLOWED_ORIGINS bzw.
//      lokal localhost — die Dev-UI auf :4300) -> zugelassen.
//   4. Weder `Origin` noch `Sec-Fetch-Site` -> zugelassen: kein Browser (curl, Skripte) — dort gibt es keine
//      fremde Seite, die die Session mitschicken koennte.
//   5. Alles andere -> 403.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Die CORS-Regel der App: der zugelassene Origin dieser Anfrage oder undefined. */
export type AllowedOriginResolver = (req: Request) => string | undefined;

export class SameOriginGuard {
    static readonly ERROR = 'cross_origin_refused';
    static readonly MESSAGE = 'This endpoint accepts requests from SlopDogs pages only.';

    constructor(private readonly allowedOrigin: AllowedOriginResolver) {}

    /** Darf diese Anfrage durch? */
    allows(req: Request): boolean {
        const origin = SameOriginGuard.header(req, 'origin');
        if (origin !== undefined && origin.trim().toLowerCase() === 'null') return false;
        const site = SameOriginGuard.header(req, 'sec-fetch-site')?.trim().toLowerCase();
        if (site === 'same-origin' || site === 'none') return true;
        if (origin) return this.allowedOrigin(req) === origin;
        return site === undefined;
    }

    /** Middleware fuer die schreibenden Methoden; GET/HEAD gehen durch (sie aendern nichts). */
    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction) => {
            if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || this.allows(req)) {
                next();
                return;
            }
            res.setHeader('Cache-Control', 'no-store');
            res.status(403).json({ error: SameOriginGuard.ERROR, error_description: SameOriginGuard.MESSAGE });
        };
    }

    private static header(req: Request, name: string): string | undefined {
        const raw = req.headers[name];
        return Array.isArray(raw) ? raw[0] : raw;
    }
}
