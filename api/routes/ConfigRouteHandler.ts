// The ConfigRouteHandler — the ship's navigator, mapping all HTTP requests to their captains.
// In luminous space, blackened stars: each subpath is a star, each controller its light.
import { Request, Response } from 'express';
import { isRuntimeLogVerbose, sanitizeLineDocs } from '@slopdogs/core';
import { AbstractController, IControllerResponse, IEntity } from '../AbstractController';
import {
    accessOf,
    canManageAcl,
    canRead,
    canMutate,
    isFrozen,
    isLandingLocked,
    normalizeVisibility,
    filterRunnable,
    applyCreateDefaults,
    runView,
    withMyRights,
} from '../../mcp/auth/visibility';
import { LandingKennels } from '../../mcp/auth/landingKennels';
import { canMutateNode } from '../../mcp/auth/permissions';
import { IStore } from '../../store/IStore';
import { paramString } from '../utils/routeParams';
import { ListQuery } from './ListQuery';
import { firstRefusedDogRef, refusedDogRefMessage, type RefusedDogRef } from '../../services/dogAccess';
import type { KennelStatsService } from '../../services/KennelStatsService';
import type { DogStatsService } from '../../services/DogStatsService';

/**
 * Returns true when the request has a logged-in user OR is in super-user dev mode.
 * Sends 401 + WWW-Authenticate when not — so MCP/Action clients know to start OAuth.
 */
export function requireLogin(req: Request, res: Response): boolean {
    if (req.ctx?.user || req.ctx?.isSuperUser) return true;
    sendLoginRequired(req, res);
    return false;
}

/** 401 + WWW-Authenticate (OAuth-Discovery fuer MCP/Action-Clients) — auch fuer den Rating-Endpunkt. */
export function sendLoginRequired(req: Request, res: Response, description = 'Login required for this operation.'): void {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
    const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
    const base = process.env.MCP_BASE_URL?.replace(/\/$/, '') || `${proto}://${host}`;
    res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="SlopDogs", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
    );
    res.status(401).json({ error: 'unauthorized', error_description: description });
}

/**
 * The ControllerRegistry — a chart of all captains aboard, indexed by subpath.
 * Each subpath is a port; each controller, the harbourmaster who answers there.
 * Roiling, moaning, this realm of ours: without the registry, no request finds its captain.
 */
export class ControllerRegistry {
    private controllers: Map<string, AbstractController<any>> = new Map();

    /**
     * Register a captain for a given port (subpath).
     * @param subpath - The port name (e.g. 'nodes', 'kennels').
     * @param controller - The captain who shall answer at that port.
     */
    register<T extends IEntity = IEntity>(subpath: string, controller: AbstractController<T>): void {
        this.controllers.set(subpath, controller as AbstractController<any>);
        if (isRuntimeLogVerbose()) {
            console.log(`[ControllerRegistry] Controller für Subpath '${subpath}' registriert`);
        }
    }

    /**
     * Retrieve the captain for a given port — null if no one answers.
     */
    get(subpath: string): AbstractController<any> | undefined {
        return this.controllers.get(subpath);
    }

    /**
     * List all known ports — every subpath that has a captain aboard.
     */
    getSubpaths(): string[] {
        return Array.from(this.controllers.keys());
    }
}

/**
 * The ConfigRouteHandler — binds HTTP routes to controller captains.
 * It supports the full CRUD armada across any registered subpath.
 * Its heralds are the stars it fells: each route is a star in the eldritch sky.
 */
export class ConfigRouteHandler {
    private registry: ControllerRegistry;
    /** Used by node-mutation routes to check the kennel-owner-bypass rule. */
    private kennelStore?: IStore;
    /** P4: haengt `stats` an jede Kennel-Antwort (Liste und Einzelabruf). */
    private kennelStats?: KennelStatsService;

    /** P4b: haengt `stats` an den Einzelabruf eines Dogs (die Liste bedient NodesRouteHandler). */
    private dogStats?: DogStatsService;

    constructor(registry: ControllerRegistry, kennelStore?: IStore, kennelStats?: KennelStatsService, dogStats?: DogStatsService) {
        this.registry = registry;
        this.kennelStore = kennelStore;
        this.kennelStats = kennelStats;
        this.dogStats = dogStats;
    }

    /** True if subpath==='nodes' and the user can mutate this node (owner / editor / community / super). */
    private async canMutateForSubpath(
        subpath: string,
        entity: any,
        req: Request,
    ): Promise<boolean> {
        if (subpath === 'nodes' && this.kennelStore) {
            return await canMutateNode(entity, req.ctx, this.kennelStore);
        }
        return canMutate(entity, req.ctx);
    }

    /**
     * SECURITY (2026-09-13, P3.5 W21): a kennel may only reference dogs the caller can RUN;
     * a dog he may run but not read only as a version pin (8.15). Mirrors the MCP kennel-tool
     * guard so the HTTP surface can't embed another user's PRIVATE dog. Super-users bypass.
     */
    private async firstRefusedDogRef(dogIds: unknown, req: Request): Promise<RefusedDogRef | null> {
        const nodesController = this.registry.get('nodes');
        if (!nodesController) return null;
        return firstRefusedDogRef(dogIds, req.ctx, async (id) => {
            const res = await nodesController.getById(id);
            return res.ok && res.data ? res.data : null;
        });
    }

    /** 403 fuer eine verbotene Referenz, 400 `pin_required` fuer einen ungepinnten run-only-Dog. */
    private static sendRefusedDogRef(res: Response, refused: RefusedDogRef): void {
        res.status(refused.reason === 'pin_required' ? 400 : 403).json({
            error: refused.reason === 'pin_required' ? 'pin_required' : refusedDogRefMessage(refused),
            error_description: refusedDogRefMessage(refused),
            dogId: refused.id,
        });
    }

    /** 403 locked_landing fuer einen Kennel aus LANDING_KENNEL_IDS — true, wenn geantwortet wurde. */
    private static sendLandingLocked(res: Response, entity: any): boolean {
        if (!isLandingLocked(entity)) return false;
        res.status(403).json({ error: LandingKennels.LOCK_CODE, error_description: LandingKennels.LOCK_MESSAGE });
        return true;
    }

    /** Die Antwort auf eine verweigerte Mutation: 404 fuer Nicht-Leser, sonst 403 (auch locked_landing) bzw. 409 (frozen). */
    private static sendMutationRefused(res: Response, entity: any, req: Request, id: string, notAllowed: string): void {
        if (!canRead(entity, req.ctx)) {
            res.status(404).json({ error: `Entity mit ID ${id} nicht gefunden` });
            return;
        }
        if (ConfigRouteHandler.sendLandingLocked(res, entity)) return;
        if (isFrozen(entity)) {
            res.status(409).json({ error: 'frozen', error_description: 'Frozen. Unfreeze it first.' });
            return;
        }
        res.status(403).json({ error: notAllowed });
    }

    /**
     * Raise all sails — register every CRUD route onto the Express ship.
     * @param app - The Express vessel.
     * @param basePath - The base port from which all routes depart (default: '/api').
     */
    registerRoutes(app: any, basePath: string = '/api'): void {
        // GET /api/:subpath/:id/versions — summon every past life of an entity, newest first.
        app.get(`${basePath}/:subpath/:id/versions`, async (req: Request, res: Response) => {
            await this.handleGetVersions(req, res);
        });

        // GET /api/:subpath — haul up the full manifest of entities at this port.
        app.get(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleList(req, res);
        });

        // GET /api/:subpath/:id — dredge a single entity from the deep by name.
        app.get(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleGetById(req, res);
        });

        // POST /api/:subpath — birth a new entity into the void.
        app.post(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleCreate(req, res);
        });

        // POST /save — the old way, kept alive for Node versioning.
        // In madness lost shall die? Nay, this legacy route yet sails on.
        app.post('/save', async (req: Request, res: Response) => {
            await this.handleSave(req, res);
        });

        // PUT /api/:subpath/:id — update an entity; the new version swallows the old.
        app.put(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleUpdate(req, res);
        });

        // PATCH /api/:subpath/:id/rename — change the spirit's displayName across all incarnations.
        app.patch(`${basePath}/:subpath/:id/rename`, async (req: Request, res: Response) => {
            await this.handleRename(req, res);
        });

        // DELETE /api/:subpath/:id — cast the entity into the void, never to return.
        app.delete(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleDelete(req, res);
        });

        if (isRuntimeLogVerbose()) {
            console.log(`[ConfigRouteHandler] Routes registriert unter ${basePath}/:subpath`);
        }
    }

    /**
     * Handles GET /api/:subpath — hauls up the full manifest of entities at this port.
     * If no captain answers at this subpath, the void returns a 404.
     */
    private async handleList(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }

            // For versioned entities (nodes), return only the latest incarnation per lineageId.
            const result = await controller.listLatest();
            if (result.ok) {
                if (!Array.isArray(result.data)) {
                    res.status(200).json({ ok: true, data: result.data });
                    return;
                }
                // ACL FIRST: visibility must be settled before `total` is counted and before the
                // page is cut — otherwise `total` betrays how many foreign private entries exist
                // and every page comes out with holes in it.
                // P3.5 (W17, 8.17): run-only entries are listed — name, emoji, description; their
                // dogIds, defaults, task and layout stay behind READ.
                const visible = filterRunnable(result.data, req.ctx).map((entity: any) =>
                    accessOf(entity, req.ctx) === 'read' ? withMyRights(entity, req.ctx) : runView(entity, req.ctx),
                );
                // P4: stats haengen VOR ListQuery.apply — sortiert und gefiltert wird nach ihnen, und
                // nur an dem, was der Rechtefilter schon durchgelassen hat.
                if (subpath === 'kennels' && this.kennelStats) await this.kennelStats.attach(visible as any[]);
                const listQuery = ListQuery.from(req.query);
                res.status(200).json(listQuery.envelope(listQuery.apply(visible, req.ctx)));
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleList] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles GET /api/:subpath/:id — dredges a single named entity from the deep.
     * Returns 404 if both captain and entity are swallowed by the void.
     */
    private async handleGetById(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const id = paramString(req.params.id);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }

            const result = await controller.getById(id);
            if (result.ok) {
                // Hide private entities the caller can't see (404, not 403 — leak nothing).
                if (result.data && !canRead(result.data, req.ctx)) {
                    res.status(404).json({ error: `Entity mit ID ${id} nicht gefunden` });
                    return;
                }
                // myRights fuer die UI-Chips (read only, run only, Editor-Sperre); ACL-Listen nur
                // fuer Owner und Editoren.
                const data: any = result.data ? withMyRights(result.data, req.ctx) : result.data;
                if (data && subpath === 'kennels' && this.kennelStats) await this.kennelStats.attachOne(data);
                if (data && subpath === 'nodes' && this.dogStats) await this.dogStats.attachOne(data);
                res.status(200).json({ ok: true, data });
            } else {
                res.status(404).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleGetById] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles POST /api/:subpath — births a new entity into the eldritch store.
     * For Nodes, the cargo is translated: baseId/tsCode become id/theRun before creation.
     * Corporeal laws are unwritten: we reformat what the caller sends to fit the deep.
     */
    private async handleCreate(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }

            // Node creation requires special translation — the caller speaks in tsCode; the store speaks in theRun.
            let input = req.body;
            if (subpath === 'nodes') {
                const displayName = input.displayName || input.baseId || `node-${Date.now()}`;
                const tsCode = input.tsCode || input.theRun || '';

                // Repack into ISerializedDogConfig format — the controller forges GUIDs fer id and lineageId.
                input = {
                    displayName,
                    theRun: tsCode,
                    parentsRequired: input.parentsRequired || [],
                    parentsOptional: input.parentsOptional || [],
                    ...(typeof req.body.icon === 'string' ? { icon: req.body.icon } : {}),
                    ...(typeof req.body.description === 'string' ? { description: req.body.description } : {}),
                    ...(req.body.lineDocs !== undefined ? { lineDocs: sanitizeLineDocs(req.body.lineDocs) } : {}),
                };
            }

            // Both kennels and nodes: require login + apply visibility/ownerId defaults.
            if (!canMutate(null, req.ctx)) {
                res.status(401).json({ error: `Login required to create ${subpath}` });
                return;
            }
            // Kennels: reject references to dogs the caller can't run; pin run-only foreign dogs.
            if (subpath === 'kennels') {
                const refused = await this.firstRefusedDogRef(input?.dogIds, req);
                if (refused) {
                    ConfigRouteHandler.sendRefusedDogRef(res, refused);
                    return;
                }
            }
            input = applyCreateDefaults(input, req.ctx);

            const result = await controller.create(input);
            if (result.ok) {
                res.status(200).json({ ok: true, id: result.id, data: result.data });
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleCreate] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles POST /save — the legacy route for saving Nodes with automatic version advancement.
     * Translates tsCode/code to theRun before passing to the Node controller.
     * It gaze, accuse, deny: the deep demands an id and tsCode or it refuses the cargo.
     */
    private async handleSave(req: Request, res: Response): Promise<void> {
        try {
            // Legacy: /save is bound to the nodes captain only.
            const controller = this.registry.get('nodes');
            if (!controller) {
                res.status(404).json({ error: 'Node controller not found' });
                return;
            }
            if (!requireLogin(req, res)) return;

            const id = req.query.id || req.body.id;
            const tsCode = req.body.tsCode || req.body.code;

            if (!id || !tsCode) {
                res.status(400).json({ error: 'id and tsCode are required' });
                return;
            }

            // Edit-rights check — owner / editors / community / kennel-owner-bypass.
            const existing = await controller.getById(String(id));
            if (existing.ok && existing.data) {
                const allowed = this.kennelStore
                    ? await canMutateNode(existing.data, req.ctx, this.kennelStore)
                    : canMutate(existing.data, req.ctx);
                if (!allowed) {
                    res.status(canRead(existing.data, req.ctx) ? 403 : 404).json({
                        error: canRead(existing.data, req.ctx)
                            ? 'Nicht berechtigt, diese Node zu ändern'
                            : `Node mit ID ${id} nicht gefunden`,
                    });
                    return;
                }
            }

            // SECURITY: /save never takes ACL fields from the client — not even tucked into
            // serializedDogConfig. Existing nodes keep theirs (Controller.save carries them over),
            // new ones get the create defaults below. Rights change only via the ACL tools.
            const {
                ownerId: _ownerIn,
                visibility: _visibilityIn,
                editors: _editorsIn,
                viewers: _viewersIn,
                runners: _runnersIn,
                frozen: _frozenIn,
                ...existingConfig
            } = req.body.serializedDogConfig || {};
            let input: any = {
                ...existingConfig,
                id,
                theRun: tsCode,
                parentsRequired: req.body.parentsRequired ?? existingConfig.parentsRequired ?? [],
                parentsOptional: req.body.parentsOptional ?? existingConfig.parentsOptional ?? [],
                ...(req.body.icon !== undefined
                    ? { icon: req.body.icon === '' ? undefined : req.body.icon }
                    : {}),
                ...(typeof req.body.description === 'string' ? { description: req.body.description } : {}),
                ...(req.body.lineDocs !== undefined ? { lineDocs: sanitizeLineDocs(req.body.lineDocs) } : {}),
            };
            // SECURITY (Nira F5): an unknown id makes /save a CREATE. Without the create
            // defaults the new node was stored with no owner and no visibility — i.e.
            // community-owned and public. Same rule as POST /api/:subpath: owner = caller,
            // visibility private unless explicitly public.
            if (!(existing.ok && existing.data)) {
                input = applyCreateDefaults(input, req.ctx);
            }

            // The controller handles versioning — a new incarnation is forged with a fresh GUID.
            const result = await controller.save(input);
            if (result.ok) {
                res.status(200).json({
                    ok: true,
                    id: result.id,
                    lineageId: (result.data as any)?.lineageId,
                    displayName: (result.data as any)?.displayName,
                });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleSave] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles PUT /api/:subpath/:id — updates an entity in place, spawning a new version.
     * The id from the URL overrides any id in the body — the path speaks louder.
     */
    private async handleUpdate(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const id = paramString(req.params.id);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }

            // Both kennels and nodes: must own (or have edit rights) the entity to update.
            const existing = await controller.getById(id);
            if (!existing.ok || !existing.data) {
                res.status(404).json({ error: `Entity mit ID ${id} nicht gefunden` });
                return;
            }
            const allowed = await this.canMutateForSubpath(subpath, existing.data, req);
            if (!allowed) {
                ConfigRouteHandler.sendMutationRefused(
                    res, existing.data, req, id, `Nicht berechtigt, diese ${subpath === 'kennels' ? 'Kennel' : 'Node'} zu ändern`,
                );
                return;
            }

            // Rechte aendern sich nur ueber /acl, /freeze und die ACL-Werkzeuge: PUT nimmt keine
            // ACL-Listen, keinen Owner und kein frozen an — sonst machte sich ein Editor zum Owner.
            // visibility ist OWN (3.5.2).
            const {
                ownerId: _ownerIn,
                editors: _editorsIn,
                viewers: _viewersIn,
                runners: _runnersIn,
                frozen: _frozenIn,
                ...body
            } = req.body ?? {};
            const nextVisibility = normalizeVisibility(body.visibility);
            if (nextVisibility && nextVisibility !== (existing.data as any).visibility && !canManageAcl(existing.data, req.ctx)) {
                res.status(403).json({ error: 'Only the owner may change visibility' });
                return;
            }

            // Kennels: validate only NEWLY added dogIds so a pre-existing reference never
            // blocks a legit edit, but a freshly injected foreign private dog is rejected.
            if (subpath === 'kennels' && Array.isArray(body.dogIds)) {
                const had = new Set<string>(Array.isArray((existing.data as any).dogIds) ? (existing.data as any).dogIds : []);
                const added = (body.dogIds as any[]).filter((d) => typeof d === 'string' && !had.has(d));
                const refused = await this.firstRefusedDogRef(added, req);
                if (refused) {
                    ConfigRouteHandler.sendRefusedDogRef(res, refused);
                    return;
                }
            }

            const result = await controller.save({ ...body, id });
            if (result.ok) {
                res.status(200).json({ ok: true, id: result.id, data: result.data });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleUpdate] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles DELETE /api/:subpath/:id — casts the entity overboard.
     * Eine lineageId nimmt die ganze Lineage, eine Versions-GUID genau diese Version (deleteRef). Die Antwort
     * nennt, was fiel ({ ok, scope, lineageId, deleted }); Fehler kommen als Code, nie als roher Store-Text.
     */
    private async handleDelete(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const id = paramString(req.params.id);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: 'not_found', error_description: `No entities at /api/${subpath}.` });
                return;
            }

            // Both kennels and nodes: must own (or have edit rights) the entity to delete.
            const existing = await controller.getById(id);
            if (!existing.ok || !existing.data) {
                res.status(404).json({ error: 'not_found' });
                return;
            }
            const allowed = await this.canMutateForSubpath(subpath, existing.data, req);
            if (!allowed) {
                ConfigRouteHandler.sendDeleteRefused(res, existing.data, req, subpath);
                return;
            }

            const outcome = await controller.deleteRef(id);
            if (outcome.ok) {
                res.status(200).json({ ok: true, scope: outcome.scope, lineageId: outcome.lineageId, deleted: outcome.deleted });
            } else if (outcome.code === 'not_found') {
                res.status(404).json({ error: 'not_found' });
            } else {
                res.status(400).json({ error: outcome.code, error_description: 'Delete failed. Nothing or only part of it may be gone — reload and try again.' });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleDelete] Fehler:`, e);
            res.status(500).json({ error: 'delete_failed' });
        }
    }

    /** Die Antwort auf ein verweigertes Loeschen, als Code: 404 fuer Nicht-Leser, 409 frozen, sonst 403. */
    private static sendDeleteRefused(res: Response, entity: any, req: Request, subpath: string): void {
        if (!canRead(entity, req.ctx)) {
            res.status(404).json({ error: 'not_found' });
            return;
        }
        if (ConfigRouteHandler.sendLandingLocked(res, entity)) return;
        if (isFrozen(entity)) {
            res.status(409).json({ error: 'frozen', error_description: 'Frozen. Unfreeze it first.' });
            return;
        }
        res.status(403).json({ error: 'forbidden', error_description: `Not allowed to delete this ${subpath === 'kennels' ? 'kennel' : 'dog'}.` });
    }

    /**
     * Handles PATCH /api/:subpath/:id/rename — changes the displayName across all incarnations.
     * The id is the lineageId (lineage GUID). Every version sharing this lineageId gets the new name.
     */
    private async handleRename(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const id = paramString(req.params.id);
            const { displayName } = req.body;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }
            if (!displayName || typeof displayName !== 'string') {
                res.status(400).json({ error: 'displayName is required' });
                return;
            }

            // Both kennels and nodes: edit-rights check (with kennel-owner-bypass for nodes).
            const existing = await controller.getById(id);
            if (!existing.ok || !existing.data) {
                res.status(404).json({ error: `Entity mit ID ${id} nicht gefunden` });
                return;
            }
            const allowed = await this.canMutateForSubpath(subpath, existing.data, req);
            if (!allowed) {
                ConfigRouteHandler.sendMutationRefused(
                    res, existing.data, req, id, `Nicht berechtigt, diese ${subpath === 'kennels' ? 'Kennel' : 'Node'} umzubenennen`,
                );
                return;
            }

            await controller.rename(id, displayName);
            res.status(200).json({ ok: true });
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleRename] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles GET /api/:subpath/:id/versions — summons all incarnations of a spirit across branches.
     * The id is treated as a lineageId (lineage GUID) — all incarnations of that lineage are returned.
     * To cosmic forms from tangent planes we end as we began: all incarnations preserved in the deep.
     */
    private async handleGetVersions(req: Request, res: Response): Promise<void> {
        try {
            const subpath = paramString(req.params.subpath);
            const id = paramString(req.params.id);
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller for subpath '${subpath}' not found` });
                return;
            }

            // SECURITY (2026-09-13): gate on read-rights. This route previously
            // returned every version of ANY lineage with no visibility check, so an
            // anonymous caller could dump a private kennel's/node's full config
            // (dogIds, code, defaults) via /versions even though the single-fetch
            // 404'd. Resolve the head entity and apply canRead — 404 (never 403) so
            // we leak nothing about a private entity's existence. Mirrors the MCP
            // get_kennel_versions / get_node_versions tools.
            const head = await controller.getById(id);
            if (!head.ok || !head.data || !canRead(head.data, req.ctx)) {
                res.status(404).json({ error: `Entity mit ID ${id} nicht gefunden` });
                return;
            }

            // The id is the lineageId — the lineage GUID that binds all incarnations across branches.
            const versions = await controller.getVersions(id);
            res.status(200).json({ ok: true, data: versions });
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleGetVersions] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }
}

