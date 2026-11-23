import type { LandingPage } from './LandingPage';
import type { KennelListPage } from './KennelListPage';
import type { MyPagesRedirect } from './MyPagesRedirect';

/** Kontext für die umgebungsabhängige Express-Frontend-Schicht (Static / Redirect / SPA). */
export type HttpFrontEndContext = {
    devUiOrigin: string;
    /** Nur production/integration gesetzt, sonst null. */
    angularBrowserDir: string | null;
    /** `public/` (Quelle fuer /static und die Landing-Dateien unter public/landing/), sonst null. */
    publicDir: string | null;
    /** `/` = Lead-Ausgabe des Landing-Kennels aus dem Memo, sonst der statische Fallback (P5). */
    landingPage: LandingPage | null;
    /** `/kennels` = Lead-Ausgabe des Kennels `slopdogs-kennels` (Spur K), sonst der Rueckfall (Angular-Liste). */
    kennelListPage?: KennelListPage | null;
    /** Eigene Seiten: das erste Glied vor `/` und `/kennels` (Umleitung eingeloggter Nutzer); ohne gilt fuer alle der Default. */
    myPages?: MyPagesRedirect | null;
};

export type HttpFrontEndBinder = {
    beforeControllers(app: import('express').Application, ctx: HttpFrontEndContext): void;
    afterKennelRoutes(app: import('express').Application, ctx: HttpFrontEndContext): void;
};
