// Visibility & ACL rules for kennels and nodes — single source of truth.
//
// Permission model (Rechte v2, docs/slopdogs/PLAN.md P3.5)
// ────────────────
//   Stufen, streng geordnet: NONE < RUN < READ < EDIT < OWN.  COPY = READ.
//     RUN   ausfuehren / als Parent nutzen; Lead-Result bzw. Dog-Output sehen — kein Code, keine Konfig
//     READ  + Code, Konfig, Defaults, Task, Layout, Versionen, Export
//     EDIT  + neue Version, rename, delete, dogIds aendern
//     OWN   + Rechte verwalten (ACL), visibility, Owner-Transfer, freeze/unfreeze
//
//   ownerId         creator, full rights (OWN)
//   editors[]       additional users with mutate rights (EDIT)
//   viewers[]       additional users with read rights on non-public entities (READ; UI/MCP: "reader")
//   runners[]       additional users who may run/reference, not read (RUN)
//   visibility      "public" | "run-only" | "private" | null
//   frozen          true → no mutation for anyone (owner included) until unfreeze; runs, reads, copies go on
//   landing         kennel listed in env LANDING_KENNEL_IDS → like frozen, and no ACL change either, for as
//                   long as it is listed (derived from the env, not stored; myRights.locked = 'landing')
//
// Implicit rules
//   ownerId = null              → community: any logged-in user reads + mutates; OWN only super-user
//   visibility === "public"     → anyone (including anonymous) reads + runs
//   visibility === "run-only"   → anyone runs; owner + editors + viewers read
//   visibility === "private"    → owner + editors + viewers read, runners run
//   null visibility             → community: public; owned: private (fail-closed)
//   mutations                   → only owner + editors + super-user (+ community for null-owner)

import type { AuthCtx } from './middleware';
import { LandingKennels } from './landingKennels';

export type Visibility = 'public' | 'run-only' | 'private';

/** Alle gueltigen Sichtbarkeiten — eine Liste fuer Schemas, Validierung und Texte. */
export const VISIBILITIES: readonly Visibility[] = ['public', 'run-only', 'private'];

/** Eine gueltige Sichtbarkeit oder undefined — alles andere ist "nicht angegeben". */
export function normalizeVisibility(raw: unknown): Visibility | undefined {
    return VISIBILITIES.includes(raw as Visibility) ? (raw as Visibility) : undefined;
}

export interface AclEntity {
    id?: string;
    lineageId?: string;
    visibility?: Visibility | string | null;
    ownerId?: string | null;
    editors?: string[] | string | null;
    viewers?: string[] | string | null;
    runners?: string[] | string | null;
    frozen?: boolean | number | null;
}

/**
 * Die Spalten, die eine Zeile zur Rechte-Entitaet machen. Sie leben auf der Zeile, nicht im
 * serializedDogConfig — und die Kopfversion einer Lineage ist die, die zaehlt.
 */
export const ACL_FIELDS = ['visibility', 'ownerId', 'editors', 'viewers', 'runners', 'frozen'] as const;

/** Die ACL-Spalten einer Zeile (undefined bleibt weg). */
export function aclOf(row: any): AclEntity {
    const acl: Record<string, unknown> = {};
    if (!row) return acl;
    for (const field of ACL_FIELDS) {
        if (row[field] !== undefined) acl[field] = row[field];
    }
    return acl as AclEntity;
}

/** Warum niemand eine Entitaet aendern darf: Landing-Kennel (Env) vor frozen (Owner taut auf). */
export type LockReason = 'landing' | 'frozen';

/** Rechte eines Aufrufers an einer Entitaet — fuer UI-Chips und Agenten (`myRights`). */
export interface MyRights {
    run: boolean;
    read: boolean;
    edit: boolean;
    own: boolean;
    frozen: boolean;
    /** Gesperrt fuer alle, mit Grund — `landing` kann niemand aufheben, solange die Env ihn listet. */
    locked: LockReason | null;
}

/** Parse a comma-separated User-ID list (DB column) or pass through an array. */
export function parseList(raw: string[] | string | null | undefined): string[] {
    if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string' && s.length > 0);
    if (typeof raw !== 'string' || raw.length === 0) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function serializeList(list: string[]): string | null {
    if (!Array.isArray(list) || list.length === 0) return null;
    return Array.from(new Set(list.filter(Boolean))).join(',');
}

export function effectiveVisibility(k: AclEntity): Visibility {
    const explicit = normalizeVisibility(k.visibility);
    if (explicit) return explicit;
    // SECURITY (2026-09-13): fail-closed on a MISSING/null visibility field.
    // The old rule treated null as public — so any entity whose visibility column
    // was never written (or was stripped by a partial projection, see PrismaStore
    // findByType) was world-readable, code and all. Now: a null-owner entity is a
    // legacy/system/community object and stays public (this preserves anonymous
    // access to seed dogs and legacy community kennels); but an entity that HAS an
    // owner yet no explicit visibility is treated as private — an owned thing is not
    // public unless someone said so.
    return isCommunityOwned(k) ? 'public' : 'private';
}

/** True when the entity is community-editable (no owner, treated as shared). */
export function isCommunityOwned(k: AclEntity): boolean {
    return k.ownerId === null || k.ownerId === undefined;
}

/** Can the requester read this entity (list it, fetch it, run it)? */
export function canRead(k: AclEntity, ctx: AuthCtx | undefined): boolean {
    if (ctx?.isSuperUser) return true;
    if (effectiveVisibility(k) === 'public') return true;

    // Private from here on.
    if (!ctx?.user) return false;
    if (k.ownerId === ctx.user.id) return true;
    const editors = parseList(k.editors);
    if (editors.includes(ctx.user.id)) return true;
    const viewers = parseList(k.viewers);
    if (viewers.includes(ctx.user.id)) return true;
    if (isCommunityOwned(k)) return true; // legacy / system entity → community visible
    return false;
}

/**
 * Can the requester RUN this entity — run a kennel and see its lead result, or reference a
 * dog as a parent and see its output? A superset of {@link canRead}: every reader runs.
 * On top: `run-only` entities run for everyone (8.17: oeffentlich = ausfuehrbar und sichtbar),
 * and `runners[]` run a private entity. Code, config and defaults stay behind canRead.
 */
export function canRun(k: AclEntity, ctx: AuthCtx | undefined): boolean {
    if (canRead(k, ctx)) return true;
    if (effectiveVisibility(k) === 'run-only') return true;
    if (!ctx?.user) return false;
    return parseList(k.runners).includes(ctx.user.id);
}

/** Die Lese-Stufe eines Aufrufers: READ (alles), RUN (nur Ergebnis), NONE (nichts, 404). */
export type Access = 'read' | 'run' | 'none';

export function accessOf(k: AclEntity, ctx: AuthCtx | undefined): Access {
    if (canRead(k, ctx)) return 'read';
    return canRun(k, ctx) ? 'run' : 'none';
}

/**
 * Was RUN von einer Entitaet sieht (W9, W17): Identitaet, Name, Beschreibung, Icon, die
 * Schnittstelle eines Dogs — nie Code, Konfig, Defaults, Task, Layout, dogIds oder ACL-Listen.
 */
const RUN_VIEW_FIELDS = [
    'id', 'lineageId', 'name', 'displayName', 'emoji', 'icon', 'description', 'visibility',
    'type', 'contextName', 'parentsRequired', 'parentsOptional', 'createdAt', 'updatedAt',
] as const;

export function runView(k: AclEntity & Record<string, any>, ctx: AuthCtx | undefined): Record<string, unknown> {
    const view: Record<string, unknown> = {};
    for (const field of RUN_VIEW_FIELDS) {
        if (k[field] !== undefined) view[field] = k[field];
    }
    view.frozen = isFrozen(k);
    view.myRights = rightsOf(k, ctx);
    return view;
}

/** Eingefroren (8.16/8.25): keine Mutation fuer niemanden, bis der Owner auftaut. */
export function isFrozen(k: AclEntity | null | undefined): boolean {
    return !!k && Boolean(k.frozen);
}

/** Dog-Typen: ein Dog ist nie ein Landing-Kennel, auch wenn seine lineageId zufaellig in der Liste stuende. */
const DOG_TYPES = ['SerializedDog', 'MimicDog', 'BaseDog'];

/**
 * Landing-Kennel (Env LANDING_KENNEL_IDS): schreibgeschuetzt fuer alle, solange er dort steht — Owner und
 * Super-User eingeschlossen, auch keine ACL-Aenderung. Laeufe, Sterne, Lesen, Kopieren bleiben.
 */
export function isLandingLocked(k: (AclEntity & Record<string, any>) | null | undefined): boolean {
    if (!k) return false;
    if (DOG_TYPES.includes(k.type) || k.theRun !== undefined || k.parentsRequired !== undefined) return false;
    return LandingKennels.includes(k.lineageId || k.id);
}

/** Der Sperrgrund einer Entitaet oder null. */
export function lockOf(k: AclEntity | null | undefined): LockReason | null {
    if (isLandingLocked(k as any)) return 'landing';
    return isFrozen(k) ? 'frozen' : null;
}

/**
 * Can the requester create/update/delete this entity? For nodes that may also be
 * editable by kennel-owners-using-them, use {@link permissions.canMutateNode} which
 * adds the kennel-lookup on top of the basics here.
 *
 * A frozen entity is immutable for everyone — owner and super-user included — until
 * {@link canManageAcl} unfreezes it (8.25 a).
 */
export function canMutate(k: AclEntity | null, ctx: AuthCtx | undefined): boolean {
    if (lockOf(k)) return false;
    if (ctx?.isSuperUser) return true;
    if (!ctx?.user) return false;
    if (!k) return true; // create: any logged-in user may create new
    if (k.ownerId === ctx.user.id) return true;
    if (isCommunityOwned(k)) return true; // legacy unowned → community-editable
    const editors = parseList(k.editors);
    if (editors.includes(ctx.user.id)) return true;
    return false;
}

/**
 * OWN: manage the ACL, change visibility, transfer ownership, freeze/unfreeze.
 * Owner and super-user. A community entity (ownerId null) belongs to nobody — its OWN
 * right is the super-user's (8.16): logged-in users keep editing it, but nobody claims it.
 */
export function canManageAcl(k: AclEntity, ctx: AuthCtx | undefined): boolean {
    if (isLandingLocked(k as any)) return false;
    if (ctx?.isSuperUser) return true;
    if (!ctx?.user) return false;
    if (isCommunityOwned(k)) return false;
    return k.ownerId === ctx.user.id;
}

/** Owner, editors, super-user: they see who else has access (ACL lists, e-mails). */
export function seesCollaborators(k: AclEntity, ctx: AuthCtx | undefined): boolean {
    if (ctx?.isSuperUser) return true;
    if (!ctx?.user) return false;
    if (k.ownerId === ctx.user.id) return true;
    return parseList(k.editors).includes(ctx.user.id);
}

/** The caller's rights on one entity — `myRights` on get_kennel, get_node and the REST single fetch. */
export function rightsOf(k: AclEntity, ctx: AuthCtx | undefined): MyRights {
    return {
        run: canRun(k, ctx),
        read: canRead(k, ctx),
        edit: canMutate(k, ctx),
        own: canManageAcl(k, ctx),
        frozen: isFrozen(k),
        locked: lockOf(k),
    };
}

/**
 * Die Sicht eines Aufrufers auf die ACL-Felder einer Entitaet: editors/viewers/runners nur fuer
 * Owner, Editoren und Super-User; `myRights` immer. Liefert eine Kopie.
 */
export function withMyRights<T extends AclEntity>(k: T, ctx: AuthCtx | undefined): T & { myRights: MyRights } {
    const view: any = { ...k, frozen: isFrozen(k), myRights: rightsOf(k, ctx) };
    if (!seesCollaborators(k, ctx)) {
        delete view.editors;
        delete view.viewers;
        delete view.runners;
    }
    return view;
}

export function filterReadable<T extends AclEntity>(items: T[], ctx: AuthCtx | undefined): T[] {
    return items.filter((k) => canRead(k, ctx));
}

/** Listen (W17): was der Aufrufer ausfuehren darf, erscheint — run-only-Entitaeten eingeschlossen. */
export function filterRunnable<T extends AclEntity>(items: T[], ctx: AuthCtx | undefined): T[] {
    return items.filter((k) => canRun(k, ctx));
}

/** Default je Erstellung: private — auch fuer den Super-User (P3.5). */
export function applyCreateDefaults(input: any, ctx: AuthCtx | undefined): any {
    const visibility: Visibility = normalizeVisibility(input?.visibility) ?? 'private';
    const ownerId = ctx?.isSuperUser ? input?.ownerId ?? null : ctx?.user?.id ?? null;
    return { ...input, visibility, ownerId };
}
