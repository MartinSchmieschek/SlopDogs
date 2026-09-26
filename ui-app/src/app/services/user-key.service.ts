import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { IUserKey, IUserKeyInput } from '../models/user-key.model';

/**
 * Key-Store (P4c) gegen /api/keys — Cookie-Session, nur die eigenen Keys, nie ein Klartext zurueck.
 * 503 `keystore_disabled`: der Server hat keinen Master-Key. Flaeche in P6 (U7).
 */
@Injectable({ providedIn: 'root' })
export class UserKeyService {
  private http = inject(HttpClient);
  private baseUrl = '/api/keys';

  list(): Observable<{ ok: true; keys: IUserKey[] }> {
    return this.http.get<{ ok: true; keys: IUserKey[] }>(this.baseUrl);
  }

  /** Anlegen oder ersetzen; die Antwort traegt die maskierte Sicht. */
  set(input: IUserKeyInput): Observable<{ ok: true; key: IUserKey }> {
    return this.http.post<{ ok: true; key: IUserKey }>(this.baseUrl, input);
  }

  remove(alias: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.baseUrl}/${encodeURIComponent(alias)}`);
  }
}
