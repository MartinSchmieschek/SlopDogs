import type { IMyRights, KennelVisibility } from './kennel-config.model';

export interface IUser {
  id: string;
  email: string;
  name: string | null;
  picture?: string | null;
}

export interface IAuthState {
  authenticated: boolean;
  user?: IUser;
}

/** The four roles of the access panel (P3.5, 6.4 S8). `reader` is the UI name of `viewers[]`. */
export type AclRole = 'owner' | 'editor' | 'reader' | 'runner';

/** Which ACL list a non-owner role lives in (`PUT /api/:sub/:id/acl`). */
export const ACL_LIST_OF: Record<Exclude<AclRole, 'owner'>, 'editors' | 'viewers' | 'runners'> = {
  editor: 'editors',
  reader: 'viewers',
  runner: 'runners',
};

/** A person as the ACL view resolves them; email and name are null for an id the server doesn't know. */
export interface IAclPerson {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * `GET /api/:sub/:id/acl` (P3.5 3.5.6) — only the owner, editors and the super-user get it; everyone
 * else gets 404. `people` resolves every id in the lists (P6 U6).
 */
export interface IAclView {
  ok: true;
  visibility: KennelVisibility;
  ownerId: string | null;
  editors: string[];
  viewers: string[];
  runners: string[];
  frozen: boolean;
  myRights: IMyRights;
  people?: IAclPerson[];
}

/** `PUT /api/:sub/:id/acl` — each list may carry user ids or emails; the server stores ids. */
export interface IAclUpdate {
  visibility?: KennelVisibility;
  editors?: string[];
  viewers?: string[];
  runners?: string[];
}
