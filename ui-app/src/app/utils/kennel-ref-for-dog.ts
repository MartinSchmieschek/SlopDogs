import { DogEntry } from '../models/dog-entry.model';
import { findKennelDogIndex } from './kennel-dog-id-match';

/**
 * Resolve the stable kennel-identity key for a DogEntry rendered on the wave-view canvas.
 * Used to key per-node persistence (layout positions, comments) against the kennel config.
 *
 * Strategy:
 * 1. If the dog matches an entry in kennelDogIds (via lineageId / base:Name / version), use that entry.
 * 2. Otherwise (transitive dependency, auto-mimic, etc.), fall back to lineageId or a base:Name guess.
 */
export function kennelRefForDog(dog: DogEntry, kennelDogIds: string[]): string {
  const idx = findKennelDogIndex(kennelDogIds, dog.id, dog.lineageId);
  if (idx >= 0) return kennelDogIds[idx];
  if (dog.lineageId) return dog.lineageId;
  // Base-dogs in the waves have id === name and no codeTs / serializedDogConfig.
  const isBaseLike = !dog.codeTs && !dog.serializedDogConfig && dog.id === dog.name;
  if (isBaseLike) return `base:${dog.name}`;
  return dog.id;
}
