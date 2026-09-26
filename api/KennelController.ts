// The KennelController — keeper of the kennels, master of which hounds hunt together.
// Now versioned: every save breeds a new incarnation, and the lineage branches like cursed coral.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import {
    IKennelConfig,
    IKennelNodeAnnotation,
    IKennelEdgeAnnotation,
    isRuntimeLogVerbose,
    kennelIdBlockedReason,
} from '@slopdogs/core';
import { generateVersionId } from './utils/versioning';
import { aclOf, normalizeVisibility, type Visibility } from '../mcp/auth/visibility';

/**
 * Cargo manifest for raising a new kennel from the void.
 * The id becomes the lineageId — the kennel's stable identity across all versions.
 */
export interface ICreateKennelInput extends ICreateInput {
    id?: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
    defaultQuery?: Record<string, string>;
    defaultBody?: any;
    task?: string;
    nodes?: IKennelNodeAnnotation[];
    edges?: IKennelEdgeAnnotation[];
    visibility?: Visibility;
    ownerId?: string | null;
    editors?: string[] | string | null;
    viewers?: string[] | string | null;
    runners?: string[] | string | null;
}

/**
 * Cargo manifest for updating an existing kennel.
 * The id must be named — it is the version ID or lineageId of the kennel to update.
 */
export interface ISaveKennelInput extends IUpdateInput {
    id: string;
    name?: string;
    description?: string;
    dogIds?: string[];
    defaultQuery?: Record<string, string>;
    defaultBody?: any;
    task?: string;
    nodes?: IKennelNodeAnnotation[];
    edges?: IKennelEdgeAnnotation[];
    visibility?: Visibility;
    ownerId?: string | null;
    editors?: string[] | string | null;
    viewers?: string[] | string | null;
    runners?: string[] | string | null;
}

/**
 * The KennelController — a versioned captain for IKennelConfig entities.
 * Each save creates a new version row; the lineageId (user-chosen kennel ID) stays stable.
 */
/** Wer die Statistik einer Lineage wegraeumt, wenn ihr Kennel stirbt (P4: KennelStatsService). */
export interface IKennelStatsJanitor {
    forgetKennel(lineageId: string): Promise<void>;
}

/** Wohin die Crew eines gespeicherten Kennels gemeldet wird (P4b: DogReferenceIndex). */
export interface IKennelReferenceSink {
    replaceKennelRefs(lineageId: string, ownerId: string | null | undefined, dogIds: unknown): Promise<void>;
    removeFrom(kind: 'kennel', key: string): Promise<void>;
}

export interface KennelControllerOptions {
    refIndex?: IKennelReferenceSink;
}

export class KennelController extends AbstractController<IKennelConfig> {
    private readonly KENNEL_TYPE = 'KennelConfig';
    private statsJanitor: IKennelStatsJanitor | null = null;
    private readonly refIndex: IKennelReferenceSink | null;

    constructor(store: IStore, options: KennelControllerOptions = {}) {
        super(store, 'KennelConfig');
        this.refIndex = options.refIndex ?? null;
    }

    /**
     * Die Crew der Kopfversion in den Referenzindex (P4b). Nach dem Store-Save; scheitert es, bleibt
     * der Kennel gespeichert — der naechste Boot-Rebuild heilt die Luecke.
     */
    private async syncCrewRefs(lineageId: string, ownerId: string | null | undefined, dogIds: unknown): Promise<void> {
        if (!this.refIndex) return;
        try {
            await this.refIndex.replaceKennelRefs(lineageId, ownerId, dogIds);
        } catch (err) {
            console.warn(`[KennelController] references of ${lineageId} not updated:`, err);
        }
    }

    /** Per Setter, weil der Stats-Dienst erst nach dem Controller entsteht (createHttpApplication). */
    setStatsJanitor(janitor: IKennelStatsJanitor): void {
        this.statsJanitor = janitor;
    }

    /**
     * Raises a new kennel from the abyss.
     * The user-chosen id (e.g. "my-kennel") becomes the lineageId.
     * A fresh GUID is forged as the version id (first incarnation).
     */
    async create(input: ICreateKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            // Segment-Regel statt Blockliste: der Name lebt als zweites Segment hinter /k/ und
            // kollidiert mit keinem festen Pfad. Der Anzeigename ist frei.
            if (input.id !== undefined && input.id !== null && input.id !== '') {
                const idErr = kennelIdBlockedReason(input.id);
                if (idErr) return { ok: false, error: idErr };
                const clash = await this.findCaseCollision(input.id);
                if (clash) {
                    return {
                        ok: false,
                        error: `Kennel-ID ${input.id} ist schon vergeben (als ${clash}; Gross-/Kleinschreibung zaehlt nicht)`,
                    };
                }
            }

            const lineageId = input.id || `kennel-${Date.now()}`;
            const versionId = generateVersionId();

            const config: IKennelConfig = {
                id: versionId,
                name: input.name || undefined,
                description: input.description || undefined,
                emoji: input.emoji?.trim() || undefined,
                dogIds: input.dogIds || [],
                // Welle 11: defaultQuery / defaultBody must round-trip into the
                // stored row -- the previous shape dropped them silently, so a
                // create_kennel with defaultQuery never actually persisted and
                // every later run saw `freshConfig.defaultQuery === undefined`.
                defaultQuery: input.defaultQuery,
                defaultBody: input.defaultBody,
                task: input.task || undefined,
                nodes: input.nodes,
                edges: input.edges,
                // vmTimeoutMs gehoert NICHT in die Persistenz -- ist ein Run-Time-Param,
                // der pro runKennel-Aufruf uebergeben wird (Welle 12 Korrektur).
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const visibility = normalizeVisibility(input.visibility) ?? 'public';
            const ownerId = input.ownerId ?? null;
            const editors = input.editors ?? undefined;
            const viewers = input.viewers ?? undefined;
            const runners = input.runners ?? undefined;

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.create] Erstelle neue Kennel-Config: lineageId=${lineageId}, versionId=${versionId}, visibility=${visibility}, ownerId=${ownerId}`);
            }

            await this.store.save({
                id: versionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId: null,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                task: config.task,
                nodes: config.nodes ? JSON.stringify(config.nodes) : undefined,
                edges: config.edges ? JSON.stringify(config.edges) : undefined,
                visibility,
                ownerId,
                ...(editors !== undefined ? { editors } : {}),
                ...(viewers !== undefined ? { viewers } : {}),
                ...(runners !== undefined ? { runners } : {}),
                createdAt: config.createdAt?.toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            // Cascade: a public kennel needs its own nodes to be public too.
            await this.cascadeVisibilityToOwnedNodes(config.dogIds, visibility, ownerId);
            await this.syncCrewRefs(lineageId, ownerId, config.dogIds);

            // Attach ACL fields to the returned config.
            const result = {
                ...config,
                lineageId,
                visibility,
                ownerId,
                ...(editors !== undefined ? { editors } : {}),
                ...(viewers !== undefined ? { viewers } : {}),
                ...(runners !== undefined ? { runners } : {}),
                frozen: false,
            } as any;

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.create] Erfolgreich gespeichert: lineageId=${lineageId}`);
            }
            return {
                ok: true,
                id: lineageId,
                data: result
            };
        } catch (error) {
            console.error('[KennelController.create] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Updates an existing kennel — each save breeds a new version row.
     * The old version remains in the deep, preserved like a barnacled wreck.
     * input.id can be a lineageId (resolves to latest) or a version GUID (exact version).
     */
    async save(input: ISaveKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required' };
            }
            // Resolve the existing kennel — by version ID or lineageId.
            const existing = await this.resolveKennel(input.id);
            if (!existing) {
                return { ok: false, error: `Kennel with id ${input.id} not found` };
            }

            // ACL fields: resolve early so they participate in the change-detection.
            const existingVisibility = (existing as any).visibility;
            const existingOwnerId = (existing as any).ownerId;
            const existingEditors = (existing as any).editors;
            const existingViewers = (existing as any).viewers;
            const existingRunners = (existing as any).runners;
            const nextVisibility = normalizeVisibility(input.visibility) ?? existingVisibility ?? 'public';
            const nextOwnerId = input.ownerId !== undefined ? input.ownerId : existingOwnerId ?? null;
            const nextEditors = input.editors !== undefined ? input.editors : existingEditors ?? undefined;
            const nextViewers = input.viewers !== undefined ? input.viewers : existingViewers ?? undefined;
            const nextRunners = input.runners !== undefined ? input.runners : existingRunners ?? undefined;

            // Merge new cargo with what was already in the hold.
            const config: IKennelConfig = {
                id: existing.id, // will be replaced by new versionId
                name: input.name !== undefined ? input.name : (existing.name || undefined),
                description: input.description !== undefined ? input.description : (existing.description || undefined),
                emoji:
                    input.emoji !== undefined
                        ? (input.emoji.trim() === '' ? undefined : input.emoji.trim())
                        : (existing.emoji || undefined),
                dogIds: input.dogIds !== undefined ? input.dogIds : (existing.dogIds || []),
                defaultQuery: input.defaultQuery !== undefined ? input.defaultQuery : (existing.defaultQuery || undefined),
                defaultBody: input.defaultBody !== undefined ? input.defaultBody : (existing.defaultBody || undefined),
                task: input.task !== undefined ? (input.task || undefined) : (existing.task || undefined),
                nodes: input.nodes !== undefined ? input.nodes : (existing.nodes),
                edges: input.edges !== undefined ? input.edges : (existing.edges),
                createdAt: existing.createdAt || new Date(),
                updatedAt: new Date()
            };

            const contentChanged = this.hasContentChanged(existing, config);
            // Normalize visibility: null/undefined are equivalent to the default 'public'
            // — a DB-stored null must not look "different" from a freshly-resolved 'public'.
            const visibilityChanged =
                (nextVisibility ?? 'public') !== (existingVisibility ?? 'public');
            const ownerChanged = (nextOwnerId ?? null) !== (existingOwnerId ?? null);
            const aclNorm = (v: unknown): string => {
                if (v === null || v === undefined) return 'null';
                if (Array.isArray(v) && v.length === 0) return 'null';
                return JSON.stringify(v);
            };
            const editorsChanged = aclNorm(existingEditors) !== aclNorm(nextEditors);
            const viewersChanged = aclNorm(existingViewers) !== aclNorm(nextViewers);
            const runnersChanged = aclNorm(existingRunners) !== aclNorm(nextRunners);

            // Check if anything changed — spare the deep from phantom versions.
            if (!contentChanged && !visibilityChanged && !ownerChanged && !editorsChanged && !viewersChanged && !runnersChanged) {
                return {
                    ok: true,
                    id: (existing as any).lineageId || input.id,
                    data: existing
                };
            }

            // New incarnation — forge a new version GUID.
            const newVersionId = generateVersionId();
            const lineageId = (existing as any).lineageId || input.id;
            const parentId = existing.id; // The ancestor from which this incarnation was born

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.save] Neue Version: ${newVersionId}, parentId=${parentId}, lineageId=${lineageId}, visibility=${nextVisibility}, ownerId=${nextOwnerId}`);
            }

            await this.store.save({
                id: newVersionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                task: config.task,
                nodes: config.nodes ? JSON.stringify(config.nodes) : undefined,
                edges: config.edges ? JSON.stringify(config.edges) : undefined,
                visibility: nextVisibility,
                ownerId: nextOwnerId,
                ...(nextEditors !== undefined ? { editors: nextEditors } : {}),
                ...(nextViewers !== undefined ? { viewers: nextViewers } : {}),
                ...(nextRunners !== undefined ? { runners: nextRunners } : {}),
                createdAt: new Date().toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            // Cascade only on public-direction transitions: private/null → public.
            if (nextVisibility === 'public' && existingVisibility !== 'public') {
                await this.cascadeVisibilityToOwnedNodes(config.dogIds, 'public', nextOwnerId);
            }
            await this.syncCrewRefs(lineageId, nextOwnerId, config.dogIds);

            const result = {
                ...config,
                id: newVersionId,
                lineageId,
                visibility: nextVisibility,
                ownerId: nextOwnerId,
                ...(nextEditors !== undefined ? { editors: nextEditors } : {}),
                ...(nextViewers !== undefined ? { viewers: nextViewers } : {}),
                ...(nextRunners !== undefined ? { runners: nextRunners } : {}),
                frozen: false,
            } as any;

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.save] Erfolgreich gespeichert: ${newVersionId}`);
            }
            return {
                ok: true,
                id: lineageId,
                data: result
            };
        } catch (error) {
            console.error('[KennelController.save] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * When a kennel flips to public, cascade the visibility flag to all SerializedDog/MimicDog
     * rows referenced in dogIds that are owned by the same user. Other-user-owned nodes stay
     * private (don't trespass on someone else's visibility decisions). Hunters (base:*) are
     * always visible, no cascade needed.
     *
     * Direction is one-way: only public-cascade, never private-cascade. Reason: making a kennel
     * private shouldn't blindly hide nodes that other public kennels might still reference.
     */
    private async cascadeVisibilityToOwnedNodes(
        dogIds: string[] | undefined,
        targetVisibility: Visibility,
        ownerForCascade: string | null,
    ): Promise<void> {
        if (targetVisibility !== 'public') return;
        if (!ownerForCascade) return; // super-user create has no owner anchor — skip cascade
        if (!Array.isArray(dogIds) || dogIds.length === 0) return;

        const refs = dogIds.filter((ref) => typeof ref === 'string' && !ref.startsWith('base:'));
        if (refs.length === 0) return;

        // Try both SerializedDog and MimicDog tables (same Dog table, different type).
        const fromSerialized = await this.store.findLatestVersionsByType('SerializedDog', refs);
        const fromMimic = await this.store.findLatestVersionsByType('MimicDog', refs);
        const rows = [...fromSerialized, ...fromMimic] as any[];

        for (const row of rows) {
            if (row.ownerId !== ownerForCascade) continue;
            // Respect explicit settings — only cascade nodes that have NEVER had a visibility
            // chosen (visibility IS NULL). If the user (or a previous cascade) ever wrote a
            // value, leave it alone. This prevents "I set it private manually, the next kennel
            // flip overrode my choice" — see test report Bug 4.
            if (row.visibility !== null && row.visibility !== undefined) continue;
            // Heal in place — same id, full row data, only visibility flips. No version bump.
            await this.store.save({
                id: row.id,
                type: row.type,
                lineageId: row.lineageId,
                parentId: row.parentId,
                displayName: row.displayName,
                serializedDogConfig: row.serializedDogConfig,
                visibility: 'public',
                ownerId: row.ownerId,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            });
        }
    }

    /**
     * Compare kennel configs — if content is identical, no new version shall be born.
     * `null` and `undefined` collapse to the same emptiness so a DB-stored null
     * never haunts a freshly merged undefined as a phantom change.
     */
    private hasContentChanged(old: IKennelConfig, next: IKennelConfig): boolean {
        const contentKeys: (keyof IKennelConfig)[] = [
            'name', 'description', 'emoji', 'dogIds',
            'defaultQuery', 'defaultBody',
            'task', 'nodes', 'edges',
        ];
        const normalize = (v: unknown): string => {
            if (v === null || v === undefined) return 'null';
            if (typeof v === 'string' && v === '') return 'null';
            if (Array.isArray(v) && v.length === 0) return 'null';
            return JSON.stringify(v);
        };
        for (const key of contentKeys) {
            if (normalize(old[key]) !== normalize(next[key])) return true;
        }
        return false;
    }

    /**
     * Heal the current version — mend its wounds without reincarnation.
     * Used for internal bookkeeping (e.g. auto-mimic dogIds additions)
     * that should not pollute the version history.
     */
    async heal(id: string, patch: Partial<ISaveKennelInput>): Promise<IControllerResponse<IKennelConfig>> {
        try {
            const existing = await this.resolveKennel(id);
            if (!existing) {
                return { ok: false, error: `Kennel with id ${id} not found` };
            }

            const versionId = existing.id;
            const lineageId = (existing as any).lineageId || id;

            const nextTask = patch.task !== undefined ? patch.task : existing.task;
            const nextNodes = patch.nodes !== undefined ? patch.nodes : existing.nodes;
            const nextEdges = patch.edges !== undefined ? patch.edges : existing.edges;

            await this.store.save({
                id: versionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId: (existing as any).parentId ?? null,
                name: patch.name !== undefined ? patch.name : existing.name,
                description: patch.description !== undefined ? patch.description : existing.description,
                emoji: patch.emoji !== undefined ? patch.emoji : existing.emoji,
                dogIds: patch.dogIds !== undefined ? patch.dogIds : existing.dogIds,
                defaultQuery: (patch.defaultQuery !== undefined ? patch.defaultQuery : existing.defaultQuery)
                    ? JSON.stringify(patch.defaultQuery !== undefined ? patch.defaultQuery : existing.defaultQuery) : undefined,
                defaultBody: (patch.defaultBody !== undefined ? patch.defaultBody : existing.defaultBody)
                    ? JSON.stringify(patch.defaultBody !== undefined ? patch.defaultBody : existing.defaultBody) : undefined,
                task: nextTask || undefined,
                nodes: nextNodes ? JSON.stringify(nextNodes) : undefined,
                edges: nextEdges ? JSON.stringify(nextEdges) : undefined,
                createdAt: existing.createdAt?.toISOString(),
                updatedAt: new Date().toISOString(),
            });
            await this.syncCrewRefs(lineageId, (existing as any).ownerId ?? null, patch.dogIds !== undefined ? patch.dogIds : existing.dogIds);

            return { ok: true, id: lineageId, data: existing };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Rename a kennel across all its versions. Kennel rows carry no serializedDogConfig — their
     * shown name is the `name` column. In place, no new version: the lineageId stays, and with
     * it everything keyed on it (links, call counts, stars).
     */
    async rename(lineageIdOrVersionId: string, displayName: string): Promise<void> {
        const resolved = await this.resolveKennel(lineageIdOrVersionId);
        if (!resolved) {
            throw new Error(`Kennel with id ${lineageIdOrVersionId} not found`);
        }
        const lineageId = (resolved as any).lineageId || lineageIdOrVersionId;
        const versions = await this.store.findAllVersions(this.entityType, lineageId);
        const versionIds = versions.length > 0 ? versions.map((v) => v.id) : [resolved.id];
        for (const id of versionIds) {
            await this.store.save({ id, type: this.KENNEL_TYPE, name: displayName });
        }
    }

    /**
     * Delete a kennel and ALL its versions.
     * Accepts lineageId or version-GUID — resolves lineageId first, then deletes every incarnation.
     */
    async delete(id: string): Promise<IControllerResponse<void>> {
        try {
            // Resolve to lineageId.
            const resolved = await this.resolveKennel(id);
            if (!resolved) {
                return { ok: false, error: `Kennel with id ${id} not found` };
            }
            const lineageId = (resolved as any).lineageId || id;

            // Find all versions and delete each one.
            const versions = await this.store.findAllVersions(this.entityType, lineageId);
            for (const v of versions) {
                await this.store.delete(v.id);
            }

            // If no versions found, try deleting by the id directly (fallback).
            if (versions.length === 0) {
                await this.store.delete(id);
            }

            // Zaehler und Sterne sterben mit (P4 4.11). Der Kennel ist schon weg — scheitert das
            // Aufraeumen, bleibt eine Waise, die der naechste Delete derselben Lineage mitnimmt.
            if (this.statsJanitor) {
                try {
                    await this.statsJanitor.forgetKennel(lineageId);
                } catch (err) {
                    console.warn(`[KennelController.delete] stats of ${lineageId} not removed:`, err);
                }
            }
            // P4b: seine Crew-Referenzen fallen; die DogCallDaily-Zeilen der Dogs in ihm bleiben (Dog-Historie).
            if (this.refIndex) {
                try {
                    await this.refIndex.removeFrom('kennel', lineageId);
                } catch (err) {
                    console.warn(`[KennelController.delete] references of ${lineageId} not removed:`, err);
                }
            }

            return { ok: true };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Nach deleteRef: Lineage weg -> Zaehler, Sterne und Crew-Referenzen fallen (wie delete); eine Version weg ->
     * die Crew der neuen Kopfversion gilt.
     */
    protected async afterDelete(lineageId: string, lineageGone: boolean): Promise<void> {
        try {
            if (lineageGone) {
                if (this.statsJanitor) await this.statsJanitor.forgetKennel(lineageId);
                if (this.refIndex) await this.refIndex.removeFrom('kennel', lineageId);
                return;
            }
            const head = await this.getById(lineageId);
            if (head.ok && head.data) await this.syncCrewRefs(lineageId, (head.data as any).ownerId, head.data.dogIds);
        } catch (err) {
            console.warn(`[KennelController.deleteRef] ${lineageId} not cleaned up:`, err);
        }
    }

    /**
     * Effective timestamp for ordering Kennel rows — createdAt plus heal bumps on updatedAt.
     * SQLite may round DateTime to whole seconds; two saves in the same second used to make
     * sort-by-createdAt alone pick the wrong "latest" row (defaults vanished after reload).
     */
    private kennelRowRankMs(row: any): number {
        const c = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
        const u = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        return Math.max(c, u);
    }

    /**
     * Pick the newest KennelConfig store row for one lineage: prefer leaves of the parentId chain,
     * then rank by max(createdAt, updatedAt), then id for a stable tie-break.
     */
    private pickLatestKennelStoreRow(rows: any[]): any {
        if (!rows?.length) {
            throw new Error('pickLatestKennelStoreRow: empty');
        }
        if (rows.length === 1) {
            return rows[0];
        }
        const leaves = rows.filter((r) => !rows.some((x) => x.parentId === r.id));
        const candidates = leaves.length > 0 ? leaves : rows;
        return candidates.reduce((best: any, cur: any) => {
            const bt = this.kennelRowRankMs(best);
            const ct = this.kennelRowRankMs(cur);
            if (ct > bt) {
                return cur;
            }
            if (ct < bt) {
                return best;
            }
            return String(cur.id) > String(best.id) ? cur : best;
        });
    }

    /**
     * Resolves a kennel by version ID or lineageId.
     * First tries exact match (version GUID), then resolves as lineageId (latest version).
     */
    /**
     * Eine Lineage, die sich nur in der Schreibweise von `id` unterscheidet — sonst null.
     * Der Lookup bleibt case-sensitiv (resolveKennel), damit bestehende Links weiter treffen;
     * nur das Anlegen verhindert zwei Kennels, die sich allein in Gross-/Kleinschreibung trennen.
     * Kosten: ein Partition-Scan je create — create ist selten.
     */
    private async findCaseCollision(id: string): Promise<string | null> {
        const lower = id.toLowerCase();
        const rows = await this.store.findLatestByType(this.KENNEL_TYPE);
        for (const row of rows) {
            const lineage = typeof row?.lineageId === 'string' ? row.lineageId : null;
            if (lineage && lineage !== id && lineage.toLowerCase() === lower) return lineage;
        }
        return null;
    }

    private async resolveKennel(id: string): Promise<IKennelConfig | null> {
        // First: try exact match by version ID.
        const exactData = await this.store.load(id);
        if (exactData) {
            const parsed = this.parseEntity(exactData);
            // Verify it's actually a KennelConfig (not a dog with the same ID)
            if (exactData.type === this.KENNEL_TYPE || exactData.name !== undefined || exactData.dogIds !== undefined) {
                return this.withHeadAcl(parsed);
            }
        }

        // Second: treat as lineageId — find the latest version of this kennel.
        // Das ist der REGELFALL, nicht der Ausnahmepfad: Kennel-IDs sind im Modell die
        // lineageId (siehe create()), der Primary-Key-Versuch oben greift also selten.
        // Frueher holte diese Stelle jede KennelConfig-Zeile samt Blobs und filterte sie
        // danach in JS auf eine einzige lineageId. Die Query liefert exakt dieselbe Menge —
        // die Auswahl der siegreichen Version (pickLatestKennelStoreRow) bleibt unberuehrt.
        const lineageRows = await this.store.findByLineage(this.KENNEL_TYPE, id);

        if (lineageRows.length > 0) {
            const row = this.pickLatestKennelStoreRow(lineageRows);
            const parsed = this.parseEntity(row);
            if (row.id) parsed.id = row.id;
            return parsed;
        }

        return null;
    }

    /**
     * Rechte v2: eine Version, per GUID gefunden, traegt die Rechte ihres Kopfes — sonst bliebe
     * eine alte Version oeffentlich, nachdem der Owner die Lineage enger gestellt hat, und
     * `?version=` waere der Umweg um jedes Gate. `frozen` lebt ohnehin nur am Kopf.
     */
    private async withHeadAcl(version: IKennelConfig): Promise<IKennelConfig> {
        const lineageId = (version as any).lineageId;
        if (!lineageId || lineageId === version.id) return version;
        const lineageRows = await this.store.findByLineage(this.KENNEL_TYPE, lineageId);
        if (lineageRows.length === 0) return version;
        const head = this.pickLatestKennelStoreRow(lineageRows);
        if (head.id === version.id) return version;
        return { ...version, ...aclOf(this.parseEntity(head)) } as IKennelConfig;
    }

    /**
     * Overrides getById — uses 2-stage resolution: version GUID first, then lineageId → latest.
     */
    async getById(id: string): Promise<IControllerResponse<IKennelConfig | null>> {
        try {
            const resolved = await this.resolveKennel(id);
            if (!resolved) {
                return { ok: false, error: `Kennel with id ${id} not found`, data: null };
            }
            return { ok: true, data: resolved };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Lists all kennels — only the newest version per lineageId.
     */
    async list(filter?: Partial<IKennelConfig>): Promise<IControllerResponse<IKennelConfig[]>> {
        try {
            // BEWUSST weiterhin findByType, NICHT findLatestByType: die Sieger-Auswahl hier
            // ist eine andere als die des Fenster-Querys. pickLatestKennelStoreRow bevorzugt
            // zuerst die BLAETTER der parentId-Kette und rankt danach nach
            // max(createdAt, updatedAt) — findLatestByType kennt nur createdAt und keine
            // Kette. Ein Kennel, dessen aeltere Version zuletzt per rename/ACL-Update
            // beruehrt wurde, wuerde damit anders gewaehlt als bisher. KennelConfig ist
            // ausserdem die kleine Partition; der Speichergewinn waere der Preis nicht wert.
            const results = await this.store.findByType(this.entityType);

            // Group raw rows by lineage (stable "latest" even when createdAt ties on the same second).
            const byLineage = new Map<string, any[]>();
            for (const r of results as any[]) {
                const key = r.lineageId || r.id;
                if (!byLineage.has(key)) {
                    byLineage.set(key, []);
                }
                byLineage.get(key)!.push(r);
            }

            let entities: IKennelConfig[] = [];
            for (const group of byLineage.values()) {
                const row = this.pickLatestKennelStoreRow(group);
                const parsed = this.parseEntity(row);
                if (row.id) parsed.id = row.id;
                (parsed as any).lineageId = row.lineageId;
                entities.push(parsed);
            }

            // Apply the filter if cast.
            if (filter) {
                entities = entities.filter((entity: IKennelConfig) => {
                    return Object.keys(filter).every(key => {
                        return entity[key as keyof IKennelConfig] === filter[key as keyof IKennelConfig];
                    });
                });
            }

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Also override listLatest — same as list(), returns only newest per lineageId.
     */
    async listLatest(): Promise<IControllerResponse<IKennelConfig[]>> {
        return this.list();
    }

    /**
     * Summon all versions of a kennel — every incarnation, newest first.
     * The id can be a lineageId or a version GUID (resolves to lineageId first).
     */
    async getVersions(lineageIdOrVersionId: string): Promise<Array<{ id: string; version: number; config: any; parentId?: string | null; createdAt?: Date }>> {
        // First try as lineageId directly.
        let versions = await this.store.findAllVersions(this.entityType, lineageIdOrVersionId);

        // If nothing found, try loading by version ID to discover the lineageId.
        if (versions.length === 0) {
            const single = await this.store.load(lineageIdOrVersionId);
            if (single) {
                const lineageId = single.lineageId;
                if (lineageId) {
                    versions = await this.store.findAllVersions(this.entityType, lineageId);
                }
            }
        }

        return versions.map(v => {
            const parsed = this.parseEntity(v);
            return {
                id: v.id,
                version: 0,
                config: parsed,
                parentId: v.parentId ?? null,
                createdAt: v.createdAt ?? undefined,
            };
        });
    }

    /**
     * Parses a raw store payload into an IKennelConfig.
     * The dogIds, defaultQuery, and defaultBody are JSON strings in the deep —
     * they must be unshackled before they can be used by the crew.
     */
    protected parseEntity(data: any): IKennelConfig {
        if (!data || typeof data !== 'object') {
            throw new Error('parseEntity: data ist kein Objekt');
        }

        // Unshackle dogIds from its JSON-string prison.
        let dogIds: string[] = [];
        if (data.dogIds !== null && data.dogIds !== undefined) {
            if (typeof data.dogIds === 'string') {
                if (data.dogIds.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.dogIds);
                        dogIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        dogIds = [];
                    }
                }
            } else if (Array.isArray(data.dogIds)) {
                dogIds = data.dogIds;
            }
        }

        // Unshackle defaultQuery.
        let defaultQuery: Record<string, string> | undefined = undefined;
        if (data.defaultQuery) {
            if (typeof data.defaultQuery === 'string') {
                try {
                    defaultQuery = JSON.parse(data.defaultQuery);
                } catch (e) {
                    if (isRuntimeLogVerbose()) console.warn('[parseEntity] Fehler beim Parsen von defaultQuery:', e);
                }
            } else if (typeof data.defaultQuery === 'object') {
                defaultQuery = data.defaultQuery;
            }
        }

        // Unshackle defaultBody.
        let defaultBody: any = undefined;
        if (data.defaultBody !== null && data.defaultBody !== undefined) {
            if (typeof data.defaultBody === 'string') {
                try {
                    defaultBody = JSON.parse(data.defaultBody);
                } catch (e) {
                    if (isRuntimeLogVerbose()) console.warn('[parseEntity] Fehler beim Parsen von defaultBody:', e);
                }
            } else {
                defaultBody = data.defaultBody;
            }
        }

        if (!Array.isArray(dogIds)) {
            dogIds = [];
        }

        // Unshackle nodes (layout + comments) and edges (transition comments).
        let nodes: IKennelNodeAnnotation[] | undefined = undefined;
        if (data.nodes !== null && data.nodes !== undefined) {
            if (typeof data.nodes === 'string') {
                if (data.nodes.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.nodes);
                        nodes = Array.isArray(parsed) ? parsed : undefined;
                    } catch (e) {
                        if (isRuntimeLogVerbose()) console.warn('[parseEntity] Fehler beim Parsen von nodes:', e);
                    }
                }
            } else if (Array.isArray(data.nodes)) {
                nodes = data.nodes;
            }
        }

        let edges: IKennelEdgeAnnotation[] | undefined = undefined;
        if (data.edges !== null && data.edges !== undefined) {
            if (typeof data.edges === 'string') {
                if (data.edges.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.edges);
                        edges = Array.isArray(parsed) ? parsed : undefined;
                    } catch (e) {
                        if (isRuntimeLogVerbose()) console.warn('[parseEntity] Fehler beim Parsen von edges:', e);
                    }
                }
            } else if (Array.isArray(data.edges)) {
                edges = data.edges;
            }
        }

        const task: string | undefined =
            typeof data.task === 'string' && data.task.length > 0 ? data.task : undefined;

        const result: any = {
            id: data.id,
            name: data.name,
            description: data.description,
            emoji: typeof data.emoji === 'string' && data.emoji.trim() !== '' ? data.emoji.trim() : undefined,
            dogIds: dogIds,
            defaultQuery,
            defaultBody,
            task,
            nodes,
            edges,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
        };

        // Preserve lineageId and parentId for version tracking.
        if (data.lineageId) result.lineageId = data.lineageId;
        if (data.parentId !== undefined) result.parentId = data.parentId;

        // ACL fields — null/undefined treated as "public" / no-extras downstream.
        if (data.visibility !== undefined) result.visibility = data.visibility;
        if (data.ownerId !== undefined) result.ownerId = data.ownerId;
        if (data.editors !== undefined) result.editors = data.editors;
        if (data.viewers !== undefined) result.viewers = data.viewers;
        if (data.runners !== undefined) result.runners = data.runners;
        result.frozen = Boolean(data.frozen);

        return result as IKennelConfig;
    }
}
