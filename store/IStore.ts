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
  findLatestByType(type: string): Promise<Array<any>>;

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
