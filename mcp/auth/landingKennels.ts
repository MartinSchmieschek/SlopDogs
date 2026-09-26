// Die Landing-Kennels aus der Env (PLAN P5, Aenderung 2026-09-26): `/` rotiert zwischen ihnen, und solange ein
// Kennel dort steht, ist er fuer alle schreibgeschuetzt — Owner und Super-User eingeschlossen. Die Env ist die
// einzige Quelle: kein Flag in der Datenbank, das jemand vergessen koennte zurueckzusetzen.

/**
 * `LANDING_KENNEL_IDS=a,b,c` (kommagetrennt, Reihenfolge egal, Doppelte zaehlen einmal). Der alte Einzelwert
 * `LANDING_KENNEL_ID` (P5) bleibt als Alias lesbar — ein Eintrag, mit einer Logzeile. Gelesen wird bei jedem
 * Aufruf, geparst nur, wenn sich der Rohwert aendert.
 */
export class LandingKennels {
    /** Der Grund in `myRights.locked` und der Code der Ablehnung (403). */
    static readonly LOCK = 'landing';
    static readonly LOCK_CODE = 'locked_landing';
    static readonly LOCK_MESSAGE = 'Locked: this kennel is a landing page (LANDING_KENNEL_IDS).';

    private static parsed: { raw: string; ids: string[] } | null = null;
    private static aliasLogged: string | null = null;

    static ids(): string[] {
        const list = (process.env.LANDING_KENNEL_IDS ?? '').trim();
        const alias = (process.env.LANDING_KENNEL_ID ?? '').trim();
        const raw = list || alias;
        if (!list && alias && LandingKennels.aliasLogged !== alias) {
            LandingKennels.aliasLogged = alias;
            console.log(`[landing] LANDING_KENNEL_ID=${alias} gelesen als LANDING_KENNEL_IDS (Alias, ein Eintrag) — bitte auf LANDING_KENNEL_IDS umstellen.`);
        }
        if (LandingKennels.parsed?.raw !== raw) {
            const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
            LandingKennels.parsed = { raw, ids: ids.filter((id, i) => ids.findIndex((o) => o.toLowerCase() === id.toLowerCase()) === i) };
        }
        return [...LandingKennels.parsed.ids];
    }

    /** Steht diese Kennel-ID in der Liste? Kennel-IDs sind ohne Gross-/Kleinschreibung eindeutig (KennelController). */
    static includes(kennelId: unknown): boolean {
        if (typeof kennelId !== 'string' || !kennelId) return false;
        const wanted = kennelId.toLowerCase();
        return LandingKennels.ids().some((id) => id.toLowerCase() === wanted);
    }
}
