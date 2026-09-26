/**
 * Laeufe, Wiederverwendung und "Bewaehrt" eines Dogs (P4b) — traegt jeder Eintrag von GET /api/nodes
 * und GET /api/nodes/:id. Fehlt bei aelteren Serverstaenden.
 */
export interface IDogStats {
  calls: {
    total: number;
    last30d: number;
    /** Nur echte Nutzung (public, execute) — die Zahl, nach der gerankt wird. */
    ranked30d: number;
    /** error + timeout + oom ueber alle Tage (fehlt bei alten Servern). */
    failures?: number;
    failures30d: number;
    cached30d: number;
    avgDurationMs: number | null;
    maxDurationMs: number;
    kennelsRun30d: number;
  };
  reuse: {
    kennelsDirect: number;
    kennelsTransitive: number;
    kennelsForeign: number;
    owners: number;
    dependents: number;
  };
  proven: { score: number; badge: boolean; reliability: number };
}

/** GET /api/nodes/:id/usage — wo der Dog laeuft; Kennels nur, die der Aufrufer ausfuehren darf. */
export interface IDogUsage {
  ok: boolean;
  dogKey: string;
  kennels: Array<{
    lineageId: string;
    name: string | null;
    visibility: string;
    ownerId: string | null;
    via: 'crew' | 'transitive';
    count30d: number;
    failures30d: number;
    /** `/k/<lineageId>` — ein Verweis, kein Teilen-Link. */
    url: string;
  }>;
  hiddenKennels: number;
  dependents: Array<{ lineageId: string; displayName: string | null; kind: 'required' | 'optional' }>;
  dependencies: { required: string[]; optional: string[] };
  byOwner: Array<{ ownerId: string | null; kennels: number }>;
}

/** Was der Aufrufer mit einem Dog darf (P3.5 `myRights`) — fehlt bei Base-Dogs und alten Servern. */
export interface IDogRights {
  run: boolean;
  read: boolean;
  edit: boolean;
  own: boolean;
  frozen: boolean;
}

export interface BaseDogInfo {
  id: string;
  name: string;
  type: 'BaseDog';
  icon?: string;
  description?: string;
  stats?: IDogStats;
  /** P6 U5: das Paket (`dogs-weather`, `core`) — fehlt bei alten Servern. */
  pack?: string;
}

export interface SerializedDogInfo {
  id: string;
  lineageId?: string;
  parentId?: string | null;
  displayName?: string;
  /** Freitext-Beschreibung des Dogs (seit list_nodes/get_node — Commit 592442c). */
  description?: string;
  type?: string;
  /**
   * Name, unter dem dieser Dog als Elternteil im VM-Kontext gebunden wird
   * (z. B. `mdReportData` -> `Mdreportdata`). Kommt vom Server; nie selbst ableiten.
   * Fehlt bei aelteren Serverstaenden und bei BaseDogs.
   */
  contextName?: string;
  /** Fehlt bei `lean=1` (P6 U5) und in der RUN-Sicht eines run-only-Dogs. */
  theRun?: string;
  /** RUN-Sicht (P6 U5): Version des Kopfes (aelteste = 1) — darauf pinnt `[USE IN KENNEL]`. */
  version?: number;
  icon?: string;
  parentsRequired?: string[];
  parentsOptional?: string[];
  stats?: IDogStats;
  /** MimicDog: der Pakt, den er erfuellt. */
  imitates?: string | null;
  visibility?: 'public' | 'run-only' | 'private' | null;
  ownerId?: string | null;
  frozen?: boolean;
  myRights?: IDogRights;
}

export type DogInfo = BaseDogInfo | SerializedDogInfo;

export function isBaseDog(dog: DogInfo): dog is BaseDogInfo {
  return (dog as BaseDogInfo).type === 'BaseDog';
}
