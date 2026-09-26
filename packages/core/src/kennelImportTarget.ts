/**
 * Resolves kennel id and display name for import/export bundles in one place
 * (phase 1: id collision with an existing kennel; phase 2: display name already taken).
 * Used by the API import flow and the UI import preview; the Angular app mirrors logic in
 * `ui-app/src/app/utils/kennel-import-target.ts` to avoid Vite subpath issues with @slopdogs/core.
 */

export type KennelIdNameListEntry = {
  lineageId?: string;
  id: string;
  name?: string;
};

export function kennelListRef(entry: KennelIdNameListEntry): string {
  return (entry.lineageId || entry.id || '').trim();
}

function nameNorm(name: string): string {
  return name.trim().toLowerCase();
}

export function isKennelIdTakenInList(kennelId: string, existing: KennelIdNameListEntry[]): boolean {
  const t = kennelId.trim();
  if (!t) return true;
  return existing.some((e) => kennelListRef(e) === t);
}

export function isKennelNameTakenInList(
  displayName: string,
  existing: KennelIdNameListEntry[]
): boolean {
  const t = nameNorm(displayName);
  if (!t) return false;
  return existing.some((e) => nameNorm(e.name || '') === t);
}

/**
 * Returns the first free (id, name) suggestion, aligned with the server import logic.
 * `bundle.kennel` must carry kennelId and optional name, as in export.
 */
export function suggestKennelImportTarget(
  bundle: { kennel: { kennelId: string; name?: string } },
  existing: KennelIdNameListEntry[]
): { kennelId: string; name: string; initial: { kennelId: string; name: string } } {
  const originalId = (bundle.kennel.kennelId || '').trim();
  if (!originalId) {
    throw new Error('Bundle: kennel.kennelId is required');
  }
  const baseName0 = (bundle.kennel.name && bundle.kennel.name.trim()) || originalId;

  const initial = { kennelId: originalId, name: baseName0 };

  // Phase 1: kennel ids that collide — keep id + paired display name in lockstep
  let kennelId = originalId;
  let kennelName = baseName0;
  let copyIndex = 0;
  while (isKennelIdTakenInList(kennelId, existing)) {
    copyIndex++;
    kennelId = `${originalId}-copy${copyIndex > 1 ? '-' + copyIndex : ''}`;
    kennelName = `${baseName0} (Copy${copyIndex > 1 ? ' ' + copyIndex : ''})`;
  }

  // Phase 2: display name still taken by some other kennel
  for (let t = 0; t < 500; t++) {
    const candidate =
      t === 0 ? baseName0 : t === 1 ? `${baseName0} (Copy)` : `${baseName0} (Copy ${t})`;
    if (!isKennelNameTakenInList(candidate, existing)) {
      kennelName = candidate;
      break;
    }
  }
  if (isKennelNameTakenInList(kennelName, existing)) {
    kennelName = `${baseName0} (Import ${Date.now()})`;
  }

  return { kennelId, name: kennelName, initial };
}

/** True if the id or name must be chosen explicitly because a conflict exists. */
export function kennelImportNeedsUserChoice(
  bundle: { kennel: { kennelId: string; name?: string } },
  existing: KennelIdNameListEntry[]
): boolean {
  const i = bundle.kennel;
  const kennelId0 = (i.kennelId || '').trim();
  const name0 = (i.name && i.name.trim()) || kennelId0;
  if (!kennelId0) return true;
  if (isKennelIdTakenInList(kennelId0, existing)) return true;
  if (isKennelNameTakenInList(name0, existing)) return true;
  return false;
}
