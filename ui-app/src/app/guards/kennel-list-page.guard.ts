import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { KennelListPageService } from '../services/kennel-list-page.service';

/** True when this document was loaded at `/kennels` — the server already chose between the kennel and this list. */
function documentIsKennelList(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/kennels';
}

/**
 * Spur K: every in-app way to `/kennels` (routerLink, navigate, the redirects of `''`, `kennel` and `**`) passes
 * here. If the server delivers `/kennels` as the kennel, the navigation becomes a full page load; otherwise the
 * Angular list stays. No circle: a document the server sent for `/kennels` is the server's answer (the kennel or
 * its fallback to this list) and never reloads itself, and the server only says "active" while the kennel runs.
 */
export const kennelListPageGuard: CanActivateFn = async (_route, state) => {
  if (documentIsKennelList()) return true;
  const active = await inject(KennelListPageService).active();
  if (!active) return true;
  window.location.assign(state.url);
  return false;
};
