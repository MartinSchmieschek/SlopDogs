// Maintainers — wer die gepflegten Kennels (Landing, Seed-Listen) und ihre besitzerlosen Dogs aendern darf
// (fix/k-sandbox, 2026-10-31). Quelle ist allein die Env SLOPDOGS_MAINTAINER_EMAILS (kommagetrennte Google-Adressen,
// Gross-/Kleinschreibung egal — dieselbe Normalisierung wie BETA_ADMIN_EMAILS). Leer: niemand, die Kennels sind
// fuer alle gesperrt. Owner und Super-User zaehlen nur mit Eintrag.
//
// Eine Stelle fuer die Pruefung: ein spaeterer lokaler Modus (eigener Nutzer ohne Google-Adresse) traegt sich hier ein.
import type { AuthCtx } from './middleware';

export class Maintainers {
    static readonly ENV = 'SLOPDOGS_MAINTAINER_EMAILS';

    /** Die Adressen aus der Env, normalisiert (trim, klein). */
    static emails(env: NodeJS.ProcessEnv = process.env): string[] {
        return (env[Maintainers.ENV] ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    }

    static isMaintainerEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        const wanted = email?.trim().toLowerCase();
        return !!wanted && Maintainers.emails(env).includes(wanted);
    }

    /** Darf dieser Aufrufer gepflegte Kennels und ihre besitzerlosen Dogs aendern? */
    static isMaintainer(ctx: AuthCtx | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
        if (!ctx?.user) return false;
        return Maintainers.isMaintainerEmail(ctx.user.email, env);
    }
}

/** Kurzform fuer die Rechte-Pruefungen. */
export function isMaintainer(ctx: AuthCtx | undefined): boolean {
    return Maintainers.isMaintainer(ctx);
}
