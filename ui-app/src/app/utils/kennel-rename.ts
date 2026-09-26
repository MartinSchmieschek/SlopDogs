/**
 * Rename in the kennel menu (U8). The server renames the name only (`PATCH /api/kennels/:id/rename`,
 * `KennelController.rename`): the ID is the lineageId — one URL segment under `/k/`, and the key of
 * versions, call counts, stars, grants and every pin in other kennels. A new ID would break all of them,
 * so the dialog changes the name and says that the ID stays.
 */
export const KENNEL_NAME_MAX = 80;

/** Why the draft cannot be saved, or null. Same name as now: nothing to do (the button stays off). */
export function renameProblem(draft: string, current: string): string | null {
  const name = draft.trim();
  if (!name) return 'A kennel needs a name.';
  if (name.length > KENNEL_NAME_MAX) return `Keep it under ${KENNEL_NAME_MAX} characters.`;
  if (name === current.trim()) return 'That is the name it has.';
  return null;
}

/** The server's answer in words: what happened, never the raw status alone. */
export function renameErrorText(status: number): string {
  switch (status) {
    case 401: return 'Sign in to rename this kennel.';
    case 403: return "You can't rename this kennel. Owners and editors can.";
    case 404: return "This kennel isn't here any more.";
    case 409: return 'Frozen. Unfreeze in settings.';
    case 0: return "Couldn't reach the server. Try again.";
    default: return `Couldn't rename the kennel (${status}).`;
  }
}
