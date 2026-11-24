import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SecurityHeaders } from './SecurityHeaders';

/** Liefert die freigegebene Origin einer Anfrage oder `undefined` (keine Freigabe). */
export type AllowedOriginResolver = (req: Request) => string | undefined;

/**
 * CORS-Kopfzeilen fuer jede Antwort; beantwortet OPTIONS selbst mit 204.
 * Welche Origin freigegeben ist, entscheidet der Aufrufer (lokal, Liste, fester Wert, eigener Host).
 */
export class CorsHeaders {
    /**
     * Antwort-Kopfzeilen, die fremder Browser-Code lesen darf (CORS gibt sonst nur die Safelist frei):
     * Retry-After bei 429/503 (#24, Punkt 18), X-SlopDogs-Cache und Age beim Ergebnis-Cache.
     */
    static readonly EXPOSED = 'Retry-After, X-SlopDogs-Cache, Age';

    constructor(private readonly allowedOrigin: AllowedOriginResolver) {}

    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction) => {
            const allow = this.allowedOrigin(req);
            if (allow) {
                res.setHeader('Access-Control-Allow-Origin', allow);
                res.setHeader('Vary', 'Origin');
            } else if (SecurityHeaders.isKennelPath(req.path)) {
                // Kennel-Seiten laufen unter Sandbox mit opakem Origin (`Origin: null`) — ihre Aufrufe an `/k/…` (eigener
                // Kennel, Lesespur, Spec der Doku) sind damit cross-origin. `/k/` ist ohnehin oeffentlich und ohne Cookie
                // gleich dem anonymen Lauf: `*` ohne Allow-Credentials, der Browser gibt keine Antwort mit Cookie frei.
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Vary', 'Origin');
            }
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Expose-Headers', CorsHeaders.EXPOSED);
            if (req.method === 'OPTIONS') {
                res.sendStatus(204);
                return;
            }
            next();
        };
    }
}
