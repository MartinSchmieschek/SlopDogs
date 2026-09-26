import { Routes, UrlSegment, UrlMatchResult } from '@angular/router';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

/**
 * `/kennels/:id` and `/kennels/:id/edit` are one route (P6 U6): the edit segment opens the settings
 * drawer over the kennel page — the page stays, only the drawer comes and goes.
 */
export function kennelPageMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length < 2 || segments.length > 3 || segments[0].path !== 'kennels') return null;
  if (segments.length === 3 && segments[2].path !== 'edit') return null;
  return { consumed: segments, posParams: { id: segments[1] } };
}

/**
 * Handkopie der SPA-Routen aus api/routes/routeTable.ts (SPA_ROUTES) — bei Aenderung beide pflegen.
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'kennels',
    pathMatch: 'full',
  },
  {
    path: 'kennels',
    loadComponent: () => import('./pages/kennel-list/kennel-list.component')
      .then(m => m.KennelListComponent),
  },
  {
    matcher: kennelPageMatcher,
    loadComponent: () => import('./pages/waves-viewer/waves-viewer.component')
      .then(m => m.WavesViewerComponent),
    // U8: brief, layout, dog code or settings unsaved -> "Unsaved changes. Leave anyway?"
    canDeactivate: [unsavedChangesGuard],
  },
  {
    // side B (P6 U5): the dog browser; a dog opens as a preview (`?dog=`), never as a page (8.21).
    path: 'dogs',
    loadComponent: () => import('./pages/dogs/dogs-browser.component')
      .then(m => m.DogsBrowserComponent),
  },
  {
    // S9 (P6 U7): profile, personal tokens, keys — `?tab=profile|tokens|keys`; signed out -> /login.
    path: 'account',
    loadComponent: () => import('./pages/account/account.component')
      .then(m => m.AccountComponent),
  },
  {
    // S10 (P6 U7): one button, one verse; `?returnTo=` a path on this site.
    path: 'login',
    loadComponent: () => import('./pages/login/login.component')
      .then(m => m.LoginComponent),
  },
  {
    path: 'kennel',
    redirectTo: 'kennels',
    pathMatch: 'full',
  },
  {
    path: 'kennel/:id',
    redirectTo: 'kennels/:id',
    pathMatch: 'full',
  },
  {
    path: 'kennel/:id/edit',
    redirectTo: 'kennels/:id/edit',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'kennels',
  },
];
