import fs from 'fs';
import path from 'path';
import type { Application, NextFunction, Request, RequestHandler, Response } from 'express';
import { ROOT_ROUTE } from '../api/routes/routeTable';
import type { HttpFrontEndContext } from './httpFrontEndTypes';
import { MyPagesRedirect } from './MyPagesRedirect';

/** Ohne Glied der eigenen Seiten im Kontext: weiter zur Default-Seite. */
const toDefault: RequestHandler = (_req, _res, next) => next();

/**
 * Das Schaufenster, vor express.static und vor jeder Route: `/` liefert die Landing (P5) — die Lead-Ausgabe
 * des Kennels `slopdogs-landing` aus dem HTML-Memo, sonst den statischen Fallback `public/landing/index.html`
 * (LandingPage). HEAD `/` laeuft nie einen Kennel. `/robots.txt` ist eine Datei aus `public/landing/`.
 * Fehlt beides, reicht der Haken per next() weiter (gebaute SPA bzw. Dev-Redirect).
 * Davor, auf derselben Registrierung: das Glied der eigenen Seiten (MyPagesRedirect) — eingeloggt mit eigener Landing
 * 302 auf `/k/<id>`, sonst weiter; auch das ohne Lauf.
 */
export function bindLandingFiles(app: Application, ctx: HttpFrontEndContext): void {
    const landing = ctx.landingPage;
    const gate = ctx.myPages?.gate('landing', landing) ?? toDefault;
    const serve = (fileName: string, cacheControl: string) => (_req: any, res: any, next: any) => {
        const file = ctx.publicDir ? path.join(ctx.publicDir, 'landing', fileName) : null;
        if (!file || !fs.existsSync(file)) {
            next();
            return;
        }
        res.setHeader('Cache-Control', MyPagesRedirect.cacheControlFor(res, cacheControl));
        res.sendFile(file);
    };
    // HEAD vor GET: ohne eigene Route beantwortet Express HEAD ueber den GET-Handler — und liesse den Kennel laufen.
    app.head(ROOT_ROUTE.landing, gate, (req, res, next) => (landing ? landing.handleHead(req, res, next) : next()));
    app.get(ROOT_ROUTE.landing, gate, (req, res, next) => {
        if (!landing) {
            serve('index.html', 'public, max-age=300')(req, res, next);
            return;
        }
        void landing.handleGet(req, res, next);
    });
    app.get(ROOT_ROUTE.robots, serve('robots.txt', 'public, max-age=300'));
}

/**
 * Spur K: `/kennels` (und `/kennels/`, nicht `/kennels/<ref>`) liefert den Kennel `slopdogs-kennels`. Liefert er
 * nichts, entscheidet `fallback`: prod/lokal reichen per next() an den SPA-Fallback (die Angular-Liste), dev leitet
 * auf die Angular-Liste unter ng serve um. HEAD laeuft nie einen Kennel.
 * Davor, auf derselben Registrierung: das Glied der eigenen Seiten — eingeloggt mit eigener Liste 302 auf `/k/<id>`.
 * Es steht auch ohne Kennel-Liste im Kontext; dann geht jede andere Anfrage weiter wie bisher.
 */
export function bindKennelListPage(
    app: Application,
    ctx: HttpFrontEndContext,
    fallback: (req: Request, res: Response, next: NextFunction) => void = (_req, _res, next) => next(),
): void {
    const page = ctx.kennelListPage;
    const gate = ctx.myPages?.gate('list') ?? toDefault;
    if (!page) {
        app.head(ROOT_ROUTE.kennelList, gate);
        app.get(ROOT_ROUTE.kennelList, gate);
        return;
    }
    app.head(ROOT_ROUTE.kennelList, gate, (req, res, next) => page.handleHead(req, res, () => fallback(req, res, next)));
    app.get(ROOT_ROUTE.kennelList, gate, (req, res, next) => void page.handleGet(req, res, () => fallback(req, res, next)));
}
