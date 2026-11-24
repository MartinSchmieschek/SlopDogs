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
  /** List entries only: the signed-in caller marked this kennel as a favorite (anonymous: always false). */
  favorite?: boolean;
  /**
   * Result cache of the lead result (owner only): 0 = off, seconds, or 'unendlich' (until a dog, the kennel or the
   * server changes). Missing on a server before the result cache (0.4.0).
   */
  resultCacheTtl?: KennelResultCacheTtl;
}

export type KennelResultCacheTtl = number | 'unendlich';

/** How cacheable a kennel's crew is (strictest dog wins): rein < fluechtig < persoenlich < live. */
export type KennelCacheClass = 'rein' | 'fluechtig' | 'persoenlich' | 'live';

/** GET /api/kennels/:id/result-cache (0.4.0) — the settings' "Result cache" section. */
export interface KennelResultCacheInfo {
  ok: boolean;
  resultCacheTtl: KennelResultCacheTtl;
  cacheClass: {
    klasse: KennelCacheClass;
    /** Strictest first, "dog: class (detail)"; the detail is hidden for dogs the caller may not read. */
    gruende: string[];
    /** Allowed resultCacheTtl values for this class: '0', '1..N seconds', 'unendlich'. */
    erlaubt: string[];
    /** Set when the stored TTL no longer fits the crew: the kennel does not cache. */
    ruht?: string;
    /** Owner only: why the last run of this version was not cached. */
    herabgestuft?: string;
    /** Owner only: a hint from the call statistics. */
    hinweis?: string;
  };
  /** Only the owner may change the TTL. */
  canChange: boolean;
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
  calls: {
    total: number;
    last30d: number;
    leadFailed: number;
    leadFailed30d?: number;
    ranked: number;
    ranked30d: number;
    /** Calls of the last 30 days answered by the result cache (missing on servers before 0.4.0). */
    cached30d?: number;
  };
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
