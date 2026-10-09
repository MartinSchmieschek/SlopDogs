/** Kopfzeile fuer den Referenzindex — parents als JSON-Text (Array oder String-Wert), sonst null. */
export interface ReferenceHeadRow {
  id: string;
  lineageId: string | null;
  ownerId: string | null;
  createdAt: Date | string | null;
  /** KennelConfig: die dogIds-Spalte (JSON-String). */
  dogIds?: string | null;
  /** Dogs: lineageId aus der Konfig, nur wenn dort ein String steht. */
  cfgLineageId?: string | null;
  parentsRequired?: string | null;
  parentsOptional?: string | null;
}

/** Ein Referenzziel: traegt die Zeile Kennel-Spalten, hat sie eine Konfig, welche Lineage nennt sie? */
export interface ReferenceTargetRow {
  id: string;
  lineageId: string | null;
  kennelish: boolean;
  hasConfig: boolean;
  cfgLineageId: string | null;
}

/** parentId/updatedAt sind undefined, wo formatTypeRow sie nicht zeigt (Zeile ohne Kennel-Spalten). */
export interface VersionHeaderRow {
  id: string;
  lineageId: string | null;
  parentId?: string | null;
  createdAt: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface MimicHeadRow {
  id: string;
  lineageId: string | null;
  cfgLineageId: string | null;
  imitates: string | null;
  createdAt: Date | string | null;
  visibility: string | null;
  ownerId: string | null;
  editors: string | null;
  viewers: string | null;
  runners: string | null;
  frozen: boolean;
}

/**
 * The eldritch contract of the Store — a pact sealed between our ship and the deep.
 * All who dare persist data in this realm must honour these rites.
 * Corporeal laws are unwritten as suns and love retreat;
 * yet these methods hold the line between order and the void.
 */
export interface IStore {
  /** Cast the plunder into the abyss — create or overwrite, for the store shows no mercy. */
  save(d: any): Promise<void>;

  /** Dredge a single entity from the deep by its name. Returns null if the void swallowed it. */
  load(id: string): Promise<any>;

  /** Haul up all entities of a given type — a net cast wide into brooding waters. */
  findByType(type: string): Promise<Array<{ id: string; serializedDogConfig: string }>>;

  /**
   * Dieselben Zeilen wie `findByType(type)`, aber nur die neueste Inkarnation je
   * Lineage — reduziert in der Datenbank, nicht im Heap. Fuer Listen-Endpunkte, die
   * ohnehin nur das Neueste zeigen: die ueberholten Versionen muessen dafuer nicht
   * erst durch den Prozess reisen.
   * @param type - The entity type (e.g. SerializedDog.name)
   */
  findLatestByType(type: string, search?: string, lineageIds?: string[]): Promise<Array<any>>;

  /**
   * From the many incarnations that drift through branching time, retrieve only the newest —
   * fer the past is carrion, and we hunt only what still breathes.
   * If IDs be given, each is resolved: first as a version ID (exact incarnation),
   * then as a lineageId (the latest incarnation of that lineage).
   * @param type - The entity type (e.g. SerializedDog.name)
   * @param ids - Optional crew list of IDs (version GUIDs or lineageId GUIDs).
   */
  findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<{ id: string; serializedDogConfig: string }>>;

  /**
   * Summon all incarnations of a spirit — every branch, every form, newest first by createdAt.
   * The lineageId binds them all, across branches and time.
   * @param type - The entity type
   * @param lineageId - The lineage GUID that binds all incarnations
   */
  findAllVersions(type: string, lineageId: string): Promise<Array<{ id: string; version: number; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>>;

  /**
   * Summon all incarnations that share a lineage — every branch, every form.
   * @param lineageId - The lineage GUID
   */
  findByLineageId(lineageId: string): Promise<Array<{ id: string; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>>;

  /**
   * Haul up only the incarnations of ONE lineage within a type — the narrow net.
   * Same rows as `findByType(type)` filtered on `lineageId`, but the filter rides
   * along into the query instead of dragging the whole type through the water.
   * @param type - The entity type (e.g. KennelConfig)
   * @param lineageId - The lineage GUID that binds all incarnations
   */
  findByLineage(type: string, lineageId: string): Promise<Array<any>>;

  // --- Schmale Lesewege: nur die Spalten, die der Aufrufer braucht, nie tsCode/Konfig im Ganzen ---

  /** Irgendeine Zeile des Typs (erste in DB-Reihenfolge, wie `findByType(type)[0]`) — oder null. */
  findFirstOfType(type: string): Promise<{ id: string; lineageId: string | null; serializedDogConfig: string | null } | null>;

  /**
   * Kopfzeilen fuer den Referenzindex: je Lineage die neueste (wie findLatestByType), aber nur
   * id/lineageId/ownerId/createdAt, bei Kennels dogIds, bei Dogs lineageId und parents aus der Konfig.
   */
  findReferenceHeads(type: string): Promise<ReferenceHeadRow[]>;

  /** Ein Referenzziel per PK: nur, was die Normalisierung braucht — oder null. */
  findReferenceTarget(id: string): Promise<ReferenceTargetRow | null>;

  /** Gibt es eine Zeile mit dieser lineageId? */
  lineageExists(lineageId: string): Promise<boolean>;

  /** Die Crew (dogIds) der neuesten Kennel-Version je Lineage — wie findLatestVersionsByType('KennelConfig'). */
  findLatestKennelCrews(): Promise<Array<{ dogIds: string | null; serializedDogConfig: string | null }>>;

  /**
   * Alle Versionen eines Typs, nur Kopf-Metadaten (id, lineageId, parentId, createdAt, updatedAt) — fuer eine
   * Sieger-Auswahl in JS. Mit lineageIds nur die Zeilen, deren lineageId oder id darin steht.
   */
  findVersionHeaders(type: string, lineageIds?: string[]): Promise<VersionHeaderRow[]>;

  /** Volle Zeilen per PK, in der Form von findByType. Reihenfolge nicht garantiert. */
  findRowsByIds(ids: string[]): Promise<Array<any>>;

  /**
   * Wie findLatestByType, aber ohne Konfig-Blob: id, lineageId, displayName, ACL-Spalten, createdAt. Die Konfig
   * reist nur fuer Zeilen mit, deren Spalten-Werte aus ihr ergaenzt werden (lineageId/displayName leer, ACL-Schluessel
   * im JSON) — die Ableitung bleibt so dieselbe wie bei findLatestByType.
   */
  findLatestMetaByType(type: string): Promise<Array<any>>;

  /** Die neueste Version je MimicDog-Lineage, ohne Konfig: id, Lineage, createdAt, ACL, imitates. */
  findMimicHeads(): Promise<MimicHeadRow[]>;

  /**
   * Freeze or unfreeze one row in place — no new version (P3.5, 8.25). Callers pass the
   * head version's id: the head carries the flag.
   */
  setFrozen(id: string, frozen: boolean): Promise<void>;

  /** Cast the entity overboard — gone into the void, never to be seen again. */
  delete(id: string): Promise<void>;

  /**
   * Sever the connection to the deep. Optional: nicht jeder Store haelt einen Pool.
   * Wer einen haelt, gibt ihn hier frei — der Shutdown in main.ts ruft das typsicher
   * auf, ohne sich an `as any` vorbeizumogeln.
   */
  disconnect?(): Promise<void>;
}
