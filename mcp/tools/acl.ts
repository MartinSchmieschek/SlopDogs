// ACL management tools — grant_access, revoke_access, release_ownership, list_collaborators,
// freeze_entity, unfreeze_entity. REST mirrors them (api/routes/AclRouteHandler.ts) through the
// same AclManager — one rule set, two doors.
//
// Permission model (Rechte v2, NONE < RUN < READ < EDIT < OWN): only the entity's owner (or
// super-user) may manage its ACL (canManageAcl). Community-owned entities (ownerId=null) stay
// editable for every logged-in user, but nobody claims them — their OWN right is the super-user's
// (8.16). A frozen entity takes no ACL change either; only unfreeze passes (8.25 a). A landing kennel
// (env LANDING_KENNEL_IDS) takes none at all, not even freeze/unfreeze — 403 locked_landing.

import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import type { AuthCtx } from '../auth/middleware';
import {
    canManageAcl,
    canMutate,
    canRead,
    isFrozen,
    isLandingLocked,
    normalizeVisibility,
    parseList,
    serializeList,
    isCommunityOwned,
    rightsOf,
    seesCollaborators,
    type Visibility,
} from '../auth/visibility';
import { type ToolDef, type ToolDeps, ok, fail } from './types';
import { LandingKennels } from '../auth/landingKennels';

export type EntityType = 'kennel' | 'node';
/** `reader` is the UI/MCP name of the `viewers[]` column (W18). */
type AclRole = 'editor' | 'viewer' | 'reader' | 'runner' | 'owner';
type ListRole = 'editor' | 'viewer' | 'runner';

interface ResolvedUser {
    id: string;
    email: string;
    name: string | null;
}

/** Eine Person in `view()`s `people[]` — unbekannte ids kommen mit `email`/`name` = null zurueck. */
interface PersonRef {
    id: string;
    email: string | null;
    name: string | null;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Die Spalte einer Rolle; `reader` ist ein Alias von `viewer`. */
function listRoleOf(role: AclRole): ListRole | null {
    if (role === 'reader' || role === 'viewer') return 'viewer';
    if (role === 'editor' || role === 'runner') return role;
    return null;
}

const LIST_COLUMN: Record<ListRole, 'editors' | 'viewers' | 'runners'> = {
    editor: 'editors',
    viewer: 'viewers',
    runner: 'runners',
};

/** Ein Fehler des AclManagers — die Tuer (MCP oder REST) uebersetzt ihn in ihre Sprache. */
export class AclError extends Error {
    constructor(
        readonly code: 'not_found' | 'forbidden' | 'frozen' | 'locked_landing' | 'invalid_user' | 'invalid_visibility' | 'failed',
        message: string,
    ) {
        super(message);
    }
}

/**
 * Die Rechteverwaltung einer Entitaet. Jede Aenderung laeuft hier durch: Gate (canManageAcl),
 * Frozen-Sperre, Nutzer-Aufloesung, Speichern als neue Version. MCP-Werkzeuge und REST teilen sie.
 */
export class AclManager {
    constructor(
        private readonly deps: Pick<ToolDeps, 'kennelsController' | 'nodesController' | 'prisma'>,
    ) {}

    async resolveUser(ref: string): Promise<ResolvedUser | null> {
        if (!ref || typeof ref !== 'string') return null;
        if (EMAIL_RX.test(ref)) {
            return this.deps.prisma.user.findUnique({
                where: { email: ref },
                select: { id: true, email: true, name: true },
            });
        }
        // Treat as user.id — verify it exists.
        return this.deps.prisma.user.findUnique({
            where: { id: ref },
            select: { id: true, email: true, name: true },
        });
    }

    async load(entityType: EntityType, id: string): Promise<any | null> {
        const controller = entityType === 'kennel' ? this.deps.kennelsController : this.deps.nodesController;
        const r = await controller.getById(id);
        return r.ok && r.data ? r.data : null;
    }

    /**
     * Laedt die Entitaet und prueft OWN. Wer sie nicht lesen darf, erfaehrt nicht, dass es sie gibt.
     * `allowFrozen` nur fuer unfreeze — sonst sperrt frozen jede Rechte-Aenderung.
     */
    async loadManaged(entityType: EntityType, id: string, ctx: AuthCtx | undefined, allowFrozen = false): Promise<any> {
        const entity = await this.load(entityType, id);
        if (!entity) throw new AclError('not_found', `${entityType} ${id} not found`);
        AclManager.refuseLandingLocked(entity, ctx);
        if (!canManageAcl(entity, ctx)) {
            throw canMutate(entity, ctx) || canRead(entity, ctx)
                ? new AclError('forbidden', 'Only the owner may manage access')
                : new AclError('not_found', `${entityType} ${id} not found`);
        }
        if (!allowFrozen && isFrozen(entity)) {
            throw new AclError('frozen', `${entityType} ${id} is frozen — unfreeze it first`);
        }
        return entity;
    }

    /** Ein Landing-Kennel (LANDING_KENNEL_IDS) nimmt keine Rechte-Aenderung an — Lesern sagt 403, warum. */
    private static refuseLandingLocked(entity: any, ctx: AuthCtx | undefined): void {
        if (isLandingLocked(entity) && canRead(entity, ctx)) {
            throw new AclError('locked_landing', LandingKennels.LOCK_MESSAGE);
        }
    }

    /** Loest ids zu Personen auf (view()); unbekannte kommen mit email/name = null zurueck. */
    private async resolvePeople(ids: string[]): Promise<PersonRef[]> {
        const uniqueIds = Array.from(new Set(ids));
        if (uniqueIds.length === 0) return [];
        const users = await this.deps.prisma.user.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, email: true, name: true },
        });
        const byId = new Map(users.map((u) => [u.id, u]));
        return uniqueIds.map((id) => byId.get(id) ?? { id, email: null, name: null });
    }

    private async save(entityType: EntityType, id: string, patch: Record<string, unknown>): Promise<any> {
        const controller = entityType === 'kennel' ? this.deps.kennelsController : this.deps.nodesController;
        const r = await controller.save({ id, ...patch } as any);
        if (!r.ok) throw new AclError('failed', r.error ?? 'save failed');
        return r.data;
    }

    /** grant_access: owner (Transfer) oder eine Liste. Hoehere Rollen machen niedrigere ueberfluessig. */
    async grant(entityType: EntityType, id: string, userRef: string, role: AclRole, ctx: AuthCtx | undefined) {
        const entity = await this.loadManaged(entityType, id, ctx);
        const user = await this.resolveUser(String(userRef));
        if (!user) throw new AclError('invalid_user', `User not found: ${userRef}`);
        if (role === 'owner') return this.transferTo(entityType, id, entity, user);

        const listRole = listRoleOf(role);
        if (!listRole) throw new AclError('failed', `Unknown role: ${role}`);
        if (entity.ownerId === user.id) return { entity_type: entityType, id, action: `redundant_owner_is_${listRole}`, user };
        const editors = parseList(entity.editors);
        const viewers = parseList(entity.viewers);
        const runners = parseList(entity.runners);
        // Die hoechste Stufe gewinnt (3.5.7): ein Editor wird nicht zusaetzlich reader oder runner.
        if (listRole !== 'editor' && editors.includes(user.id)) return { entity_type: entityType, id, action: `redundant_editor_is_${listRole}`, user };
        if (listRole === 'runner' && viewers.includes(user.id)) return { entity_type: entityType, id, action: 'redundant_viewer_is_runner', user };
        const current = parseList(entity[LIST_COLUMN[listRole]]);
        if (current.includes(user.id)) return { entity_type: entityType, id, action: `already_${listRole}`, user };
        await this.save(entityType, id, { [LIST_COLUMN[listRole]]: serializeList([...current, user.id]) });
        return { entity_type: entityType, id, action: `${listRole}_added`, user };
    }

    /** revoke_access: aus einer Liste streichen. Owner wird nie per revoke entfernt. */
    async revoke(entityType: EntityType, id: string, userRef: string, role: AclRole, ctx: AuthCtx | undefined) {
        const entity = await this.loadManaged(entityType, id, ctx);
        const user = await this.resolveUser(String(userRef));
        if (!user) throw new AclError('invalid_user', `User not found: ${userRef}`);
        const listRole = listRoleOf(role);
        if (!listRole) throw new AclError('failed', 'role="owner" cannot be revoked — transfer ownership instead');
        const column = LIST_COLUMN[listRole];
        const list = parseList(entity[column]);
        if (!list.includes(user.id)) return { entity_type: entityType, id, action: 'not_present', role: listRole, user };
        await this.save(entityType, id, { [column]: serializeList(list.filter((u) => u !== user.id)) });
        return { entity_type: entityType, id, action: `${listRole}_removed`, user };
    }

    /** Owner-Transfer: der neue Owner verlaesst alle Listen, er hat ohnehin alles. */
    async transfer(entityType: EntityType, id: string, userRef: string, ctx: AuthCtx | undefined) {
        const entity = await this.loadManaged(entityType, id, ctx);
        const user = await this.resolveUser(String(userRef));
        if (!user) throw new AclError('invalid_user', `User not found: ${userRef}`);
        return this.transferTo(entityType, id, entity, user);
    }

    private async transferTo(entityType: EntityType, id: string, entity: any, user: ResolvedUser) {
        if (entity.ownerId === user.id) return { entity_type: entityType, id, owner: user, action: 'already_owner' };
        await this.save(entityType, id, {
            ownerId: user.id,
            editors: serializeList(parseList(entity.editors).filter((e) => e !== user.id)),
            viewers: serializeList(parseList(entity.viewers).filter((v) => v !== user.id)),
            runners: serializeList(parseList(entity.runners).filter((r) => r !== user.id)),
        });
        return { entity_type: entityType, id, owner: user, action: 'ownership_transferred' };
    }

    /**
     * PUT /acl: Sichtbarkeit und alle drei Listen auf einmal. Jede id muss ein Nutzer sein
     * (400 invalid_user); der Owner steht in keiner Liste.
     */
    async replace(
        entityType: EntityType,
        id: string,
        input: { visibility?: unknown; editors?: unknown; viewers?: unknown; runners?: unknown },
        ctx: AuthCtx | undefined,
    ) {
        const entity = await this.loadManaged(entityType, id, ctx);
        const visibility: Visibility | undefined = input.visibility === undefined ? undefined : normalizeVisibility(input.visibility);
        if (input.visibility !== undefined && !visibility) {
            throw new AclError('invalid_visibility', `visibility must be public, run-only or private`);
        }
        const patch: Record<string, unknown> = visibility ? { visibility } : {};
        for (const column of ['editors', 'viewers', 'runners'] as const) {
            const raw = input[column];
            if (raw === undefined) continue;
            if (!Array.isArray(raw) || raw.some((u) => typeof u !== 'string')) {
                throw new AclError('invalid_user', `${column} must be an array of user ids or emails`);
            }
            // Jeder Eintrag darf User.id oder E-Mail sein — aufgeloest wird immer zur id gespeichert.
            // Owner-Filter und Dedupe laufen NACH der Aufloesung (mehrere Referenzen auf denselben Nutzer).
            const resolvedIds: string[] = [];
            for (const ref of raw as string[]) {
                const user = await this.resolveUser(ref);
                if (!user) throw new AclError('invalid_user', `User not found: ${ref}`);
                resolvedIds.push(user.id);
            }
            const ids = Array.from(new Set(resolvedIds)).filter((u) => u !== entity.ownerId);
            patch[column] = serializeList(ids);
        }
        if (Object.keys(patch).length > 0) await this.save(entityType, id, patch);
        return this.view(entityType, id, ctx);
    }

    /** release_ownership: zurueck zur Community. Nur der Owner selbst (oder der Super-User). */
    async release(entityType: EntityType, id: string, ctx: AuthCtx | undefined) {
        const entity = await this.load(entityType, id);
        if (!entity) throw new AclError('not_found', `${entityType} ${id} not found`);
        AclManager.refuseLandingLocked(entity, ctx);
        if (entity.ownerId == null) return { entity_type: entityType, id, action: 'already_community' };
        if (!ctx?.isSuperUser && entity.ownerId !== ctx?.user?.id) {
            throw new AclError('forbidden', 'Only the current owner may release ownership');
        }
        if (isFrozen(entity)) throw new AclError('frozen', `${entityType} ${id} is frozen — unfreeze it first`);
        await this.save(entityType, id, { ownerId: null });
        return { entity_type: entityType, id, action: 'ownership_released' };
    }

    /** freeze/unfreeze (8.16, 8.25 a): OWN; bei Community der Super-User. Am Kopf, ohne neue Version. */
    async setFrozen(entityType: EntityType, id: string, frozen: boolean, ctx: AuthCtx | undefined) {
        const entity = await this.loadManaged(entityType, id, ctx, true);
        if (isFrozen(entity) === frozen) return { entity_type: entityType, id, frozen, action: frozen ? 'already_frozen' : 'not_frozen' };
        const controller = entityType === 'kennel' ? this.deps.kennelsController : this.deps.nodesController;
        const r = await controller.setFrozen(id, frozen);
        if (!r.ok) throw new AclError('failed', r.error ?? 'freeze failed');
        return { entity_type: entityType, id, frozen, action: frozen ? 'frozen' : 'unfrozen' };
    }

    /** GET /acl: Owner, Editoren, Super-User — alle anderen sehen nichts (404). */
    async view(entityType: EntityType, id: string, ctx: AuthCtx | undefined) {
        const entity = await this.load(entityType, id);
        if (!entity || !seesCollaborators(entity, ctx)) throw new AclError('not_found', `${entityType} ${id} not found`);
        const editors = parseList(entity.editors);
        const viewers = parseList(entity.viewers);
        const runners = parseList(entity.runners);
        const allIds = [
            ...(entity.ownerId ? [entity.ownerId as string] : []),
            ...editors,
            ...viewers,
            ...runners,
        ];
        return {
            ok: true,
            visibility: entity.visibility ?? 'public',
            ownerId: entity.ownerId ?? null,
            editors,
            viewers,
            runners,
            frozen: isFrozen(entity),
            myRights: rightsOf(entity, ctx),
            people: await this.resolvePeople(allIds),
        };
    }
}

/** Ein AclError als Tool-Antwort. */
async function asTool(run: () => Promise<unknown>) {
    try {
        return ok(await run());
    } catch (err: any) {
        if (err instanceof AclError) return fail(err.code === 'locked_landing' ? `${err.code}: ${err.message}` : err.message);
        return fail(err?.message ?? String(err));
    }
}

const ENTITY_ARGS = {
    entity_type: { type: 'string', enum: ['kennel', 'node'] },
    id: { type: 'string', description: 'lineageId or version GUID' },
} as const;

export function getAclTools(): ToolDef[] {
    return [
        {
            name: 'grant_access',
            description:
                'Grant a user access to a kennel or node. Rights are ordered NONE < RUN < READ < EDIT < OWN. role="runner" adds them to runners[] — run without read: they may run the entity and use it as a parent (output only, never code, config or defaults). role="reader" (alias "viewer") adds them to viewers[] — read code and config. role="editor" adds them to editors[] — change it. role="owner" transfers ownership — irreversible without the new owner consenting. Only the owner (or super-user) may grant; not while the entity is frozen. user can be an email or a User.id GUID.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id', 'user', 'role'],
                additionalProperties: false,
                properties: {
                    ...ENTITY_ARGS,
                    user: { type: 'string', description: 'user email OR User.id GUID' },
                    role: { type: 'string', enum: ['editor', 'reader', 'viewer', 'runner', 'owner'] },
                },
            },
            handler: async (args, ctx, deps) => asTool(() =>
                new AclManager(deps).grant(args.entity_type as EntityType, String(args.id), String(args.user), args.role as AclRole, ctx),
            ),
        },
        {
            name: 'revoke_access',
            description:
                'Remove a user from editors[], viewers[] (role "reader" or "viewer") or runners[] of a kennel or node. role="owner" is not allowed via revoke — use grant_access with role="owner" to transfer ownership instead. Only the owner (or super-user); not while frozen.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id', 'user', 'role'],
                additionalProperties: false,
                properties: {
                    ...ENTITY_ARGS,
                    user: { type: 'string', description: 'user email OR User.id GUID' },
                    role: { type: 'string', enum: ['editor', 'reader', 'viewer', 'runner'] },
                },
            },
            handler: async (args, ctx, deps) => asTool(() =>
                new AclManager(deps).revoke(args.entity_type as EntityType, String(args.id), String(args.user), args.role as AclRole, ctx),
            ),
        },
        {
            name: 'release_ownership',
            description:
                'Releases ownership of a kennel or node — sets ownerId back to null, returning the entity to community mode (any logged-in user reads + edits; only the super-user manages its access or freezes it). Only the current owner (or super-user) can release; not while frozen. The entity\'s editors[], viewers[] and runners[] are kept intact.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: { ...ENTITY_ARGS },
            },
            handler: async (args, ctx, deps) => asTool(() =>
                new AclManager(deps).release(args.entity_type as EntityType, String(args.id), ctx),
            ),
        },
        {
            name: 'freeze_entity',
            description:
                'Freezes a kennel or node: no edit, rename, delete, new version or access change for anyone — the owner included — until unfreeze_entity. Runs, stars and copies (export/import) go on. Only the owner; for community entities (no owner) only the super-user. No new version is created.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: { ...ENTITY_ARGS },
            },
            handler: async (args, ctx, deps) => asTool(() =>
                new AclManager(deps).setFrozen(args.entity_type as EntityType, String(args.id), true, ctx),
            ),
        },
        {
            name: 'unfreeze_entity',
            description:
                'Unfreezes a kennel or node frozen with freeze_entity — edits are possible again. Only the owner; for community entities only the super-user.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: { ...ENTITY_ARGS },
            },
            handler: async (args, ctx, deps) => asTool(() =>
                new AclManager(deps).setFrozen(args.entity_type as EntityType, String(args.id), false, ctx),
            ),
        },
        {
            name: 'list_collaborators',
            description:
                'Returns the ACL of a kennel or node: owner, editors[], viewers[] (readers), runners[], frozen. Not found unless you can read the entity. Owner and editors see each user resolved with id, email and name; everyone else sees only ids and counts.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: { ...ENTITY_ARGS },
            },
            handler: async (args, ctx, deps) => {
                const entityType = args.entity_type as EntityType;
                const id = String(args.id);
                const entity = await new AclManager(deps).load(entityType, id);
                // SECURITY (Nira F4): same answer for "missing" and "not yours to read".
                if (!entity || !canRead(entity as any, ctx)) return fail(`${entityType} ${id} not found`);

                const editorIds = parseList((entity as any).editors);
                const viewerIds = parseList((entity as any).viewers);
                const runnerIds = parseList((entity as any).runners);
                const allIds = [
                    ...((entity as any).ownerId ? [(entity as any).ownerId as string] : []),
                    ...editorIds,
                    ...viewerIds,
                    ...runnerIds,
                ];

                // Who sees collaborator e-mails: owner, editors, super-user. Readers (viewers, or
                // anyone on a public entity) see only ids and counts — not an address book.
                if (!seesCollaborators(entity as any, ctx)) {
                    const idOnly = (uid: string) => ({ id: uid });
                    return ok({
                        entity_type: entityType,
                        id,
                        visibility: (entity as any).visibility ?? 'public',
                        owner: (entity as any).ownerId ? idOnly((entity as any).ownerId) : null,
                        editors: editorIds.map(idOnly),
                        viewers: viewerIds.map(idOnly),
                        runners: runnerIds.map(idOnly),
                        editorCount: editorIds.length,
                        viewerCount: viewerIds.length,
                        runnerCount: runnerIds.length,
                        frozen: isFrozen(entity as any),
                        is_community: isCommunityOwned(entity as any),
                    });
                }

                const users = allIds.length === 0
                    ? []
                    : await deps.prisma.user.findMany({
                        where: { id: { in: Array.from(new Set(allIds)) } },
                        select: { id: true, email: true, name: true },
                    });
                const byId = new Map(users.map((u) => [u.id, u]));
                const lookup = (uid: string) => byId.get(uid) ?? { id: uid, email: '<unknown>', name: null };

                return ok({
                    entity_type: entityType,
                    id,
                    visibility: (entity as any).visibility ?? 'public',
                    owner: (entity as any).ownerId ? lookup((entity as any).ownerId) : null,
                    editors: editorIds.map(lookup),
                    viewers: viewerIds.map(lookup),
                    runners: runnerIds.map(lookup),
                    frozen: isFrozen(entity as any),
                    is_community: isCommunityOwned(entity as any),
                });
            },
        },
    ];
}
