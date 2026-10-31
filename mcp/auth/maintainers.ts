// Maintainers — wer die gepflegten Kennels (Landing, Seed-Listen) und ihre besitzerlosen Dogs aendern darf
// (fix/k-sandbox, 2026-10-31). Quelle ist allein die Env SLOPDOGS_MAINTAINER_EMAILS (kommagetrennte Google-Adressen,
// Gross-/Kleinschreibung egal — dieselbe Normalisierung wie BETA_ADMIN_EMAILS). Leer: niemand, die Kennels sind
// fuer alle gesperrt. Owner und Super-User zaehlen nur mit Eintrag.
//
// Lokaler Modus (SLOPDOGS_MODE=local): der eine lokale Nutzer pflegt seine Instanz selbst und ist Maintainer —
// es gibt dort keinen anderen Nutzer und keine Google-Adresse, die in der Env stehen koennte.
import type { AuthCtx } from './middleware';
import { LOCAL_USER, LocalMode } from '../../server-app/LocalMode';

export class Maintainers {
    static readonly ENV = 'SLOPDOGS_MAINTAINER_EMAILS';

    /** Die Adressen aus der Env, normalisiert (trim, klein). */
    static emails(env: NodeJS.ProcessEnv = process.env): string[] {
        return (env[Maintainers.ENV] ?? '')
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean);
    }

    static isMaintainerEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        const wanted = email?.trim().toLowerCase();
        return !!wanted && Maintainers.emails(env).includes(wanted);
    }

    /** Darf dieser Aufrufer gepflegte Kennels und ihre besitzerlosen Dogs aendern? */
    static isMaintainer(ctx: AuthCtx | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        if (!ctx?.user) return false;
        if (Maintainers.isLocalUser(ctx, env)) return true;
        return Maintainers.isMaintainerEmail(ctx.user.email, env);
    }

    /** Der feste Nutzer des lokalen Modus — nur mit eingeschaltetem Modus und nur so, wie die Auth-Middleware ihn setzt. */
    static isLocalUser(ctx: AuthCtx | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        return LocalMode.isEnabled(env) && ctx?.via === 'local' && ctx.user?.id === LOCAL_USER.id;
    }
}

/** Kurzform fuer die Rechte-Pruefungen. */
export function isMaintainer(ctx: AuthCtx | undefined): boolean {
    return Maintainers.isMaintainer(ctx);
}
