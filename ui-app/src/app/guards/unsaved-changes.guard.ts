import type { CanDeactivateFn } from '@angular/router';

/** A page with editors: answers whether it may be left, asking "Unsaved changes. Leave anyway?" if needed. */
export interface LeavesSafely {
  /** `nextUrl`: where the navigation goes — a page may let its own sub-URLs pass without asking. */
  canLeave(nextUrl: string): boolean | Promise<boolean>;
}

/** The kennel page (brief, layout, dog code, settings) asks before another route takes over (U8). */
export const unsavedChangesGuard: CanDeactivateFn<LeavesSafely> = (page, _route, _state, next) =>
  page?.canLeave?.(next.url) ?? true;
