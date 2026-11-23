import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Which page: `landing` is `/`, `list` is `/kennels`. */
export type MyPageKind = 'landing' | 'list';

/** Your own pages: a kennel id (lineage) per kind, null where the default shows. */
export interface IMyPages {
  landing: string | null;
  list: string | null;
}

/**
 * Your pages against `/api/my-pages` — cookie session, only your own. Signed in with a page set, the server
 * answers `/` and `/kennels` with a redirect to `/k/<id>`; signed out, or without a setting, the default.
 * Errors come as `{ error, error_description }` (404 `kennel_not_found`, 400 `kennel_has_no_dogs`, 503).
 */
@Injectable({ providedIn: 'root' })
export class MyPagesService {
  private http = inject(HttpClient);
  private baseUrl = '/api/my-pages';

  get(): Observable<{ ok: true } & IMyPages> {
    return this.http.get<{ ok: true } & IMyPages>(this.baseUrl);
  }

  /** Only the kinds you pass change; null resets that page to the default. */
  set(changes: Partial<IMyPages>): Observable<{ ok: true } & IMyPages> {
    return this.http.put<{ ok: true } & IMyPages>(this.baseUrl, changes);
  }
}
