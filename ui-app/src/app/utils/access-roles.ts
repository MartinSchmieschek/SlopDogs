import type { KennelVisibility } from '../models/kennel-config.model';
import type { AclRole, IAclPerson, IAclView } from '../models/user.model';

/** A right the rights chips show (W16: COPY = READ, so there is no copy chip). */
export type AccessRight = 'run' | 'read' | 'edit';

export const ACCESS_RIGHTS: readonly AccessRight[] = ['run', 'read', 'edit'];

/** What each role may do (P3.5 3.5.2). The owner also manages access, which the chips don't show. */
export const RIGHTS_OF_ROLE: Record<AclRole, readonly AccessRight[]> = {
  owner: ['run', 'read', 'edit'],
  editor: ['run', 'read', 'edit'],
  reader: ['run', 'read'],
  runner: ['run'],
};

/** The roles a person below the owner can hold, in the order of the role select. */
export const LIST_ROLES: readonly Exclude<AclRole, 'owner'>[] = ['editor', 'reader', 'runner'];

export const VISIBILITY_OPTIONS: readonly { value: KennelVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'public', hint: 'anyone can run and read' },
  { value: 'run-only', label: 'run only', hint: 'anyone can run, code private' },
  { value: 'private', label: 'private', hint: 'only the people below' },
];

/** What someone who is not on the list may do, per visibility (anonymous and signed-in alike). */
export function rightsOfEveryone(visibility: KennelVisibility): readonly AccessRight[] {
  if (visibility === 'public') return ['run', 'read'];
  if (visibility === 'run-only') return ['run'];
  return [];
}

/** One row of the people list: the owner first, then editors, readers, runners. */
export interface AccessRow {
  id: string;
  role: AclRole;
  label: string;
  email: string | null;
}

/**
 * The rows of an ACL view. The highest role wins (3.5.7): someone listed twice shows once, with the
 * higher role — the server keeps the lists apart, the panel shows the effective role.
 */
export function accessRows(view: IAclView): AccessRow[] {
  const people = new Map<string, IAclPerson>((view.people ?? []).map((p) => [p.id, p]));
  const row = (id: string, role: AclRole): AccessRow => {
    const p = people.get(id);
    return { id, role, label: p?.name?.trim() || p?.email || id, email: p?.email ?? null };
  };
  const seen = new Set<string>();
  const out: AccessRow[] = [];
  const add = (ids: string[], role: AclRole) => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(row(id, role));
    }
  };
  if (view.ownerId) add([view.ownerId], 'owner');
  add(view.editors, 'editor');
  add(view.viewers, 'reader');
  add(view.runners, 'runner');
  return out;
}

/**
 * The three lists after moving one person to a role (or out, with `null`). The person leaves every
 * list first, so a role change never leaves a stale lower entry behind.
 */
export function listsWith(
  view: Pick<IAclView, 'editors' | 'viewers' | 'runners'>,
  person: string,
  role: Exclude<AclRole, 'owner'> | null,
): { editors: string[]; viewers: string[]; runners: string[] } {
  const without = (ids: string[]) => ids.filter((x) => x !== person);
  const next = { editors: without(view.editors), viewers: without(view.viewers), runners: without(view.runners) };
  if (role === 'editor') next.editors.push(person);
  if (role === 'reader') next.viewers.push(person);
  if (role === 'runner') next.runners.push(person);
  return next;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(s: string): boolean {
  return EMAIL_RX.test(s.trim());
}

/** Server error codes of the ACL routes in English. */
export function accessErrorText(status: number, code: string | undefined, fallback?: string): string {
  if (code === 'invalid_user') return 'No SlopDogs account with that address. They have to sign in once first.';
  if (code === 'invalid_visibility') return 'That visibility does not exist.';
  if (code === 'frozen' || status === 409) return 'Frozen. Unfreeze first.';
  if (code === 'forbidden' || status === 403) return 'Only the owner manages access.';
  if (status === 401) return 'Sign in to manage access.';
  if (status === 404) return 'Not found, or not yours to manage.';
  return fallback || `Couldn't save (${status || 'network'}).`;
}
