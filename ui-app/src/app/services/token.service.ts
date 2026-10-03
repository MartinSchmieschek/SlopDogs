import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type PersonalTokenStatus = 'active' | 'revoked' | 'expired';

/** One recorded use of a token — the newest-first ring buffer the server keeps per token. */
export interface IPersonalTokenCall {
  at: string;
  method: string;
  path: string;
}

/** A personal access token as the list shows it — never its value. */
export interface IPersonalToken {
  jti: string;
  name: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  status: PersonalTokenStatus;
  lastUsedAt: string | null;
  useCount: number;
  calls: IPersonalTokenCall[];
}

/** A fresh token: the value comes exactly once, in this answer. */
export interface INewPersonalToken extends IPersonalToken {
  jwt: string;
}

const JSON_ONLY = { headers: new HttpHeaders({ Accept: 'application/json' }) };

/**
 * Personal access tokens (P6 U7) — the JSON face of `/auth/tokens` (same routes, `Accept:
 * application/json`; the server HTML stays as the fallback). Cookie session only.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly http = inject(HttpClient);

  list(): Observable<{ ok: true; tokens: IPersonalToken[] }> {
    return this.http.get<{ ok: true; tokens: IPersonalToken[] }>('/auth/tokens', JSON_ONLY);
  }

  create(name?: string): Observable<{ ok: true; token: INewPersonalToken }> {
    const body = name && name.trim() ? { name: name.trim() } : {};
    return this.http.post<{ ok: true; token: INewPersonalToken }>('/auth/tokens', body, JSON_ONLY);
  }

  revoke(jti: string): Observable<{ ok: true; jti: string; status: PersonalTokenStatus }> {
    return this.http.post<{ ok: true; jti: string; status: PersonalTokenStatus }>(
      `/auth/tokens/${encodeURIComponent(jti)}/revoke`, {}, JSON_ONLY);
  }
}
