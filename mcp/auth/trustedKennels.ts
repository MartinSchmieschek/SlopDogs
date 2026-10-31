// TrustedKennels — welche Kennel-Seiten unter `/k/` ohne Sandbox laufen (fix/k-sandbox, 2026-10-31).
//
// Vertraut ist nur, wer nicht von jedem umgeschrieben werden kann: die gepflegten Kennels (LandingKennels.isProtected:
// LANDING_KENNEL_IDS, der Seed-Standard `slopdogs-landing`, die Seed-Pflege-Kennels wie `slopdogs-kennels`). Sie und
// ihre besitzerlosen Dogs aendern nur Maintainer (visibility.ts). Ein neuer vertrauter Kennel kommt dort hinzu, nicht
// hier — dieselbe Liste traegt Vertrauen und Schreibschutz, damit beides nie auseinanderlaeuft.
import { LandingKennels } from './landingKennels';

export class TrustedKennels {
    /** Laeuft diese Kennel-Seite ohne Sandbox? Entscheidet am aufgeloesten Kennel, nie am URL-Segment. */
    static isTrusted(kennel: { lineageId?: unknown; id?: unknown } | null | undefined): boolean {
        if (!kennel) return false;
        const key = typeof kennel.lineageId === 'string' && kennel.lineageId ? kennel.lineageId : kennel.id;
        return LandingKennels.isProtected(key);
    }
}
