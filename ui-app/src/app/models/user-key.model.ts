/**
 * Ein Schluessel im Key-Store (P4c), so wie die API ihn zeigt: maskiert. Den Wert gibt es nach dem
 * Speichern nie wieder — Dogs nutzen ihn ueber `keys.fetch` mit `{{key:<alias>}}`.
 * Die Flaeche dafuer entsteht in P6 (U7, `/account?tab=keys`).
 */
export interface IUserKey {
  alias: string;
  last4: string;
  allowedDomains: string[];
  /** Kennel-Lineages, die den Key in fremden Laeufen nutzen duerfen (8.8); leer = nur der Besitzer. */
  kennelGrants: string[];
  quotaPerDay: number | null;
  createdAt: string;
  lastUsedAt: string | null;
}

/** POST /api/keys — Upsert je Alias. */
export interface IUserKeyInput {
  alias: string;
  secret: string;
  allowedDomains: string[];
  /** Opt-in (8.8): nur zusammen mit quotaPerDay. */
  kennelGrants?: string[];
  quotaPerDay?: number;
}

/** Fehlercodes der Key-Store-API (400/403/404/503). */
export type UserKeyErrorCode =
  | 'invalid_alias'
  | 'invalid_secret'
  | 'invalid_domains'
  | 'invalid_quota'
  | 'invalid_grants'
  | 'quota_required'
  | 'no_identity'
  | 'not_found'
  | 'keystore_disabled';
