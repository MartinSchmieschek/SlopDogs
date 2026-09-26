import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { IAclUpdate, IAclView, IAclPerson } from '../models/user.model';

/** Kennel or dog: the ACL routes take the REST subpath. */
export type AclEntity = 'kennel' | 'node';

const SUBPATH: Record<AclEntity, string> = { kennel: 'kennels', node: 'nodes' };

/**
 * Access (P3.5 3.5.6, P6 U6) over REST: `GET/PUT /api/:sub/:id/acl`, `POST …/acl/transfer`,
 * `POST …/freeze|unfreeze`. Cookie session authenticates. Releasing ownership has no REST route —
 * it goes through the `/actions/release_ownership` tool bridge, like MCP.
 */
@Injectable({ providedIn: 'root' })
export class AclService {
  private readonly http = inject(HttpClient);

  private base(entity: AclEntity, id: string): string {
    return `/api/${SUBPATH[entity]}/${encodeURIComponent(id)}`;
  }

  get(entity: AclEntity, id: string): Observable<IAclView> {
    return this.http.get<IAclView>(`${this.base(entity, id)}/acl`);
  }

  update(entity: AclEntity, id: string, patch: IAclUpdate): Observable<IAclView> {
    return this.http.put<IAclView>(`${this.base(entity, id)}/acl`, patch);
  }

  /** The new owner may be an email or a user id. */
  transfer(entity: AclEntity, id: string, toUser: string): Observable<{ ok: true; owner?: IAclPerson }> {
    return this.http.post<{ ok: true; owner?: IAclPerson }>(`${this.base(entity, id)}/acl/transfer`, { toUserId: toUser });
  }

  freeze(entity: AclEntity, id: string): Observable<{ ok: true; frozen: boolean }> {
    return this.http.post<{ ok: true; frozen: boolean }>(`${this.base(entity, id)}/freeze`, {});
  }

  unfreeze(entity: AclEntity, id: string): Observable<{ ok: true; frozen: boolean }> {
    return this.http.post<{ ok: true; frozen: boolean }>(`${this.base(entity, id)}/unfreeze`, {});
  }

  /** Back to community (no owner). The tool bridge answers 200 with `{ error }` when it refuses. */
  release(entity: AclEntity, id: string): Observable<{ result?: { action?: string }; error?: unknown }> {
    return this.http.post<{ result?: { action?: string }; error?: unknown }>('/actions/release_ownership', { entity_type: entity, id });
  }
}
