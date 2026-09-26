export interface IKennelConfig {
  id: string;
  /** The stable kennel identifier — stays the same across all versions */
  lineageId?: string;
  /** The ancestor version from which this version was born */
  parentId?: string | null;
  name?: string;
  description?: string;
  /** Ein Emoji (optional), in der DB mitgespeichert */
  emoji?: string;
  dogIds: string[];
  defaultQuery?: Record<string, string>;
  defaultBody?: any;
  /** Global mission briefing -- what the kennel is supposed to do */
  task?: string;
  /** Per-node layout + comment for the wave-view canvas */
  nodes?: IKennelNodeAnnotation[];
  /** Per-edge comment, keyed by (fromId, toId) */
  edges?: IKennelEdgeAnnotation[];
  /** ACL (P3.5) — public: anyone runs and reads; run-only: anyone runs, code stays private; private: named people only. */
  visibility?: KennelVisibility | null;
  /** P3.5 (8.16/8.25): frozen blocks every edit until the owner unfreezes; runs, ratings and copies keep working. */
  frozen?: boolean;
  /** P3.5: what the caller may do with this kennel — missing on a server before P3.5. */
  myRights?: IMyRights;
  /** User.id of the creator. null = community-owned (legacy / system). */
  ownerId?: string | null;
  /** Comma-separated User.id list — additional users who may mutate. */
  editors?: string | null;
  /** Comma-separated User.id list — additional users who may read on private entities. */
  viewers?: string | null;
  createdAt?: string;
  updatedAt?: string;
  /** Aufrufe und Sterne (P4) — fehlt bei einem Server vor P4. */
  stats?: IKennelStats;
}

export type KennelVisibility = 'public' | 'run-only' | 'private';

/** Rights of the caller on one entity (`myRights`, P3.5 — mcp/auth/visibility.ts `MyRights`). */
export interface IMyRights {
  run: boolean;
  read: boolean;
  edit: boolean;
  own: boolean;
  frozen: boolean;
  /**
   * Server-side write lock beyond `frozen`. `'landing'`: the kennel is listed in the server's
   * LANDING_KENNEL_IDS — `edit`/`own` are false for everyone including owner and superuser, but
   * runs, ratings, reads and copies stay open. `'frozen'` mirrors the `frozen` flag. `null`/missing:
   * unlocked (or a server before this field existed).
   */
  locked?: 'landing' | 'frozen' | null;
}

/**
 * Aufrufe und Sterne eines Kennels (P4). Sichtbare Zahl ist `calls.ranked30d` (W3); `ranked*` zaehlt
 * nur echte Nutzung (/k/:id, execute). `rating.avg` ist null ohne Bewertung, `score` der Bayes-Rang.
 */
export interface IKennelStats {
  /** leadFailed30d: Laeufe mit gescheitertem Lead in den letzten 30 Tagen (fehlt bei alten Servern). */
  calls: { total: number; last30d: number; leadFailed: number; leadFailed30d?: number; ranked: number; ranked30d: number };
  rating: { avg: number | null; count: number; score: number };
}

export interface IKennelNodeAnnotation {
  /** Kennel-dogIds entry (lineageId for SerializedDogs, "base:Name" for base-dogs) */
  id: string;
  x?: number;
  y?: number;
  comment?: string;
}

export interface IKennelEdgeAnnotation {
  fromId: string;
  toId: string;
  comment?: string;
}

export interface KennelVersionEntry {
  id: string;
  version: number;
  parentId?: string | null;
  createdAt?: string;
  config: IKennelConfig;
}
