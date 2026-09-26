import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

/** GET /api/beta — the stage (SLOPDOGS_STAGE), do accounts need a beta key, may I manage keys? */
export interface IBetaStatus {
  stage: string | null;
  keysRequired: boolean;
  admin: boolean;
}

/** A beta key as the list shows it: never its value, only the last four characters. */
export interface IBetaKey {
  id: string;
  last4: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  revokedAt: string | null;
  usedAt: string | null;
  usedBy: string | null;
  state: 'open' | 'used' | 'revoked';
}

/**
 * Closed beta (SLOPDOGS_STAGE=beta with auth on): every Google account is unlocked once with a key — one key, one
 * account, no expiry. The status is loaded once per page load and read by the login page (asks for a key) and the
 * account page (the beta tab for admins).
 */
@Injectable({ providedIn: 'root' })
export class BetaService {
  private http = inject(HttpClient);
  private readonly _status = signal<IBetaStatus | null>(null);
  private loading: Promise<void> | null = null;

  /** null until loaded; a failed load counts as "no keys, no admin". */
  readonly status = this._status.asReadonly();

  load(): Promise<void> {
    this.loading ??= firstValueFrom(this.http.get<IBetaStatus>('/api/beta'))
      .then((s) => this._status.set({ stage: s?.stage ?? null, keysRequired: !!s?.keysRequired, admin: !!s?.admin }))
      .catch(() => this._status.set({ stage: null, keysRequired: false, admin: false }));
    return this.loading;
  }

  list(): Observable<{ ok: true; keys: IBetaKey[] }> {
    return this.http.get<{ ok: true; keys: IBetaKey[] }>('/api/beta/keys');
  }

  /** The value comes back here, once. */
  create(input: { note?: string }): Observable<{ ok: true; code: string; key: IBetaKey }> {
    return this.http.post<{ ok: true; code: string; key: IBetaKey }>('/api/beta/keys', input);
  }

  revoke(id: string): Observable<{ ok: true; key: IBetaKey }> {
    return this.http.delete<{ ok: true; key: IBetaKey }>(`/api/beta/keys/${encodeURIComponent(id)}`);
  }
}
