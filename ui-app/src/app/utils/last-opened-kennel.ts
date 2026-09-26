import { publicKennelPath } from '../config/public-paths';

/**
 * The kennel list remembers the kennel opened last — by its name (public page, new tab) or by its row
 * (kennel page) — per browser, and marks it (10-0 after the local test: "markiert in der liste ist das
 * zuletzt aufgerufene"). Plain functions without Angular, so the rule can be checked on its own.
 */
export const LAST_OPENED_KENNEL_STORAGE_KEY = 'slopdogs.kennelList.lastOpened.v1';

/** The part of `Storage` the rule needs — a fake in a test, `localStorage` in the app. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The ref (lineageId, else id) opened last, or null — private mode, no entry or a broken value. */
export function readLastOpenedKennel(storage: KeyValueStorage | null = browserStorage()): string | null {
  try {
    const raw = storage?.getItem(LAST_OPENED_KENNEL_STORAGE_KEY);
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

/** Remember `ref` as opened last; a full or blocked storage keeps the mark for this page only. */
export function rememberLastOpenedKennel(ref: string, storage: KeyValueStorage | null = browserStorage()): void {
  const value = ref.trim();
  if (!value) return;
  try {
    storage?.setItem(LAST_OPENED_KENNEL_STORAGE_KEY, value);
  } catch {
    /* private mode / quota */
  }
}

/** `/k/:id` plus the stored `defaultQuery` — what the name and `⏵` open and `Copy link` copies. */
export function publicKennelPathWithDefaults(ref: string, defaultQuery?: Record<string, string> | null): string {
  const path = publicKennelPath(ref);
  if (!defaultQuery || typeof defaultQuery !== 'object') return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(defaultQuery)) {
    if (k.trim()) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
