// The AbstractController — the ancient pact that all controllers must honour.
// From brooding gulfs are we beheld: every CRUD operation flows through these eldritch methods.
import { IStore } from '../store/IStore';

/**
 * The base form of all entities that sail under our flag.
 * Corporeal laws are unwritten — the id is optional until creation bestows one.
 */
export interface IEntity {
    id?: string;
    [key: string]: any;
}

/**
 * The cargo manifest for create operations — what the caller must provide to birth a new entity.
 */
export interface ICreateInput {
    [key: string]: any;
}

/**
 * The cargo manifest for save/update operations.
 * The id must be named lest we lose the entity in the void.
 */
export interface IUpdateInput {
    id?: string;
    lineageId?: string;            // The lineage mark — binds all incarnations across branches
    parentId?: string | null;  // The ancestor from which this incarnation was born
    displayName?: string;      // The spirit's true name — changeable without breaking pacts
    /** @deprecated Relic of the old linear rite */
    version?: number;
    [key: string]: any;
}

/**
 * The sealed response from a controller operation.
 * ok signals whether we plundered successfully or were swallowed by the deep.
 */
export interface IControllerResponse<T = any> {
    ok: boolean;
    data?: T;
    error?: string;
    id?: string;
}

/**
 * Was ein Loeschen per Referenz getroffen hat: eine lineageId nimmt die ganze Lineage, eine Versions-GUID genau
 * diese Version. Fehler tragen einen Code, nie den rohen Store-Text (Prisma nennt Dateipfade und Tabellen).
 */
export type IDeleteOutcome =
    | { ok: true; scope: 'lineage' | 'version'; lineageId: string; deleted: number }
    | { ok: false; code: 'not_found' | 'delete_failed' };

/**
 * The AbstractController — a skeletal captain that all concrete controllers must flesh out.
 * It enforces the pact: create and save must be implemented by every crew member.
 * To cosmic madness laws submit, though stalwart minds entreat — here the stalwart law holds firm.
 */
export abstract class AbstractController<T extends IEntity = IEntity> {
    protected store: IStore;
    protected entityType: string;

    /**
     * @param store - The store that guards the eldritch deep.
     * @param entityType - The type brand burned onto every entity this captain commands.
     */
    constructor(store: IStore, entityType: string) {
        this.store = store;
        this.entityType = entityType;
    }

    /**
     * Birth a new entity into existence — the creation rite.
     * @param input - The raw materials from which the entity shall be forged.
     * @returns The entity with its newly stamped ID, or an error from the void.
     */
    abstract create(input: ICreateInput): Promise<IControllerResponse<T>>;

    /**
     * Save or overwrite an entity in the deep — the preservation rite.
     * @param input - Must carry an id to locate what already lurks below.
     * @returns The saved entity, or an error if the deep refused.
     */
    abstract save(input: IUpdateInput): Promise<IControllerResponse<T>>;

    /**
     * Dredge a single entity by its ID from the eldritch store.
     * @param id - The name by which it is known in the deep.
     * @returns The entity if it lurks, null if the void consumed it.
     */
    async getById(id: string): Promise<IControllerResponse<T | null>> {
        try {
            const data = await this.store.load(id);
            if (!data) {
                return { ok: false, error: `Entity with id ${id} not found`, data: null };
            }
            const parsed = this.parseEntity(data);
            return { ok: true, data: parsed };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Haul up the full manifest of entities of this type.
     * @param filter - Optional: pass a filter to narrow the net — only matching entities surface.
     * @returns The crew of entities, or an empty hold if none survive.
     */
    async list(filter?: Partial<T>): Promise<IControllerResponse<T[]>> {
        try {
            const results = await this.store.findByType(this.entityType);
            let entities = results.map((r: any) => {
                const parsed = this.parseEntity(r.serializedDogConfig || r);
                // Ensure the id from the store row is preserved — names must not be lost.
                if (r.id) {
                    parsed.id = r.id;
                }
                return parsed;
            });

            // Apply the filter if one was cast — only those who answer the challenge may board.
            if (filter) {
                entities = entities.filter((entity: T) => {
                    return Object.keys(filter).every(key => {
                        return entity[key] === filter[key];
                    });
                });
            }

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Haul up only the newest incarnation of each spirit — one per lineageId lineage.
     * Fer versioned entities this avoids flooding the manifest with every past life.
     */
    async listLatest(): Promise<IControllerResponse<T[]>> {
        try {
            // Die Masse faellt schon in der DB weg (ein Fenster-Query je Lineage) — frueher
            // lief parseEntity ueber JEDE jemals gespeicherte Version, nur damit der Dedup
            // danach fast alles wegwirft.
            const results = await this.store.findLatestByType(this.entityType);
            const all = results.map((r: any) => {
                const parsed = this.parseEntity(r.serializedDogConfig || r);
                if (r.id) parsed.id = r.id;
                // Resolve lineageId from DB column or parsed config
                const lineageId = r.lineageId || (parsed as any).lineageId;
                if (lineageId) (parsed as any).lineageId = lineageId;
                const displayName = r.displayName || (parsed as any).displayName;
                if (displayName) (parsed as any).displayName = displayName;
                // ACL fields live on the outer row, not in serializedDogConfig. Inject them so
                // route handlers / MCP tools can apply visibility / editor / viewer checks.
                if (r.visibility !== undefined && r.visibility !== null) (parsed as any).visibility = r.visibility;
                if (r.ownerId !== undefined && r.ownerId !== null) (parsed as any).ownerId = r.ownerId;
                if (r.editors !== undefined && r.editors !== null) (parsed as any).editors = r.editors;
                if (r.viewers !== undefined && r.viewers !== null) (parsed as any).viewers = r.viewers;
                if (r.runners !== undefined && r.runners !== null) (parsed as any).runners = r.runners;
                (parsed as any).frozen = Boolean(r.frozen);
                (parsed as any)._createdAt = r.createdAt;
                return parsed;
            });

            // Deduplicate: keep only the newest per lineageId.
            //
            // Dieser zweite Durchgang bleibt BEWUSST stehen, obwohl die DB schon je Lineage
            // reduziert hat. Alte Zeilen koennen ihre lineageId NUR im serializedDogConfig-JSON
            // tragen, nicht in der Spalte — `COALESCE("lineageId","id")` haelt die faelschlich
            // fuer eigene Lineages. SQL nimmt die Masse weg, dieser Dedup sichert die Semantik
            // auf der dann kleinen Menge. Wer ihn entfernt, bringt Altbestand doppelt zurueck.
            const latest = new Map<string, T>();
            for (const entity of all) {
                const key = (entity as any).lineageId || entity.id;
                const existing = latest.get(key);
                if (!existing) {
                    latest.set(key, entity);
                } else {
                    const eTime = (existing as any)._createdAt ? new Date((existing as any)._createdAt).getTime() : 0;
                    const nTime = (entity as any)._createdAt ? new Date((entity as any)._createdAt).getTime() : 0;
                    if (nTime > eTime) {
                        latest.set(key, entity);
                    }
                }
            }

            // Strip internal field
            const entities = Array.from(latest.values());
            entities.forEach(e => delete (e as any)._createdAt);

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Rename a spirit across all its incarnations — every version sharing this lineageId gets the new name.
     * The displayName is updated both in the DB column and inside the serialized config.
     */
    async rename(lineageIdOrVersionId: string, displayName: string): Promise<void> {
        // findAllVersions no longer filters by type — lineageId is unique across types.
        const versions = await this.store.findAllVersions(this.entityType, lineageIdOrVersionId);

        // If nothing found by lineageId, try as version ID to resolve the lineageId first.
        let rows = versions;
        if (rows.length === 0) {
            const single = await this.store.load(lineageIdOrVersionId);
            if (single) {
                const parsed = typeof single === 'string' ? JSON.parse(single) : single;
                const resolvedDogId = parsed.lineageId || (parsed.serializedDogConfig ? JSON.parse(parsed.serializedDogConfig).lineageId : null);
                if (resolvedDogId) {
                    rows = await this.store.findAllVersions(this.entityType, resolvedDogId);
                }
            }
        }

        for (const row of rows) {
            let config: any = {};
            try {
                config = typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig)
                    : row.serializedDogConfig;
            } catch { continue; }
            // Eine Zeile ohne Konfig-Blob hat hier nichts umzubenennen (Kennels: eigenes rename).
            if (!config || typeof config !== 'object') continue;

            config.displayName = displayName;
            await this.store.save({
                id: row.id,
                type: this.entityType,
                displayName,
                serializedDogConfig: JSON.stringify(config),
            });
        }
    }

    /**
     * Freeze or unfreeze an entity (P3.5, 8.25): the flag lands on the HEAD of the lineage, in
     * place — no new version. A version GUID is resolved to its lineage first; an old version
     * never carries the flag. Rights are the caller's business (canManageAcl).
     */
    async setFrozen(id: string, frozen: boolean): Promise<IControllerResponse<T | null>> {
        try {
            const found = await this.getById(id);
            if (!found.ok || !found.data) return { ok: false, error: `Entity with id ${id} not found`, data: null };
            const lineageId = (found.data as any).lineageId;
            const head = lineageId && lineageId !== id ? await this.getById(lineageId) : found;
            const headId = head.ok && head.data ? head.data.id : undefined;
            if (!headId) return { ok: false, error: `Entity with id ${id} not found`, data: null };
            await this.store.setFrozen(headId, frozen);
            return { ok: true, id: headId, data: { ...(head.data as T), frozen } };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Cast the entity overboard — deleted, gone, swallowed by the void.
     * @param id - The mark of the condemned.
     * @returns ok: true if we sent it to its fate; an error if it fought back.
     */
    async delete(id: string): Promise<IControllerResponse<void>> {
        try {
            if (!id) {
                return { ok: false, error: 'id is required' };
            }
            await this.store.delete(id);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Loeschen per Referenz (DELETE /api/:subpath/:id, delete_node): eine lineageId loescht alle Versionen der
     * Lineage, eine Versions-GUID genau eine. Eine id, die weder das eine noch das andere ist, aber sich aufloesen
     * laesst (Kennel-ID in anderer Schreibweise), meint die Lineage ihres Treffers. Rechte prueft der Aufrufer.
     */
    async deleteRef(id: string): Promise<IDeleteOutcome> {
        try {
            if (!id) return { ok: false, code: 'not_found' };
            const lineage = await this.store.findAllVersions(this.entityType, id);
            if (lineage.length > 0) return await this.deleteLineageRows(id, lineage.map((v) => v.id));

            const row = await this.store.load(id);
            if (!row) {
                const resolved = await this.getById(id);
                const lineageId = (resolved.data as any)?.lineageId;
                if (!resolved.ok || !lineageId || lineageId === id) return { ok: false, code: 'not_found' };
                const versions = await this.store.findAllVersions(this.entityType, lineageId);
                if (versions.length === 0) return { ok: false, code: 'not_found' };
                return await this.deleteLineageRows(lineageId, versions.map((v) => v.id));
            }

            const lineageId = AbstractController.lineageOfRow(row) || id;
            await this.store.delete(id);
            const left = await this.store.findAllVersions(this.entityType, lineageId);
            await this.afterDelete(lineageId, left.length === 0);
            return { ok: true, scope: 'version', lineageId, deleted: 1 };
        } catch (error) {
            console.error(`[${this.entityType}.deleteRef] ${id}:`, error);
            return { ok: false, code: 'delete_failed' };
        }
    }

    private async deleteLineageRows(lineageId: string, versionIds: string[]): Promise<IDeleteOutcome> {
        for (const versionId of versionIds) await this.store.delete(versionId);
        await this.afterDelete(lineageId, true);
        return { ok: true, scope: 'lineage', lineageId, deleted: versionIds.length };
    }

    /** Die Lineage einer Store-Zeile — an der Zeile oder im serializedDogConfig. */
    private static lineageOfRow(row: any): string | null {
        try {
            const cfg = typeof row === 'string' ? JSON.parse(row) : row;
            const inner = typeof cfg?.serializedDogConfig === 'string' ? JSON.parse(cfg.serializedDogConfig) : null;
            return cfg?.lineageId || inner?.lineageId || null;
        } catch {
            return null;
        }
    }

    /**
     * Aufraeumen nach deleteRef: `lineageGone` = keine Version mehr uebrig (Statistik, Referenzen fallen), sonst
     * ist eine aeltere Version jetzt der Kopf. Scheitert es, bleibt das Loeschen gueltig — nur loggen.
     */
    protected async afterDelete(_lineageId: string, _lineageGone: boolean): Promise<void> {
        /* Basis: nichts nachzuziehen */
    }

    /**
     * Peer into the deep and ask: does this entity still breathe?
     * @param id - The name to search for.
     * @returns true if it lurks, false if the void has swallowed it.
     */
    async exists(id: string): Promise<boolean> {
        try {
            const result = await this.getById(id);
            return result.ok && result.data !== null;
        } catch {
            return false;
        }
    }

    /**
     * Summon all incarnations of a spirit — every branch, every form, newest first.
     * Through endless faces, countless forms, a multitude unfolds.
     * @param lineageId - The lineage GUID that binds all incarnations across branches.
     */
    async getVersions(lineageIdOrVersionId: string): Promise<Array<{ id: string; version: number; config: any; parentId?: string | null; createdAt?: Date }>> {
        // First, try treating the input as a lineageId (lineage GUID).
        let versions = await this.store.findAllVersions(this.entityType, lineageIdOrVersionId);

        // If nothing rose from the deep, the caller may have passed a version ID instead.
        // Load that version to discover its lineageId, then summon the full lineage.
        if (versions.length === 0) {
            const single = await this.store.load(lineageIdOrVersionId);
            if (single) {
                const parsed = typeof single === 'string' ? JSON.parse(single) : single;
                const resolvedDogId = parsed.lineageId || (parsed.serializedDogConfig ? JSON.parse(parsed.serializedDogConfig).lineageId : null);
                if (resolvedDogId) {
                    versions = await this.store.findAllVersions(this.entityType, resolvedDogId);
                }
            }
        }

        return versions.map(v => {
            let config: any = {};
            try {
                config = typeof v.serializedDogConfig === 'string'
                    ? JSON.parse(v.serializedDogConfig)
                    : v.serializedDogConfig;
            } catch { /* If the config has sunk, we return an empty chest. */ }
            return { id: v.id, version: v.version, config, parentId: v.parentId ?? null, createdAt: v.createdAt ?? undefined };
        });
    }

    /**
     * Parse a raw store payload into an entity of type T.
     * If the data be a string, it is unshackled from JSON; otherwise it sails as-is.
     */
    protected parseEntity(data: any): T {
        if (typeof data === 'string') {
            return JSON.parse(data) as T;
        }
        return data as T;
    }
}

