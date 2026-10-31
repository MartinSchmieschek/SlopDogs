import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** `GET /api/kennel-list` (Spur K): does the server deliver `/kennels` as the kennel `slopdogs-kennels` right now? */
interface KennelListStatus {
  ok: boolean;
  active: boolean;
  kennelId?: string;
}

/**
 * The kennel list is a kennel on the server (Spur K). This service asks the server whether that page is up,
 * so in-app links to `/kennels` can become a full page load — and only then: when the kennel fails, the server
 * answers `/kennels` with this Angular list, and the app must stay here instead of reloading in a circle.
 */
@Injectable({ providedIn: 'root' })
export class KennelListPageService {
  private readonly http = inject(HttpClient);
  private cached: { at: number; active: boolean } | null = null;
  private pending: Promise<boolean> | null = null;
  /** The answer holds this long; a failing kennel turns inactive on the server within one run. */
  static readonly TTL_MS = 30_000;

  /** True when `/kennels` is served by the kennel; false on any doubt (error, old server, switched off). */
  active(): Promise<boolean> {
    if (this.cached && Date.now() - this.cached.at < KennelListPageService.TTL_MS) return Promise.resolve(this.cached.active);
    this.pending ??= firstValueFrom(this.http.get<KennelListStatus>('/api/kennel-list'))
      .then((res) => res?.ok === true && res.active === true)
      .catch(() => false)
      .then((active) => {
        this.cached = { at: Date.now(), active };
        this.pending = null;
        return active;
      });
    return this.pending;
  }
}
