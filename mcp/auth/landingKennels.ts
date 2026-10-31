// Die Landing-Kennels aus der Env (PLAN P5, Aenderung 2026-09-26): `/` rotiert zwischen ihnen. Die Env ist die
// einzige Quelle: kein Flag in der Datenbank, das jemand vergessen koennte zurueckzusetzen.
//
// Seit 2026-10-31 (fix/k-sandbox): gepflegte Kennels. Dazu zaehlen die Liste, der geseedete Standard
// `slopdogs-landing` (er steht hinter der Liste immer bereit) und die geseedeten Pflege-Kennels (SEED_CURATED_IDS,
// z. B. die kommende Kennel-Liste `slopdogs-kennels` — vertraut, aber nicht in der Rotation von `/`). Sie laufen
// ohne Sandbox; aendern duerfen sie nur Maintainer (SLOPDOGS_MAINTAINER_EMAILS, maintainers.ts), ohne Eintrag niemand.
// Ebenso die besitzerlosen Dogs, die sie nutzen (dogIds und Parents, transitiv): die Menge rechnet
// services/LandingDogLock.ts und legt sie hier ab.

/**
 * `LANDING_KENNEL_IDS=a,b,c` (kommagetrennt, Reihenfolge egal, Doppelte zaehlen einmal). Der alte Einzelwert
 * `LANDING_KENNEL_ID` (P5) bleibt als Alias lesbar — ein Eintrag, mit einer Logzeile. Gelesen wird bei jedem
 * Aufruf, geparst nur, wenn sich der Rohwert aendert.
 */
export class LandingKennels {
    /** Der absolute Standard fuer `/` (geseedet, seed-data/kennels/slopdogs-landing.ts). */
    static readonly DEFAULT_KENNEL_ID = 'slopdogs-landing';
    /** Geseedete Pflege-Kennels ausserhalb der Rotation: vertraut und nur fuer Maintainer aenderbar. */
    static readonly SEED_CURATED_IDS: readonly string[] = ['slopdogs-kennels'];
    /** Der Grund in `myRights.locked` und der Code der Ablehnung (403). */
    static readonly LOCK = 'landing';
    static readonly LOCK_CODE = 'locked_landing';
    static readonly LOCK_MESSAGE = 'Locked: this kennel is a landing page — only maintainers (SLOPDOGS_MAINTAINER_EMAILS) may change it.';
    static readonly LOCK_DOG_MESSAGE = 'Locked: this dog has no owner and is part of a landing page — only maintainers (SLOPDOGS_MAINTAINER_EMAILS) may change it.';

    private static parsed: { raw: string; ids: string[] } | null = null;
    private static aliasLogged: string | null = null;
    /** Lineages, die gepflegte Kennels nutzen; null = noch nicht berechnet (besitzerlose Dogs gelten dann als gesperrt). */
    private static lockedDogs: ReadonlySet<string> | null = null;

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

    /** Alle gepflegten Kennels: die Liste, der Standard, die geseedeten Pflege-Kennels — ohne Doppelte. */
    static protectedIds(): string[] {
        const out = LandingKennels.ids();
        for (const id of [LandingKennels.DEFAULT_KENNEL_ID, ...LandingKennels.SEED_CURATED_IDS]) {
            if (!out.some((o) => o.toLowerCase() === id)) out.push(id);
        }
        return out;
    }

    /** Ein gepflegter Kennel (Liste, Standard oder Seed-Pflege-Kennel)? */
    static isProtected(kennelId: unknown): boolean {
        if (typeof kennelId !== 'string' || !kennelId) return false;
        const wanted = kennelId.toLowerCase();
        return LandingKennels.protectedIds().some((id) => id.toLowerCase() === wanted);
    }

    /** Von services/LandingDogLock.ts: die Lineages, die die gepflegten Kennels gerade nutzen. */
    static setLockedDogs(lineageIds: Iterable<string>): void {
        LandingKennels.lockedDogs = new Set(lineageIds);
    }

    /** Nutzt ein gepflegter Kennel diese Dog-Lineage? Vor der ersten Berechnung: ja (lieber zu viel gesperrt). */
    static usesDog(lineageId: unknown): boolean {
        if (LandingKennels.lockedDogs === null) return true;
        return typeof lineageId === 'string' && LandingKennels.lockedDogs.has(lineageId);
    }

    /** Wie usesDog, aber nur, was sicher bekannt ist — fuer Zeilen, denen man den Dog nicht ansieht. */
    static knownToUseDog(lineageId: unknown): boolean {
        return LandingKennels.lockedDogs !== null && typeof lineageId === 'string' && LandingKennels.lockedDogs.has(lineageId);
    }

    /** Der Text der Ablehnung — Kennel oder Dog. */
    static lockMessageFor(entity: unknown): string {
        return LandingKennels.looksLikeDog(entity) ? LandingKennels.LOCK_DOG_MESSAGE : LandingKennels.LOCK_MESSAGE;
    }

    /** Dog-Zeile oder -Konfig? Ein Kennel traegt weder Dog-Typ noch theRun noch parentsRequired. */
    static looksLikeDog(entity: unknown): boolean {
        if (!entity || typeof entity !== 'object') return false;
        const e = entity as { type?: unknown; theRun?: unknown; parentsRequired?: unknown };
        return ['SerializedDog', 'MimicDog', 'BaseDog'].includes(e.type as string)
            || e.theRun !== undefined
            || e.parentsRequired !== undefined;
    }
}
