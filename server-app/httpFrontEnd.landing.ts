import fs from 'fs';
import path from 'path';
import type { Application } from 'express';
import { ROOT_ROUTE } from '../api/routes/routeTable';
import type { HttpFrontEndContext } from './httpFrontEndTypes';

/**
 * Das Schaufenster, vor express.static und vor jeder Route: `/` liefert die Landing (P5) — die Lead-Ausgabe
 * des Kennels `slopdogs-landing` aus dem HTML-Memo, sonst den statischen Fallback `public/landing/index.html`
 * (LandingPage). HEAD `/` laeuft nie einen Kennel. `/robots.txt` ist eine Datei aus `public/landing/`.
 * Fehlt beides, reicht der Haken per next() weiter (gebaute SPA bzw. Dev-Redirect).
 */
export function bindLandingFiles(app: Application, ctx: HttpFrontEndContext): void {
    const landing = ctx.landingPage;
    const serve = (fileName: string, cacheControl: string) => (_req: any, res: any, next: any) => {
        const file = ctx.publicDir ? path.join(ctx.publicDir, 'landing', fileName) : null;
        if (!file || !fs.existsSync(file)) {
            next();
            return;
        }
        res.setHeader('Cache-Control', cacheControl);
        res.sendFile(file);
    };
    // HEAD vor GET: ohne eigene Route beantwortet Express HEAD ueber den GET-Handler — und liesse den Kennel laufen.
    app.head(ROOT_ROUTE.landing, (req, res, next) => (landing ? landing.handleHead(req, res, next) : next()));
    app.get(ROOT_ROUTE.landing, (req, res, next) => {
        if (!landing) {
            serve('index.html', 'public, max-age=300')(req, res, next);
            return;
        }
        void landing.handleGet(req, res, next);
    });
    app.get(ROOT_ROUTE.robots, serve('robots.txt', 'public, max-age=300'));
}
