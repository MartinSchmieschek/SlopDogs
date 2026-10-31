import type { Application } from 'express';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';
import { bindKennelListPage, bindLandingFiles } from './httpFrontEnd.landing';

/**
 * Development: keine gebaute SPA von Express. `/` liefert die Landing wie deployed (Kennel oder Fallback, P5);
 * die SPA bleibt unter ng serve (:4300) erreichbar. Nur wenn beides fehlt, leitet Root dorthin um.
 */
export const bindHttpFrontEnd: HttpFrontEndBinder = {
    beforeControllers(app: Application, ctx: HttpFrontEndContext): void {
        bindLandingFiles(app, ctx);
        // Spur K: /kennels als Kennel. Ohne Seite: die Angular-Liste unter ng serve — `spa=1` laesst der Dev-Proxy
        // (ui-app/proxy.conf.js) bei ng serve, statt ihn wieder hierher zu reichen; so kein Kreis.
        bindKennelListPage(app, ctx, (req, res) => {
            const query = new URLSearchParams(req.query as Record<string, string>);
            query.set('spa', '1');
            res.redirect(302, `${ctx.devUiOrigin}/kennels?${query}`);
        });
        app.get('/', (_req, res) => {
            res.redirect(302, `${ctx.devUiOrigin}/`);
        });
    },
    afterKennelRoutes(_app: Application, _ctx: HttpFrontEndContext): void {
        /* kein SPA-Fallback */
    },
};
