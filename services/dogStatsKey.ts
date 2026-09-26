// dogStatsKeyOf — unter welchem Schluessel ein Dog-Lauf gezaehlt wird (P4b 4b.2). Eine Quelle fuer
// den Observer in runKennel und fuer die Referenz-Normalisierung: Versionen zaehlen auf ihre Lineage.
import { BASE_DOG_PREFIX, SerializedDog, type IHuntingDog } from '@slopdogs/core';

/**
 * SerializedDog/MimicDog mit lineageId -> die lineageId; Base-Dog -> `base:<Klasse>`;
 * SerializedDog ohne lineageId (frischer Auto-Mimic-Platzhalter) -> null: nicht zaehlen —
 * sein Fehler steht ohnehin am Kennel als leadFailed.
 */
export function dogStatsKeyOf(dog: IHuntingDog<unknown>): string | null {
    if (dog instanceof SerializedDog) {
        const lineageId = dog.lineageId;
        return typeof lineageId === 'string' && lineageId.length > 0 ? lineageId : null;
    }
    const name = dog?.name;
    return typeof name === 'string' && name.length > 0 ? BASE_DOG_PREFIX + name : null;
}
