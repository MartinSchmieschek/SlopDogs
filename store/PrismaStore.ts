// The PrismaStore — our ship's hold, where all plundered data is locked away in the eldritch deep.
// Carrion hordes trill their profane accord with eldritch plans:
// this class is the sole keeper of persistence, and it answers to no one but Prisma.
// Now the lineage branches like cursed coral — lineageId binds incarnations, parentId traces ancestry.
import { PrismaClient, Prisma } from '@prisma/client';
import { IStore } from './IStore';
import {
  IKennelStatsStore,
  IDogStatsStore,
  RANKED_CALL_SOURCES,
  type DogCallAggregate,
  type DogCallDelta,
  type DogKennelUsage,
  type DogReferenceFromKind,
  type DogReferenceRow,
  type KennelCallAggregate,
  type KennelCallDelta,
  type KennelRatingAggregate,
  type KennelRatingHistogram,
} from './IKennelStatsStore';
import path from 'path';

export class PrismaStore implements IStore, IKennelStatsStore, IDogStatsStore {
  private prisma: PrismaClient;
  /** Postgres oder SQLite — aus der URL wie scripts/dbEnv.cjs. Nur die MAX/GREATEST-Weiche (P4b) braucht es. */
  private readonly isPostgres: boolean;

  /**
   * Provision the store with a connection string — or let the env scroll speak for itself.
   * Without a connectionString, Prisma reads DATABASE_URL from the void.
   */
  constructor(connectionString?: string) {
    this.isPostgres = /^postgres(ql)?:/i.test((connectionString ?? process.env.DATABASE_URL ?? '').trim());
    if (connectionString) {
      this.prisma = new PrismaClient({ datasources: { db: { url: connectionString } } } as any);
    } else {
      this.prisma = new PrismaClient();
    }
  }

  public async init(): Promise<void> {
    // Migrations must be run outside this ship — we merely test the anchor holds fast.
    // Roiling, moaning: if the connection fails here, all is lost before the hunt begins.
    await this.prisma.$connect();
    try {
      await this.prisma.dog.findFirst({ take: 1 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
        const nodeEnv = (process.env.NODE_ENV || '').trim();
        const syncHint =
          nodeEnv === 'integration'
            ? 'npm run prisma:sync:integration'
            : nodeEnv === 'production'
              ? 'npm run prisma:sync:prod'
              : 'npm run prisma:sync';
        throw new Error(
          `[PrismaStore] Datenbank-Schema fehlt (Tabelle Dog nicht gefunden). ` +
            `Zuerst ${syncHint} ausfuehren, um Tabellen anzulegen. ` +
            `Bei gehosteter Postgres: DB-User braucht Rechte fuer CREATE/Schema. ` +
            `(${e.message})`,
        );
      }
      throw e;
    }
  }

  public async save(d: any): Promise<void> {
    // Name the plunder — if no ID is given, stamp it with the current timestamp like a dead man's mark.
    const id = d?.id ?? Date.now().toString();
    const type = d?.type ?? (d?.constructor?.name ?? 'unknown');

    // Assemble the cargo manifest — only fields that exist may be loaded.
    const updateData: any = {
      id,
      type
    };

    // The spirit's lineage marks — lineageId, parentId, displayName sail as direct columns.
    if (d.lineageId !== undefined) updateData.lineageId = d.lineageId;
    if (d.parentId !== undefined) updateData.parentId = d.parentId;
    if (d.displayName !== undefined) updateData.displayName = d.displayName;

    // SerializedDog carries its soul in serializedDogConfig — string or object, we accept both forms.
    if (d.serializedDogConfig !== undefined) {
      updateData.serializedDogConfig = typeof d.serializedDogConfig === 'string'
        ? d.serializedDogConfig
        : JSON.stringify(d.serializedDogConfig);
    }

    // KennelConfig fields sail as direct columns — name, description, emoji, the lot.
    if (d.name !== undefined) updateData.name = d.name;
    if (d.description !== undefined) updateData.description = d.description;
    // dogIds cannot survive as an array in SQLite's hold — bind them as a JSON-string.
    if (d.dogIds !== undefined) {
      updateData.dogIds = JSON.stringify(d.dogIds);
    }
    if (d.defaultQuery !== undefined) {
      updateData.defaultQuery = typeof d.defaultQuery === 'string'
        ? d.defaultQuery
        : JSON.stringify(d.defaultQuery);
    }
    if (d.defaultBody !== undefined) {
      updateData.defaultBody = typeof d.defaultBody === 'string'
        ? d.defaultBody
        : JSON.stringify(d.defaultBody);
    }
    if (d.emoji !== undefined) updateData.emoji = d.emoji;
    if (d.task !== undefined) updateData.task = d.task;
    if (d.nodes !== undefined) {
      updateData.nodes = typeof d.nodes === 'string'
        ? d.nodes
        : JSON.stringify(d.nodes);
    }
    if (d.edges !== undefined) {
      updateData.edges = typeof d.edges === 'string'
        ? d.edges
        : JSON.stringify(d.edges);
    }
    if (d.visibility !== undefined) updateData.visibility = d.visibility;
    if (d.ownerId !== undefined) updateData.ownerId = d.ownerId;
    if (d.editors !== undefined) {
      updateData.editors = Array.isArray(d.editors)
        ? (d.editors.length ? d.editors.join(',') : null)
        : d.editors;
    }
    if (d.viewers !== undefined) {
      updateData.viewers = Array.isArray(d.viewers)
        ? (d.viewers.length ? d.viewers.join(',') : null)
        : d.viewers;
    }
    if (d.runners !== undefined) {
      updateData.runners = Array.isArray(d.runners)
        ? (d.runners.length ? d.runners.join(',') : null)
        : d.runners;
    }
    if (d.frozen !== undefined) updateData.frozen = Boolean(d.frozen);
    if (d.createdAt !== undefined) updateData.createdAt = d.createdAt;
    if (d.updatedAt !== undefined) updateData.updatedAt = d.updatedAt;

    // Upsert: create or overwrite — the void shows no mercy to duplicates.
    await this.prisma.dog.upsert({
      where: { id },
      create: updateData,
      update: updateData
    });
  }

  public async load(id: string): Promise<any> {
    const row: any = await this.prisma.dog.findUnique({ where: { id } });
    if (!row) return null;

    // A KennelConfig reveals itself by its named fields — name, description, dogIds, or emoji shall betray it.
    // From brooding gulfs are we beheld: the type is inferred from what the row holds.
    if (row.name !== null || row.description !== null || row.dogIds !== null || row.emoji !== null
        || row.task !== null || row.nodes !== null || row.edges !== null) {
      return {
        id: row.id,
        type: row.type,
        name: row.name,
        description: row.description,
        dogIds: row.dogIds, // Still a JSON-string — parseEntity() shall untangle it.
        defaultQuery: row.defaultQuery,
        defaultBody: row.defaultBody,
        emoji: row.emoji,
        task: row.task,
        nodes: row.nodes,
        edges: row.edges,
        visibility: row.visibility,
        ownerId: row.ownerId,
        editors: row.editors,
        viewers: row.viewers,
        runners: row.runners,
        frozen: Boolean(row.frozen),
        lineageId: row.lineageId,
        parentId: row.parentId,
        displayName: row.displayName,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        serializedDogConfig: row.serializedDogConfig
      };
    }

    // A SerializedDog is but its soul — return only the config string and let it sail free.
    return row.serializedDogConfig;
  }

  public async findByType(type: string): Promise<Array<any>> {
    const rows = await this.prisma.dog.findMany({ where: { type } });
    // Always return the full row — the id must survive for version tracking purposes.
    // In luminous space, the id is the star by which we navigate the dark.
    return rows.map((r: any) => this.formatTypeRow(r));
  }

  /**
   * Haul up only the NEWEST incarnation per lineage within a type — the reduction
   * happens in der Datenbank, nicht im Heap.
   *
   * `findByType` zieht die gesamte Typ-Partition inklusive aller ueberholten Versionen
   * durch den Prozess; der Aufrufer wirft sie danach weg. Bei einer Tabelle, die durch
   * die Versionierung monoton waechst, ist das der teuerste Weg zum kleinsten Ergebnis.
   *
   * `ORDER BY ("createdAt" IS NULL), …` statt `NULLS LAST`: createdAt ist nullable, und
   * `NULLS LAST` ist zwischen Postgres und SQLite nicht verlaesslich portabel. Der
   * Boolean-Ausdruck ist es (false/0 vor true/1) — Zeilen mit createdAt gewinnen also
   * immer gegen Zeilen ohne. `"id" DESC` bricht Gleichstand stabil.
   *
   * Die Zeilen laufen durch DENSELBEN Mapper wie findByType — die Rueckgabeform ist
   * ununterscheidbar. Die Fenster-Spalte `rn` faellt dabei heraus.
   */
  public async findLatestByType(type: string): Promise<Array<any>> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (
          PARTITION BY COALESCE("lineageId", "id")
          ORDER BY ("createdAt" IS NULL), "createdAt" DESC, "id" DESC
        ) AS rn
        FROM "Dog" WHERE "type" = ${type}
      ) t WHERE rn = 1
    `);
    return rows.map((r: any) => this.formatTypeRow(r));
  }

  /**
   * Haul up only the incarnations of ONE lineage within a type.
   * Formt die Zeilen mit GENAU demselben Mapper wie findByType — fuer den Aufrufer
   * ist das Ergebnis ununterscheidbar von `findByType(type)` mit anschliessendem
   * JS-Filter auf lineageId. Nur zieht diese Variante den Rest der Tabelle gar
   * nicht erst ueber die Leitung (getragen von @@index([lineageId])).
   */
  public async findByLineage(type: string, lineageId: string): Promise<Array<any>> {
    const rows = await this.prisma.dog.findMany({ where: { type, lineageId } });
    return rows.map((r: any) => this.formatTypeRow(r));
  }

  /**
   * Formt eine rohe Dog-Zeile fuer die Typ-Abfragen. KennelConfig und SerializedDog
   * tragen bewusst unterschiedliche Schnitte — der Schnitt gehoert an EINE Stelle.
   */
  private formatTypeRow(r: any): any {
    // KennelConfig betrays itself with name, description, dogIds, or emoji.
    if (r.name !== null || r.description !== null || r.dogIds !== null || r.emoji !== null
        || r.task !== null || r.nodes !== null || r.edges !== null) {
      return {
        id: r.id,
        type: r.type,
        name: r.name,
        description: r.description,
        dogIds: r.dogIds,
        defaultQuery: r.defaultQuery,
        defaultBody: r.defaultBody,
        emoji: r.emoji,
        task: r.task,
        nodes: r.nodes,
        edges: r.edges,
        visibility: r.visibility,
        ownerId: r.ownerId,
        editors: r.editors,
        viewers: r.viewers,
        runners: r.runners,
        // $queryRaw liefert SQLite-Booleans als 0/1 — Boolean() macht beide Wege gleich.
        frozen: Boolean(r.frozen),
        lineageId: r.lineageId,
        parentId: r.parentId,
        displayName: r.displayName,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        serializedDogConfig: r.serializedDogConfig
      };
    }
    // SerializedDog returns its id, lineage marks, and its soul —
    // PLUS the ACL columns. SECURITY (2026-09-13): these were previously
    // omitted, so listLatest() saw visibility===undefined for every dog and
    // effectiveVisibility's fail-open treated them all as public. Result:
    // GET /api/nodes handed every private dog's full tsCode to anonymous
    // callers, even though the single-fetch (getById -> findLatestVersionsByType,
    // which carries these columns) correctly 404'd. The ACL must ride along here
    // so filterReadable can actually filter.
    return {
      id: r.id,
      lineageId: r.lineageId,
      parentId: r.parentId,
      displayName: r.displayName,
      visibility: r.visibility,
      ownerId: r.ownerId,
      editors: r.editors,
      viewers: r.viewers,
      runners: r.runners,
      frozen: Boolean(r.frozen),
      createdAt: r.createdAt,
      serializedDogConfig: r.serializedDogConfig
    };
  }

  /**
   * From the many incarnations that drift through branching time, retrieve only the newest.
   * If IDs be given, each is resolved: first as a version ID (exact incarnation),
   * then as a lineageId (latest incarnation of that lineage by createdAt).
   * If no IDs be given, the latest incarnation of every lineage surfaces.
   */
  public async findLatestVersionsByType(type: string, ids?: string[]): Promise<Array<any>> {
    // Sind IDs gefragt, schneidet schon SQL die Kandidaten zu: jede angefragte ID kann
    // nur als Version-GUID, als lineageId oder als displayName treffen — mehr braucht die
    // Aufloesung unten nicht. Die Rangfolge (exact id > lineageId > displayName) und die
    // createdAt-Sortierung bleiben unveraendert in JS; sie sehen dieselben Zeilen wie zuvor,
    // nur ohne den Rest des Typs im Schlepptau. Ohne IDs wird die volle Typ-Menge gebraucht.
    const rows = ids && ids.length > 0
      ? await this.findCandidatesForIds(type, ids)
      : await this.prisma.dog.findMany({ where: { type } });

    // No specific IDs — surface the newest incarnation of every lineage.
    if (!ids || ids.length === 0) {
      return this.getLatestVersionsForAll(rows);
    }

    const result: Array<any> = [];

    for (const requestedId of ids) {
      // First: try exact match by version ID — the spirit's unique incarnation.
      const exactMatch = rows.find((r: any) => r.id === requestedId);
      if (exactMatch) {
        result.push(this.formatRow(exactMatch));
        continue;
      }

      // Second: treat as lineageId — summon the latest incarnation of that lineage.
      const lineageRows = rows
        .filter((r: any) => r.lineageId === requestedId)
        .sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime; // Newest first — the past is carrion.
        });

      if (lineageRows.length > 0) {
        result.push(this.formatRow(lineageRows[0]));
        continue;
      }

      // Third: treat as displayName — fer auto-mimics and other spirits known by name, not GUID.
      const nameRows = rows
        .filter((r: any) => r.displayName === requestedId)
        .sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      if (nameRows.length > 0) {
        result.push(this.formatRow(nameRows[0]));
      }
    }

    return result;
  }

  /**
   * Holt die Kandidaten-Zeilen fuer eine ID-Aufloesung — auf zwei indizierten Wegen
   * statt in EINEM OR ueber drei Spalten.
   *
   * Grund: `displayName` traegt keinen Index. Eine unindizierte Spalte im OR kostet
   * den ganzen Scan — der Planer kann die Typ-Partition nicht mehr ueber id/lineageId
   * verengen, sondern muss jede Zeile des Typs materialisieren, jede mit ihrem vollen
   * TS-Blob im Schlepptau. Deshalb laeuft zuerst nur der indizierte Weg
   * (`id` = Primary Key, `lineageId` = @@index), und der displayName-Fallback wird
   * erst gezogen, wenn dabei fuer eine angefragte ID nichts gefunden wurde. Laut
   * AISkill.md ist displayName ausdruecklich nur ein Fallback fuer BaseDogs — der
   * Normalfall ist also, dass die zweite Abfrage komplett entfaellt.
   *
   * Die Kandidatenmenge bleibt dabei vollstaendig: eine Zeile, die nur ueber ihren
   * displayName zu einer angefragten ID passt, wird nur dann gebraucht, wenn dieselbe
   * ID weder als `id` noch als `lineageId` getroffen hat — genau der Rest, den die
   * zweite Abfrage holt. Rangfolge und Sortierung bleiben unveraendert in JS.
   */
  private async findCandidatesForIds(type: string, ids: string[]): Promise<any[]> {
    const indexedRows = await this.prisma.dog.findMany({
      where: { type, OR: [{ id: { in: ids } }, { lineageId: { in: ids } }] },
    });

    const resolved = new Set<string>();
    for (const row of indexedRows) {
      resolved.add(row.id);
      if (row.lineageId) resolved.add(row.lineageId);
    }

    const unresolved = ids.filter(id => !resolved.has(id));
    if (unresolved.length === 0) {
      return indexedRows;
    }

    const fallbackRows = await this.prisma.dog.findMany({
      where: { type, displayName: { in: unresolved } },
    });

    // Zusammenfuehren ohne Dubletten — eine Zeile kann beide Wege bedienen.
    const seenIds = new Set<string>(indexedRows.map((r: any) => r.id));
    return indexedRows.concat(fallbackRows.filter((r: any) => !seenIds.has(r.id)));
  }

  /**
   * Sift through all rows and keep only the newest incarnation of each lineage.
   * Roiling, moaning: many incarnations lurk in the deep — only the strongest survives.
   * Groups by lineageId; fer rows without lineageId, each stands alone.
   */
  private getLatestVersionsForAll(rows: any[]): Array<{ id: string; serializedDogConfig: string }> {
    const latestByLineageId = new Map<string, any>();

    rows.forEach((r: any) => {
      // Resolve lineageId: DB column first, then fall back to parsing the serialized config.
      let lineageId = r.lineageId;
      if (!lineageId && r.serializedDogConfig) {
        try {
          const cfg = typeof r.serializedDogConfig === 'string'
            ? JSON.parse(r.serializedDogConfig) : r.serializedDogConfig;
          lineageId = cfg.lineageId;
        } catch { /* void swallowed the config */ }
      }
      const groupKey = lineageId || r.id;
      const existing = latestByLineageId.get(groupKey);
      const rTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;

      if (!existing) {
        latestByLineageId.set(groupKey, r);
      } else {
        const existingTime = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
        if (rTime > existingTime) {
          latestByLineageId.set(groupKey, r);
        }
      }
    });

    return Array.from(latestByLineageId.values()).map((r: any) => this.formatRow(r));
  }

  /**
   * Format a row fer the surface world — strip the barnacles and expose the cargo.
   */
  private formatRow(r: any): any {
    return {
      id: r.id,
      type: r.type,
      lineageId: r.lineageId ?? null,
      parentId: r.parentId ?? null,
      displayName: r.displayName ?? null,
      name: r.name ?? null,
      description: r.description ?? null,
      dogIds: r.dogIds ?? null,
      defaultQuery: r.defaultQuery ?? null,
      defaultBody: r.defaultBody ?? null,
      emoji: r.emoji ?? null,
      task: r.task ?? null,
      nodes: r.nodes ?? null,
      edges: r.edges ?? null,
      visibility: r.visibility ?? null,
      ownerId: r.ownerId ?? null,
      editors: r.editors ?? null,
      viewers: r.viewers ?? null,
      runners: r.runners ?? null,
      frozen: Boolean(r.frozen),
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
      serializedDogConfig: r.serializedDogConfig
    };
  }

  /**
   * Summon all incarnations of a spirit — every branch, every form, newest first by createdAt.
   * The lineageId binds them all, across branches and time.
   */
  public async findAllVersions(
    type: string,
    lineageId: string
  ): Promise<Array<{ id: string; version: number; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>> {
    // lineageId is unique across types — no type filter needed, so MimicDog versions are found too.
    const rows = await this.prisma.dog.findMany({ where: { lineageId } });

    // Sort by createdAt — newest incarnation first, the past sinks into the deep.
    return rows
      .map((r: any) => {
        let version = 0;
        try {
          const config = typeof r.serializedDogConfig === 'string'
            ? JSON.parse(r.serializedDogConfig)
            : r.serializedDogConfig;
          version = config.version || 0;
        } catch { /* If the config is lost to the void, version stays 0. */ }
        return {
          id: r.id,
          version,
          serializedDogConfig: r.serializedDogConfig,
          parentId: r.parentId ?? null,
          createdAt: r.createdAt ?? null,
          displayName: r.displayName ?? null,
          lineageId: r.lineageId ?? null,
          // Kennel-specific fields (null for SerializedDogs, populated for KennelConfigs)
          name: r.name ?? null,
          description: r.description ?? null,
          dogIds: r.dogIds ?? null,
          defaultQuery: r.defaultQuery ?? null,
          defaultBody: r.defaultBody ?? null,
          emoji: r.emoji ?? null,
          task: r.task ?? null,
          nodes: r.nodes ?? null,
          edges: r.edges ?? null,
          visibility: r.visibility ?? null,
          ownerId: r.ownerId ?? null,
          editors: r.editors ?? null,
          viewers: r.viewers ?? null,
          runners: r.runners ?? null,
          frozen: Boolean(r.frozen),
          updatedAt: r.updatedAt ?? null,
        };
      })
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  /**
   * Summon all incarnations that share a lineage — every branch, every form.
   * Arr, the lineageId be the thread that binds them across time and branches.
   */
  public async findByLineageId(
    lineageId: string
  ): Promise<Array<{ id: string; serializedDogConfig: string; parentId?: string | null; createdAt?: Date }>> {
    const rows = await this.prisma.dog.findMany({ where: { lineageId } });

    return rows
      .map((r: any) => ({
        id: r.id,
        serializedDogConfig: r.serializedDogConfig,
        parentId: r.parentId ?? null,
        createdAt: r.createdAt ?? null,
        displayName: r.displayName ?? null,
        lineageId: r.lineageId ?? null,
      }))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  /**
   * Friert eine Zeile ein oder taut sie auf — an Ort und Stelle, ohne neue Version (8.25):
   * die Kopfversion traegt das Feld, und ein Freeze ist keine Aenderung am Inhalt.
   */
  public async setFrozen(id: string, frozen: boolean): Promise<void> {
    await this.prisma.dog.update({ where: { id }, data: { frozen } });
  }

  /** Cast the entity overboard — banished to the void, irrecoverable. */
  public async delete(id: string): Promise<void> {
    await this.prisma.dog.delete({ where: { id } });
  }

  // --- Aufrufe und Sterne je Kennel-Lineage (P4, IKennelStatsStore) ---

  /**
   * Ein Statement je Delta, alle Deltas eines Flushs in EINER Transaktion. `ON CONFLICT … +
   * excluded` addiert atomar — auch wenn zwei Prozesse (Deploy-Ueberlappung) gleichzeitig
   * flushen. Kein Prisma-`upsert` mit `increment`: ob daraus natives ON CONFLICT wird, ist
   * versionsabhaengig, und SELECT+INSERT rennt in P2002.
   */
  public async incrementKennelCalls(deltas: KennelCallDelta[], dogDeltas: DogCallDelta[] = []): Promise<void> {
    if (deltas.length === 0 && dogDeltas.length === 0) return;
    await this.prisma.$transaction([
      ...deltas.map((d) => this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "KennelCallDaily" ("lineageId", "day", "source", "count", "leadFailed")
      VALUES (${d.lineageId}, ${d.day}, ${d.source}, ${d.count}, ${d.leadFailed})
      ON CONFLICT ("lineageId", "day", "source") DO UPDATE SET
        "count"      = "KennelCallDaily"."count"      + excluded."count",
        "leadFailed" = "KennelCallDaily"."leadFailed" + excluded."leadFailed"
    `)),
      ...this.dogCallStatements(dogDeltas),
    ]);
  }

  // --- Dog-Aufrufe und Referenzen (P4b, IDogStatsStore) ---

  /**
   * Ein Statement je Dog-Delta. `durationMsMax` ist die EINZIGE Dialektstelle: SQLite kennt das
   * skalare MAX(a, b), Postgres GREATEST(a, b).
   */
  private dogCallStatements(deltas: DogCallDelta[]) {
    const greatest = Prisma.raw(this.isPostgres ? 'GREATEST' : 'MAX');
    return deltas.map((d) => this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "DogCallDaily" ("dogKey", "kennelLineageId", "day", "source", "count", "ok", "cached", "errors", "timeouts", "oom", "cacheHits", "cacheMisses", "durationMsSum", "durationMsMax")
      VALUES (${d.dogKey}, ${d.kennelLineageId}, ${d.day}, ${d.source}, ${d.count}, ${d.ok}, ${d.cached}, ${d.errors}, ${d.timeouts}, ${d.oom}, ${d.cacheHits}, ${d.cacheMisses}, ${d.durationMsSum}, ${d.durationMsMax})
      ON CONFLICT ("dogKey", "kennelLineageId", "day", "source") DO UPDATE SET
        "count"         = "DogCallDaily"."count"         + excluded."count",
        "ok"            = "DogCallDaily"."ok"            + excluded."ok",
        "cached"        = "DogCallDaily"."cached"        + excluded."cached",
        "errors"        = "DogCallDaily"."errors"        + excluded."errors",
        "timeouts"      = "DogCallDaily"."timeouts"      + excluded."timeouts",
        "oom"           = "DogCallDaily"."oom"           + excluded."oom",
        "cacheHits"     = "DogCallDaily"."cacheHits"     + excluded."cacheHits",
        "cacheMisses"   = "DogCallDaily"."cacheMisses"   + excluded."cacheMisses",
        "durationMsSum" = "DogCallDaily"."durationMsSum" + excluded."durationMsSum",
        "durationMsMax" = ${greatest}("DogCallDaily"."durationMsMax", excluded."durationMsMax")
    `));
  }

  public async incrementDogCalls(deltas: DogCallDelta[]): Promise<void> {
    if (deltas.length === 0) return;
    await this.prisma.$transaction(this.dogCallStatements(deltas));
  }

  public async readDogCallAggregates(sinceDay: string, dogKeys?: string[]): Promise<DogCallAggregate[]> {
    if (dogKeys && dogKeys.length === 0) return [];
    const ranked = Prisma.join([...RANKED_CALL_SOURCES]);
    const where = dogKeys ? Prisma.sql`WHERE "dogKey" IN (${Prisma.join(dogKeys)})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT "dogKey",
             CAST(SUM("count") AS INTEGER)                                                                    AS "total",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER)                     AS "last30d",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} AND "source" IN (${ranked}) THEN "count" ELSE 0 END) AS INTEGER) AS "ranked30d",
             CAST(SUM("errors" + "timeouts" + "oom") AS INTEGER)                                              AS "failures",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "errors" + "timeouts" + "oom" ELSE 0 END) AS INTEGER) AS "failures30d",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "cached" ELSE 0 END) AS INTEGER)                    AS "cached30d",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "durationMsSum" ELSE 0 END) AS INTEGER)             AS "durationMsSum30d",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER)                     AS "count30d",
             CAST(MAX(CASE WHEN "day" >= ${sinceDay} THEN "durationMsMax" ELSE 0 END) AS INTEGER)             AS "durationMsMax30d",
             CAST(COUNT(DISTINCT CASE WHEN "day" >= ${sinceDay} AND "count" > 0 THEN "kennelLineageId" END) AS INTEGER) AS "kennelsRun30d"
      FROM "DogCallDaily"
      ${where}
      GROUP BY "dogKey"
    `);
    return rows.map((r) => ({
      dogKey: String(r.dogKey),
      total: Number(r.total ?? 0),
      last30d: Number(r.last30d ?? 0),
      ranked30d: Number(r.ranked30d ?? 0),
      failures: Number(r.failures ?? 0),
      failures30d: Number(r.failures30d ?? 0),
      cached30d: Number(r.cached30d ?? 0),
      durationMsSum30d: Number(r.durationMsSum30d ?? 0),
      count30d: Number(r.count30d ?? 0),
      durationMsMax30d: Number(r.durationMsMax30d ?? 0),
      kennelsRun30d: Number(r.kennelsRun30d ?? 0),
    }));
  }

  public async readDogKennelUsage(sinceDay: string, dogKey: string): Promise<DogKennelUsage[]> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT "kennelLineageId",
             CAST(SUM("count") AS INTEGER)                        AS "count30d",
             CAST(SUM("errors" + "timeouts" + "oom") AS INTEGER)  AS "failures30d"
      FROM "DogCallDaily" WHERE "dogKey" = ${dogKey} AND "day" >= ${sinceDay}
      GROUP BY "kennelLineageId"
    `);
    return rows.map((r) => ({
      dogKey,
      kennelLineageId: String(r.kennelLineageId),
      count30d: Number(r.count30d ?? 0),
      failures30d: Number(r.failures30d ?? 0),
    }));
  }

  public async deleteDogCalls(dogKey: string): Promise<void> {
    await this.prisma.dogCallDaily.deleteMany({ where: { dogKey } });
  }

  public async replaceReferences(fromKind: DogReferenceFromKind, fromKey: string, rows: DogReferenceRow[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.dogReference.deleteMany({ where: { fromKind, fromKey } }),
      this.prisma.dogReference.createMany({ data: rows }),
    ]);
  }

  public async removeReferences(fromKind: DogReferenceFromKind, fromKey: string): Promise<void> {
    await this.prisma.dogReference.deleteMany({ where: { fromKind, fromKey } });
  }

  public async readAllReferences(): Promise<DogReferenceRow[]> {
    const rows = await this.prisma.dogReference.findMany();
    return rows.map((r) => ({
      fromKind: r.fromKind as DogReferenceFromKind,
      fromKey: r.fromKey,
      toKey: r.toKey,
      kind: r.kind as DogReferenceRow['kind'],
      position: r.position,
      fromOwnerId: r.fromOwnerId ?? null,
      resolved: r.resolved === 0 ? 0 : 1,
    }));
  }

  public async rebuildReferences(rows: DogReferenceRow[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.dogReference.deleteMany({}),
      this.prisma.dogReference.createMany({ data: rows }),
    ]);
  }

  /**
   * `CAST(… AS INTEGER)`: Postgres liefert SUM(integer) als bigint -> Prisma-BigInt; Number()
   * macht beide Wege gleich. `"day" >= 'YYYY-MM-DD'` vergleicht lexikographisch korrekt.
   */
  public async readKennelCallAggregates(sinceDay: string, lineageIds?: string[]): Promise<KennelCallAggregate[]> {
    if (lineageIds && lineageIds.length === 0) return [];
    const ranked = Prisma.join([...RANKED_CALL_SOURCES]);
    const where = lineageIds ? Prisma.sql`WHERE "lineageId" IN (${Prisma.join(lineageIds)})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT "lineageId",
             CAST(SUM("count") AS INTEGER)                                                          AS "total",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER)           AS "last30d",
             CAST(SUM("leadFailed") AS INTEGER)                                                     AS "leadFailed",
             CAST(SUM(CASE WHEN "day" >= ${sinceDay} THEN "leadFailed" ELSE 0 END) AS INTEGER)      AS "leadFailed30d",
             CAST(SUM(CASE WHEN "source" IN (${ranked}) THEN "count" ELSE 0 END) AS INTEGER)        AS "rankedTotal",
             CAST(SUM(CASE WHEN "source" IN (${ranked}) AND "day" >= ${sinceDay} THEN "count" ELSE 0 END) AS INTEGER) AS "ranked30d"
      FROM "KennelCallDaily"
      ${where}
      GROUP BY "lineageId"
    `);
    return rows.map((r) => ({
      lineageId: String(r.lineageId),
      total: Number(r.total ?? 0),
      last30d: Number(r.last30d ?? 0),
      leadFailed: Number(r.leadFailed ?? 0),
      leadFailed30d: Number(r.leadFailed30d ?? 0),
      rankedTotal: Number(r.rankedTotal ?? 0),
      ranked30d: Number(r.ranked30d ?? 0),
    }));
  }

  /** Anzahl und Summe je Lineage — der Mittelwert entsteht in JS (Postgres-AVG waere Decimal). */
  public async readKennelRatingAggregates(lineageIds?: string[]): Promise<KennelRatingAggregate[]> {
    if (lineageIds && lineageIds.length === 0) return [];
    const where = lineageIds ? Prisma.sql`WHERE "lineageId" IN (${Prisma.join(lineageIds)})` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT "lineageId", CAST(COUNT(*) AS INTEGER) AS "count", CAST(SUM("stars") AS INTEGER) AS "sum"
      FROM "KennelRating" ${where} GROUP BY "lineageId"
    `);
    return rows.map((r) => ({ lineageId: String(r.lineageId), count: Number(r.count ?? 0), sum: Number(r.sum ?? 0) }));
  }

  public async readKennelRatingHistogram(lineageId: string): Promise<KennelRatingHistogram> {
    const rows = await this.prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT "stars", CAST(COUNT(*) AS INTEGER) AS "n" FROM "KennelRating" WHERE "lineageId" = ${lineageId} GROUP BY "stars"
    `);
    const histogram: KennelRatingHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of rows) {
      const stars = Number(r.stars);
      if (stars >= 1 && stars <= 5) histogram[stars as 1 | 2 | 3 | 4 | 5] = Number(r.n ?? 0);
    }
    return histogram;
  }

  public async readKennelRating(lineageId: string, userId: string): Promise<number | null> {
    const row = await this.prisma.kennelRating.findUnique({
      where: { lineageId_userId: { lineageId, userId } },
      select: { stars: true },
    });
    return row?.stars ?? null;
  }

  public async upsertKennelRating(lineageId: string, userId: string, stars: number): Promise<void> {
    await this.prisma.kennelRating.upsert({
      where: { lineageId_userId: { lineageId, userId } },
      create: { lineageId, userId, stars },
      update: { stars },
    });
  }

  public async deleteKennelRating(lineageId: string, userId: string): Promise<boolean> {
    return (await this.prisma.kennelRating.deleteMany({ where: { lineageId, userId } })).count > 0;
  }

  public async deleteKennelStats(lineageId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.kennelCallDaily.deleteMany({ where: { lineageId } }),
      this.prisma.kennelRating.deleteMany({ where: { lineageId } }),
    ]);
  }

  /** Sever the connection to the deep — the anchor is raised, the voyage is done. */
  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default PrismaStore;
