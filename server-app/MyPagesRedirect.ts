// MyPagesRedirect — das erste Glied vor `/` und `/kennels` (GET und HEAD, dieselbe Registrierung wie die Default-Seiten):
// wer eingeloggt ist und eine eigene Seite gesetzt hat, bekommt 302 auf `/k/<lineageId>` samt Query; alle anderen gehen
// weiter zur Default-Seite. Kein Kennel-Lauf: gelesen werden nur Einstellung, Kennel, Rechte und ob er Dogs hat
// (MyPagesService.target). Laufen laesst ihn erst `/k/`, mit derselben Sandbox und Zulassung wie jede Kennel-Seite.
// Dazu GET /api/kennel-list mit derselben Entscheidung, damit die Angular-App ihre Links auf `/kennels` richtig fuehrt.
//
// Kopfzeilen: `/` und `/kennels` senden immer `Vary: Cookie`. Jede Antwort an einen Eingeloggten — Umleitung oder
// Default-Seite — geht `Cache-Control: private, no-cache` hinaus; LandingPage, KennelListPage und die Dateien der
// Landing lesen dafuer die Marke (`cacheControlFor`). Anonym und im Dev-Super-User-Modus bleibt alles wie zuvor.
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { publicKennelPath } from '@martinschmieschek/slopdogs-core/runtime';
import type { AuthCtx } from '../mcp/auth/middleware';
import type { UserPageKind } from '../store/IUserPageStore';
import type { KennelListPage } from './KennelListPage';

/** Was das Glied vom Dienst braucht (MyPagesService.target): das Ziel ohne Lauf, oder null. */
export interface MyPagesTargets {
    target(ctx: AuthCtx | undefined, kind: UserPageKind): Promise<string | null>;
}

/** Erzwingt diese Anfrage per `?landing=<id>` einen Kennel der Rotation (LandingPage.forcedIn)? */
export interface ForcedLanding {
    forcedIn(req: Request): string | null;
}

/** Die Antwort von GET /api/kennel-list: liefert `/kennels` einen Kennel, welchen, und ist es die eigene Liste? */
export interface KennelListStatusView {
    active: boolean;
    kennelId: string;
    source: 'user' | 'default';
}

export class MyPagesRedirect {
    static readonly PRIVATE_CACHE_CONTROL = 'private, no-cache';
    private static readonly MARK = 'myPagesSignedIn';
    private targets: MyPagesTargets | null = null;

    /** Der Dienst kommt nach dem Montieren der Front-Routen (createHttpApplication); bis dahin reicht das Glied weiter. */
    use(targets: MyPagesTargets): void {
        this.targets = targets;
    }

    /** Cache-Control einer Default-Seite: an Eingeloggte `private, no-cache`, sonst `anonymous` wie bisher. */
    static cacheControlFor(res: Response, anonymous: string): string {
        return res.locals?.[MyPagesRedirect.MARK] === true ? MyPagesRedirect.PRIVATE_CACHE_CONTROL : anonymous;
    }

    /** Das Glied fuer `/` (`landing`, mit der Rotation) bzw. `/kennels` (`list`). */
    gate(kind: UserPageKind, landing: ForcedLanding | null = null): RequestHandler {
        const myPagesGate: RequestHandler = (req, res, next) => {
            this.pass(kind, landing, req, res, next).catch(next);
        };
        return myPagesGate;
    }

    /** GET /api/kennel-list: die eigene Liste des Aufrufers, sonst der heutige Status des Defaults. Nie gecacht. */
    listStatus(page: KennelListPage): RequestHandler {
        return (req, res, next) => {
            res.setHeader('Cache-Control', 'no-store');
            this.listStatusOf(req.ctx, page)
                .then((status) => res.json({ ok: true, ...status }))
                .catch(next);
        };
    }

    private async listStatusOf(ctx: AuthCtx | undefined, page: KennelListPage): Promise<KennelListStatusView> {
        const own = await this.targetOf(ctx, 'list');
        if (own) return { active: true, kennelId: own, source: 'user' };
        const status = await page.status().catch(() => ({ active: false, kennelId: page.kennelId }));
        return { ...status, source: 'default' };
    }

    private async pass(kind: UserPageKind, landing: ForcedLanding | null, req: Request, res: Response, next: NextFunction): Promise<void> {
        res.vary('Cookie');
        if (!req.ctx?.user?.id) {
            next();
            return;
        }
        res.locals[MyPagesRedirect.MARK] = true;
        res.setHeader('Cache-Control', MyPagesRedirect.PRIVATE_CACHE_CONTROL);
        // Die ausdrueckliche Anfrage gewinnt: `?landing=<id>` aus der Rotation zeigt diese Landing, nicht die eigene.
        if (kind === 'landing' && landing?.forcedIn(req)) {
            next();
            return;
        }
        const lineageId = await this.targetOf(req.ctx, kind);
        if (!lineageId) {
            next();
            return;
        }
        res.redirect(302, publicKennelPath(lineageId) + MyPagesRedirect.queryOf(req));
    }

    /** Ohne Dienst oder bei einem Fehler: kein Ziel, die Default-Seite. */
    private async targetOf(ctx: AuthCtx | undefined, kind: UserPageKind): Promise<string | null> {
        if (!this.targets) return null;
        try {
            return await this.targets.target(ctx, kind);
        } catch (err) {
            console.warn(`[MyPagesRedirect] ${kind}: Ziel nicht bestimmt, Default-Seite —`, (err as Error)?.name ?? err);
            return null;
        }
    }

    /** Die Query der Anfrage, unveraendert (mit `?`), sonst ''. */
    private static queryOf(req: Request): string {
        const url = String(req.originalUrl ?? '');
        const start = url.indexOf('?');
        return start >= 0 ? url.slice(start) : '';
    }
}
