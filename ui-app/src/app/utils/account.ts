/** The tabs of `/account` (6.4 S9); `beta` only for beta admins. */
export type AccountTab = 'profile' | 'tokens' | 'keys' | 'beta';

export const ACCOUNT_TABS: readonly AccountTab[] = ['profile', 'tokens', 'keys'];

/** `?tab=` to a tab; anything else is the profile. */
export function accountTabOf(raw: string | null | undefined): AccountTab {
  return ([...ACCOUNT_TABS, 'beta'] as readonly string[]).includes(raw ?? '') ? (raw as AccountTab) : 'profile';
}

/**
 * The tabs someone sees: signed in, the three plus `beta` for admins; signed out, only `beta` — for the local
 * super-user, who manages beta keys without an account of its own — or nothing (then: to the login).
 */
export function visibleAccountTabs(signedIn: boolean, betaAdmin: boolean): AccountTab[] {
  if (!signedIn) return betaAdmin ? ['beta'] : [];
  return betaAdmin ? [...ACCOUNT_TABS, 'beta'] : [...ACCOUNT_TABS];
}

/**
 * Where `/login?returnTo=` may send someone back: a path on this site, never another host
 * (`//evil.example`, `https://…`). Everything else goes to the kennels.
 */
export function safeReturnTo(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/kennels';
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login/')) return '/kennels';
  return raw;
}
