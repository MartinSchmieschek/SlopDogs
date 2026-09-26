import type { IUserKey, IUserKeyInput } from '../models/user-key.model';

/**
 * Client-side rules of the key store (P4c 4c.3) — the same as `services/KeyStoreService.ts` on the
 * server, so the form says what is wrong before it asks. The server stays the judge.
 */
export const KEY_ALIAS_RX = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const KEY_SECRET_MIN = 8;
export const KEY_SECRET_MAX = 4096;
const HOST_LABEL_RX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const KENNEL_GRANT_RX = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;

/** The mandatory notice on the keys tab (P4c 4c.3, Follie 4.7, word for word). */
export const KEYS_NOTICE =
  "Keys are used by dogs through keys.fetch and {{key:alias}}. They never leave the server and won't survive a database reset. You'll have to add them again.";
/** 503 keystore_disabled (6.8 test 9). */
export const KEYSTORE_OFF = 'The key store is off on this server.';

const ALIAS_RULE = 'Lowercase letters, digits, _ and -, up to 32, starting with a letter or digit.';

export function aliasProblem(alias: string): string | null {
  if (!alias) return null;
  return KEY_ALIAS_RX.test(alias) ? null : ALIAS_RULE;
}

export function secretProblem(secret: string): string | null {
  if (!secret) return null;
  if (/[\r\n\0]/.test(secret)) return 'One line only.';
  if (secret.length < KEY_SECRET_MIN) return `At least ${KEY_SECRET_MIN} characters.`;
  if (secret.length > KEY_SECRET_MAX) return `At most ${KEY_SECRET_MAX} characters.`;
  return null;
}

/** `api.example.com` or `*.example.com`, lowercased; null when it isn't a hostname (no IPs, no single labels). */
export function normalizeDomain(raw: string): string | null {
  let host = raw.trim().toLowerCase().replace(/\.$/, '');
  const wildcard = host.startsWith('*.');
  if (wildcard) host = host.slice(2);
  const labels = host.split('.');
  if (labels.length < 2 || !labels.every((l) => HOST_LABEL_RX.test(l))) return null;
  if (labels.every((l) => /^\d+$/.test(l))) return null;
  return wildcard ? `*.${host}` : host;
}

export function grantProblem(grant: string): string | null {
  return KENNEL_GRANT_RX.test(grant) ? null : 'A kennel ID: letters, digits, . _ -';
}

export interface KeyFormState {
  alias: string;
  secret: string;
  domains: string[];
  grants: string[];
  quota: string;
}

export type KeyFormResult =
  | { ok: true; input: IUserKeyInput }
  | { ok: false; field: Exclude<KeyField, 'form'>; error: string };

/** The POST body, or the first field that is wrong. Grants need a daily quota (8.8). */
export function keyFormInput(f: KeyFormState): KeyFormResult {
  const alias = f.alias.trim();
  if (!alias || aliasProblem(alias)) return { ok: false, field: 'alias', error: aliasProblem(alias) ?? 'The alias is required.' };
  if (!f.secret || secretProblem(f.secret)) return { ok: false, field: 'secret', error: secretProblem(f.secret) ?? 'The value is required.' };
  if (!f.domains.length) return { ok: false, field: 'domains', error: 'At least one domain the key may be sent to.' };
  const input: IUserKeyInput = { alias, secret: f.secret, allowedDomains: [...f.domains] };
  if (f.grants.length) {
    const quota = Number(f.quota);
    if (!f.quota.trim() || !Number.isInteger(quota) || quota < 1 || quota > 1_000_000) {
      return { ok: false, field: 'quota', error: 'Granted keys need a daily quota: a whole number from 1 to 1000000.' };
    }
    input.kennelGrants = [...f.grants];
    input.quotaPerDay = quota;
  }
  return { ok: true, input };
}

/** Server error codes of `/api/keys` in English, keyed to the field they belong to. */
export type KeyField = 'alias' | 'secret' | 'domains' | 'quota' | 'form';

export function keyErrorText(status: number, code: string | undefined): { field: KeyField; text: string } {
  switch (code) {
    case 'invalid_alias': return { field: 'alias', text: ALIAS_RULE };
    case 'invalid_secret': return { field: 'secret', text: `${KEY_SECRET_MIN} to ${KEY_SECRET_MAX} characters, one line.` };
    case 'invalid_domains': return { field: 'domains', text: 'Hostnames only: api.example.com or *.example.com. No IPs.' };
    case 'invalid_grants': return { field: 'quota', text: 'Grants are kennel IDs, at most 50.' };
    case 'invalid_quota':
    case 'quota_required': return { field: 'quota', text: 'Granted keys need a daily quota from 1 to 1000000.' };
    case 'keystore_disabled': return { field: 'form', text: KEYSTORE_OFF };
    case 'no_identity': return { field: 'form', text: 'Keys belong to a signed-in person. Sign in first.' };
    default: return { field: 'form', text: `Couldn't save the key (${status || 'network'}).` };
  }
}

/** `used 2 h ago` / `never used` for the second line of a key row. */
export function usedLabel(lastUsedAt: string | null, now = Date.now()): string {
  if (!lastUsedAt) return 'never used';
  const t = Date.parse(lastUsedAt);
  if (!Number.isFinite(t)) return 'never used';
  const min = Math.max(0, Math.round((now - t) / 60000));
  if (min < 1) return 'used just now';
  if (min < 60) return `used ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `used ${h} h ago`;
  return `used ${Math.round(h / 24)} d ago`;
}

/** `no grants` or `2 kennels · 500/day`. */
export function grantsLabel(key: Pick<IUserKey, 'kennelGrants' | 'quotaPerDay'>): string {
  const n = key.kennelGrants?.length ?? 0;
  if (!n) return 'no grants';
  return `${n} kennel${n === 1 ? '' : 's'}${key.quotaPerDay ? ` · ${key.quotaPerDay}/day` : ''}`;
}
