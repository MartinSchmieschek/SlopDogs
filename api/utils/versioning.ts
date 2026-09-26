// Versioning utilities — the rites by which entities branch and multiply in the eldritch deep.
// No longer does a spirit walk a single path from v1 to vN;
// now each incarnation is a GUID, and the lineage branches like cursed coral in the void.
import { randomUUID } from 'crypto';

/**
 * Forge a new version ID — a GUID summoned from the entropy of the void.
 * Each incarnation of a spirit receives its own unique mark, unrepeatable across all realms.
 */
export function generateVersionId(): string {
    return randomUUID();
}

/**
 * Forge a new lineage ID — the lineage mark that binds all incarnations of one spirit.
 * Arr, this GUID is shared across every branch and version of the same hound.
 */
export function generateLineageId(): string {
    return randomUUID();
}
