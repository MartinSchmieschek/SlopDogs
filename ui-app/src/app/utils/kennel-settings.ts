import type { IKennelConfig } from '../models/kennel-config.model';

/** How the settings drawer shows itself (6.4 S3). `landing`: locked_landing (P5) — read-only, no unfreeze. */
export type SettingsView = 'edit' | 'frozen' | 'landing' | 'readonly' | 'none';

export interface SettingsRights {
  read: boolean;
  edit: boolean;
  own: boolean;
}

/** The toast for `/kennels/:id/edit` without edit rights (6.4 S3, 6.8 test 8). */
export const CANT_EDIT_TOAST = "You can't edit this kennel.";

/**
 * Editors on a frozen kennel have `edit: false` (8.25: frozen blocks every edit, the owner's too) —
 * whether they would edit shows in the lists, which only owners and editors receive.
 */
export function isListedEditor(cfg: Pick<IKennelConfig, 'ownerId' | 'editors'> | null | undefined, userId: string | null | undefined): boolean {
  if (!cfg || !userId) return false;
  if (cfg.ownerId === userId) return true;
  return String(cfg.editors ?? '').split(',').map((s) => s.trim()).includes(userId);
}

/**
 * Editors edit; frozen shows everything read-only with the unfreeze banner; landing (P5,
 * LANDING_KENNEL_IDS) shows everything read-only too, but without an unfreeze offer — nobody, not
 * even the owner, mutates a landing kennel, and it wins over frozen (unfreezing would not help);
 * readers read; without READ (run-only, missing) no settings.
 */
export function settingsView(rights: SettingsRights | null, frozen: boolean, landingLocked = false): SettingsView {
  if (!rights || !rights.read) return 'none';
  if (landingLocked) return 'landing';
  if (frozen) return 'frozen';
  return rights.edit ? 'edit' : 'readonly';
}

/**
 * The deep link `/kennels/:id/edit` opens the drawer for whoever may edit — on a frozen or landing
 * kennel for the owner and editors (read-only, the banner says why — `rights.own`/`edit` are scrubbed
 * to false for landing, so `listedEditor` is the only signal left); everyone else stays on the page
 * with the toast.
 */
export function editDeepLinkOpens(
  rights: SettingsRights | null,
  frozen: boolean,
  listedEditor: boolean,
  landingLocked = false,
): boolean {
  if (!rights?.read) return false;
  if (landingLocked) return listedEditor;
  if (frozen) return rights.own || listedEditor;
  return rights.edit;
}

/** One default-query row of the drawer. */
export interface QueryRow {
  key: string;
  value: string;
}

export interface SettingsForm {
  name: string;
  description: string;
  emoji: string;
  dogIds: string[];
  query: QueryRow[];
  body: string;
}

export type SettingsPayload =
  | { ok: true; patch: Partial<IKennelConfig> }
  | { ok: false; field: 'body'; error: string };

/** The drawer's form as it starts from a config. */
export function settingsFormOf(cfg: IKennelConfig | null): SettingsForm {
  return {
    name: cfg?.name ?? '',
    description: cfg?.description ?? '',
    emoji: cfg?.emoji ?? '',
    dogIds: [...(cfg?.dogIds ?? [])],
    query: Object.entries(cfg?.defaultQuery ?? {}).map(([key, value]) => ({ key, value: String(value) })),
    body: cfg?.defaultBody !== undefined && cfg?.defaultBody !== null ? JSON.stringify(cfg.defaultBody, null, 2) : '',
  };
}

/** True when the drawer's form differs from the stored config — the "Unsaved changes" question (U8). */
export function settingsDirty(cfg: IKennelConfig | null, form: SettingsForm): boolean {
  const stored = settingsFormOf(cfg);
  const rows = (q: QueryRow[]) => JSON.stringify(q.filter((r) => r.key.trim() || r.value.trim()));
  return stored.name !== form.name
    || stored.description !== form.description
    || stored.emoji !== form.emoji
    || stored.dogIds.join('\n') !== form.dogIds.join('\n')
    || rows(stored.query) !== rows(form.query)
    || stored.body.trim() !== form.body.trim();
}

/** Why the body is not JSON, or null. An empty body means "no default body". */
export function bodyProblem(body: string): string | null {
  if (!body.trim()) return null;
  try {
    JSON.parse(body);
    return null;
  } catch (e) {
    return `Not valid JSON: ${(e as Error).message}`;
  }
}

/**
 * The PUT for the drawer. Brief, layout and notes ride along unchanged (the server keeps the head's
 * fields, but a full config never loses one); visibility belongs to the access panel and is left out.
 */
export function settingsPayload(cfg: IKennelConfig | null, form: SettingsForm): SettingsPayload {
  const problem = bodyProblem(form.body);
  if (problem) return { ok: false, field: 'body', error: problem };
  const defaultQuery: Record<string, string> = {};
  for (const row of form.query) {
    const key = row.key.trim();
    if (key) defaultQuery[key] = row.value;
  }
  return {
    ok: true,
    patch: {
      name: form.name.trim(),
      description: form.description.trim(),
      emoji: form.emoji.trim(),
      dogIds: [...form.dogIds],
      defaultQuery: Object.keys(defaultQuery).length ? defaultQuery : undefined,
      defaultBody: form.body.trim() ? JSON.parse(form.body) : undefined,
      task: cfg?.task,
      nodes: cfg?.nodes,
      edges: cfg?.edges,
    },
  };
}

/** Move a dog in the order: `lead` to the top, `up`/`down` one step, `remove` out. */
export function reorderDogIds(ids: string[], index: number, move: 'lead' | 'up' | 'down' | 'remove'): string[] {
  if (index < 0 || index >= ids.length) return ids;
  const next = [...ids];
  if (move === 'remove') {
    next.splice(index, 1);
    return next;
  }
  const target = move === 'lead' ? 0 : move === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= next.length || target === index) return ids;
  const [entry] = next.splice(index, 1);
  next.splice(target, 0, entry);
  return next;
}
