// SecurityHeaders — Kopfzeilen, die jede Antwort traegt, und die Abschottung der Kennel-Seiten (fix/k-sandbox, 2026-10-31).
//
// `/k/…` liefert HTML und Skript, das ein Kennel-Besitzer geschrieben hat, auf demselben Origin wie `/api`, `/auth`,
// `/mcp` und die UI. Deshalb bekommt jede Antwort unter `/k/` die CSP-Direktive `sandbox` OHNE `allow-same-origin`:
// die Seite laeuft mit opakem Origin (`self.origin === "null"`), liest keine Cookies, keinen Speicher des Origins und
// keine Antworten der eigenen API. Ausnahme nur fuer vertraute Kennels (TrustedKennels), die der Handler nach dem
// Aufloesen des Kennels markiert (`trustKennelPage`) — nie anhand der URL allein.
//
// Alle anderen Pfade (UI, `/auth/*`, OAuth-Zustimmung, `/api`, `/`) duerfen nur von eigenen Seiten eingebettet werden
// (`frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN`). `/k/` bleibt in fremde Seiten einbettbar.
//
// Gesetzt wird beim Schreiben der Kopfzeilen (writeHead): setzt eine Route selbst eine CSP, wird zusammengefuehrt
// statt ueberschrieben oder doppelt gesendet.
import type { NextFunction, Request, RequestHandler, Response } from 'express';

const CSP = 'Content-Security-Policy';

export class SecurityHeaders {
    /**
     * Was eine Kennel-Seite unter der Sandbox darf. Bewusst NICHT `allow-same-origin` (sonst waere die Sandbox
     * wirkungslos) und nicht `allow-top-navigation` (eine eingebettete Seite fuehrt das Fenster nicht fort).
     *   allow-scripts                    Spiele, Lobby, Karten, Grafiken laufen in Skript.
     *   allow-forms                      Formulare (Eingaben, POST an den eigenen Kennel).
     *   allow-popups                     Links mit target=_blank, window.open (Teilen, Quellen).
     *   allow-popups-to-escape-sandbox   die geoeffnete fremde Seite laeuft normal, nicht mit geerbter Sandbox.
     *   allow-modals                     alert/confirm/prompt und window.print() ("Als PDF speichern").
     *   allow-downloads                  Download-Links (Export, Bilder, Daten).
     */
    static readonly KENNEL_SANDBOX: readonly string[] = [
        'allow-scripts',
        'allow-forms',
        'allow-popups',
        'allow-popups-to-escape-sandbox',
        'allow-modals',
        'allow-downloads',
    ];
    static readonly FRAME_ANCESTORS = "frame-ancestors 'self'";
    static readonly REFERRER_POLICY = 'strict-origin-when-cross-origin';

    /** `/k` und alles darunter — die Ware. */
    static isKennelPath(path: string): boolean {
        return path === '/k' || path.startsWith('/k/');
    }

    /** Die Sandbox-Direktive fuer Kennel-Seiten. */
    static kennelSandbox(): string {
        return `sandbox ${SecurityHeaders.KENNEL_SANDBOX.join(' ')}`;
    }

    /**
     * Vom Lauf-Handler: diese Antwort traegt Kennel-Ausgabe — auch ausserhalb von `/k/` (z. B.
     * `/api/kennels/:id/execute`, das HTML ebenso ausliefert). Sie bekommt die Sandbox wie `/k/`.
     */
    static markKennelOutput(res: Response): void {
        (res.locals ??= {}).kennelOutput = true; // Test-Doubles tragen kein locals
    }

    /** Vom Handler, nachdem er den Kennel aufgeloest hat: diese Antwort ist eine vertraute Seite, ohne Sandbox. */
    static trustKennelPage(res: Response): void {
        (res.locals ??= {}).kennelPageTrusted = true;
    }

    /**
     * Fuehrt eine Direktive in eine bestehende CSP ein. `replace`: eine gleichnamige Direktive wird ersetzt
     * (die Sandbox der App gewinnt), sonst bleibt die der Route stehen.
     */
    static mergeCsp(existing: string | undefined, directive: string, replace: boolean): string {
        const name = directive.split(/\s+/)[0].toLowerCase();
        const parts = (existing ?? '').split(';').map((p) => p.trim()).filter(Boolean);
        const index = parts.findIndex((p) => p.split(/\s+/)[0].toLowerCase() === name);
        if (index < 0) parts.push(directive);
        else if (replace) parts[index] = directive;
        return parts.join('; ');
    }

    middleware(): RequestHandler {
        return (req: Request, res: Response, next: NextFunction) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Referrer-Policy', SecurityHeaders.REFERRER_POLICY);
            const kennelPath = SecurityHeaders.isKennelPath(req.path);
            const originalWriteHead = res.writeHead;
            res.writeHead = function writeHeadWithPolicy(this: Response, ...args: any[]) {
                SecurityHeaders.applyFramePolicy(res, kennelPath);
                return (originalWriteHead as any).apply(this, args);
            } as any;
            next();
        };
    }

    private static applyFramePolicy(res: Response, kennelPath: boolean): void {
        if (res.headersSent) return;
        const raw = res.getHeader(CSP);
        const existing = Array.isArray(raw) ? raw.join('; ') : raw === undefined ? undefined : String(raw);
        if (kennelPath) {
            // Vertraut nur unter /k/ selbst; die Markierung setzt der Handler nach dem Aufloesen des Kennels.
            if (res.locals.kennelPageTrusted === true) return;
            res.setHeader(CSP, SecurityHeaders.mergeCsp(existing, SecurityHeaders.kennelSandbox(), true));
            return;
        }
        let policy = SecurityHeaders.mergeCsp(existing, SecurityHeaders.FRAME_ANCESTORS, false);
        if (res.locals.kennelOutput === true) policy = SecurityHeaders.mergeCsp(policy, SecurityHeaders.kennelSandbox(), true);
        res.setHeader(CSP, policy);
        if (res.getHeader('X-Frame-Options') === undefined) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
}
