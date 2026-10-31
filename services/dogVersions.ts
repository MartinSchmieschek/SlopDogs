// dogVersions — welche Paket-Version jeder Base-Dog eines Laufs hatte (PLAN-DOG-PAKETE P2.5).
//
// Ein Base-Dog ist in Kennels nur ein Name (`base:<Klasse>`). Seit die Base-Dogs in eigenen Paketen mit eigener
// Version liegen, sagt erst die Version, welcher Code einen Lauf erzeugt hat. Der Boot traegt die Versionen
// einmal ein (createHttpApplication, aus BaseDogPacks); Lauf-Antworten und Snapshots lesen sie hier nach.
import { BASE_DOG_PREFIX } from '@martinschmieschek/slopdogs-core/runtime';
import type { Waves } from './WavesConverter';
import type { DogPackage } from './BaseDogPacks';

/** `base:<Klasse>` -> `<npm-Name>@<Version>`, z. B. `@martinschmieschek/slopdogs-dogs-weather@0.2.0-beta.0`. */
export type DogVersions = Record<string, string>;

const byDogName = new Map<string, DogPackage>();

/** Beim Boot: die Pakete aller Base-Dogs nach Dog-Namen (Klassenname). */
export function registerBaseDogPackages(entries: Iterable<[dogName: string, pkg: DogPackage | null]>): void {
    byDogName.clear();
    for (const [name, pkg] of entries) if (pkg) byDogName.set(name, pkg);
}

/** Das Paket eines Base-Dogs nach seinem Namen, oder null. */
export function basePackageOf(dogName: string): DogPackage | null {
    return byDogName.get(dogName) ?? null;
}

/**
 * Die Versionen der Base-Dogs, die in diesen Waves gelaufen sind. SerializedDogs und MimicDogs haben eigene
 * Versionen (lineageId/Version-GUID) und stehen hier nicht. Sortiert, damit gleiche Laeufe gleich aussehen.
 */
export function dogVersionsOf(waves: Waves | undefined): DogVersions {
    const out: DogVersions = {};
    for (const node of (waves ?? []).flat()) {
        if (node.editable || node.mimic) continue;
        const pkg = byDogName.get(node.name);
        if (pkg) out[BASE_DOG_PREFIX + node.name] = `${pkg.name}@${pkg.version}`;
    }
    return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
