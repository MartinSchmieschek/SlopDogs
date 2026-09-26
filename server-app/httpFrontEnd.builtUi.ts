import path from 'path';
import express, { type Application } from 'express';
import { SPA_FALLBACK_SKIP_PREFIXES } from '../api/routes/spaRouteConstants';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';
import { bindLandingFiles } from './httpFrontEnd.landing';

/** Production / Integration: gebautes Angular ausliefern und SPA-Fallback ans Ende. */
export const bindHttpFrontEnd: HttpFrontEndBinder = {
    beforeControllers(app: Application, ctx: HttpFrontEndContext): void {
        // Landing vor express.static — sonst liefert static fuer `/` die Angular-index.html.
        bindLandingFiles(app, ctx);
        if (ctx.angularBrowserDir) {
            app.use(express.static(ctx.angularBrowserDir, { index: 'index.html' }));
        }
    },
    afterKennelRoutes(app: Application, ctx: HttpFrontEndContext): void {
        if (!ctx.angularBrowserDir) return;
        app.use((req: any, res: any, next: any) => {
            if (req.method !== 'GET') return next();
            const p = req.path as string;
            if (SPA_FALLBACK_SKIP_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
                return next();
            }
            res.sendFile(path.join(ctx.angularBrowserDir!, 'index.html'));
        });
    },
};
