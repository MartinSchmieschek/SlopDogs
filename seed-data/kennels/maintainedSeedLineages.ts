import { MaintainedSeedDogs } from './maintainedSeed';
import { SLOPDOGS_LANDING_DOG_NAMES, SLOPDOGS_LANDING_KENNEL_ID } from './slopdogs-landing';
import { SLOPDOGS_KENNELS_KENNEL_ID, SlopdogsKennelsSource } from './slopdogs-kennels';

/**
 * Die festen Lineages aller Seed-Dogs von Landing und Kennel-Liste — aus den Seed-Definitionen, ohne Datenbank.
 * LandingDogLock sperrt sie (besitzerlos) auch dann, wenn ihr Kennel gerade geloescht ist und erst der naechste Start
 * ihn neu seedet. Bestaende mit alten Zufalls-Lineages trifft das nicht. Die Kennel-IDs nur fuer Tests.
 */
export function maintainedSeedLineages(
    landingKennelId: string = SLOPDOGS_LANDING_KENNEL_ID,
    listKennelId: string = SLOPDOGS_KENNELS_KENNEL_ID,
): string[] {
    return [
        ...SLOPDOGS_LANDING_DOG_NAMES.map((name) => MaintainedSeedDogs.lineageId(landingKennelId, name)),
        ...SlopdogsKennelsSource.DOGS.map((dog) => MaintainedSeedDogs.lineageId(listKennelId, dog.displayName)),
    ];
}
