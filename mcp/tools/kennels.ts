// Kennel tools — list, get, create, update, delete, run, execute, plus
// granular kennel-detail accessors (defaultBody, defaultQuery, task, layout, versions).
// Each respects the visibility/ownership rules; super-user (dev mode) bypasses.

import {
    accessOf,
    canRead,
    canMutate,
    filterRunnable,
    applyCreateDefaults,
    normalizeVisibility,
    rightsOf,
    isFrozen,
    isLandingLocked,
    canManageAcl,
    withMyRights,
    VISIBILITIES,
    type Access,
} from '../auth/visibility';
import { LandingKennels } from '../auth/landingKennels';
import { type BaseDogInfo, type ToolDef, type ToolDeps, ok, fail, resolveTsCode, codeHinweise } from './types';
import {
    BASE_DOG_PREFIX,
    KENNEL_PUBLIC_PREFIX,
    checkSerializedDogCode,
    publicKennelDocsPath,
    publicKennelOpenApiPath,
    publicKennelPath,
    sanitizeLineDocs,
    type ILineDoc,
} from '@slopdogs/core';
import type { AuthCtx } from '../auth/middleware';
import { SPUREN_NODES_FIELD_HINT, SPUREN_TASK_FIELD_HINT } from '../spuren-brief';
import { REDACTED_TEXT, kennelRunView, redactWavesForCtx } from '../../services/wavesRedaction';
import { KennelSnapshotCache } from '../snapshots/KennelSnapshotCache';
import { firstRefusedDogRef, refusedDogRefMessage } from '../../services/dogAccess';
import { ListQuery, USAGE_FILTERS, USAGE_FILTER_HELP } from '../../api/routes/ListQuery';
import { DogReuseAdvisor, type BuiltDog, type ReuseCandidate, type ReuseHint } from '../../services/DogReuseAdvisor';

/** Status notebook — see mcp/skill.md § Spuren & Rechtfertigung */
const KENNEL_TRACE_NODE_SCHEMA = {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: {
        id: {
            type: 'string',
            description:
                'dogIds entry: lineageId, version GUID, or base:Name. In build_kennel the dogs are created in the very same call, so use the sibling syntax "@DisplayName" (or the bare displayName) — it is resolved to the fresh lineageId for you.',
        },
        x: { type: 'number', description: 'Wave-View canvas X (optional)' },
        y: { type: 'number', description: 'Wave-View canvas Y (optional)' },
        comment: {
            type: 'string',
            description: SPUREN_NODES_FIELD_HINT,
        },
    },
} as const;

const KENNEL_TRACE_EDGE_SCHEMA = {
    type: 'object',
    required: ['fromId', 'toId'],
    additionalProperties: false,
    properties: {
        fromId: { type: 'string' },
        toId: { type: 'string' },
        comment: { type: 'string', description: 'Optional — grobe Wunsch-Kette (z.B. „Ort → Kandidaten“), kein Feld-Mapping' },
    },
} as const;

const KENNEL_TRACE_FIELDS = {
    task: {
        type: 'string',
        description: SPUREN_TASK_FIELD_HINT,
    },
    nodes: {
        type: 'array',
        description: SPUREN_NODES_FIELD_HINT,
        items: KENNEL_TRACE_NODE_SCHEMA,
    },
    edges: {
        type: 'array',
        description: 'Optional — Wunsch-Kette in einem Satz pro Kante, nicht technisches Mapping.',
        items: KENNEL_TRACE_EDGE_SCHEMA,
    },
} as const;

/**
 * Was an Spuren wirklich haengengeblieben ist -- und was fehlt.
 *
 * Die Spuren-Pflicht stand bisher nur in Prosa (MCP-`initialize`, Tool-Beschreibungen), waehrend
 * das Schema `task`/`nodes` als optional auswies. Prosa, die ein Agent einmal beim Verbinden
 * sieht, verliert gegen ein Schema, das "kannst du weglassen" sagt -- also wurde sie weggelassen.
 * Ein Werkzeug-ERGEBNIS liest der Agent dagegen jedes Mal. Darum meldet jede Pack-Aenderung
 * zurueck, was fehlt, und nennt die ids gleich so, wie sie fuer update_kennel gebraucht werden.
 *
 * Bewusst KEIN harter Zwang ueber `required`: ein erzwungenes, leeres Pflichtfeld ist schlechter
 * als eine ehrliche Luecke -- und wuerde jeden bestehenden Aufrufer brechen.
 */
function spurenReport(task: unknown, nodes: unknown, dogIds: unknown) {
    const ids: string[] = Array.isArray(dogIds) ? dogIds.filter((d): d is string => typeof d === 'string') : [];
    const hasTask = typeof task === 'string' && task.trim().length > 0;
    const list: any[] = Array.isArray(nodes) ? nodes : [];
    const commented = new Set(
        list
            .filter((n) => n && typeof n.comment === 'string' && n.comment.trim().length > 0)
            .map((n) => String(n.id)),
    );
    const missingComments = ids.filter((id) => !commented.has(id));
    const complete = hasTask && missingComments.length === 0;
    return {
        complete,
        task: hasTask ? 'gesetzt' : 'FEHLT',
        commentedDogs: `${ids.length - missingComments.length}/${ids.length}`,
        missingComments,
        ...(complete
            ? {}
            : {
                  hint:
                      'Spuren unvollstaendig. Bevor du "fertig" meldest: update_kennel mit ' +
                      (hasTask ? '' : 'task (Wunsch in vier Bloecken) und ') +
                      'nodes:[{id, comment}] fuer die oben genannten ids nachreichen.',
              }),
    };
}

/**
 * Die Pflicht-Eltern der Basis-Dogs, die der Dienst in dogIds ergaenzt, statt sie der Laufzeit zu ueberlassen.
 *
 * Fehlt ein Pflicht-Basis-Dog, erzeugt ihn autoMimic zwar zur Laufzeit -- aber unsichtbar im Kennel,
 * und frueher ohne Query: jede Lobby ohne ausdruecklichen base:QueryRetriever hat ?channelId=
 * ignoriert und je Aufruf einen neuen Raum eroeffnet. Deshalb landen die Pflicht-Eltern hier im
 * Kennel selbst. Die Quelle ist der `required`-Vertrag der Registry (parentsRequired), nichts ist
 * fest verdrahtet. Nur echte Basis-Dogs: einen Pact erfuellt ein Mimic oder ein liefernder Dog.
 * Transitiv, hinten angehaengt, nie doppelt -- der Lead bleibt vorn. Ergaenzt wird, nie abgelehnt.
 *
 * Jeder ergaenzte Dog traegt einen englischen Knoten-Kommentar (warum er da ist, wozu er dient),
 * damit die Spuren ihn nicht als unkommentiert melden -- Kommentare des Agenten bleiben unangetastet.
 */
export class PflichtEltern {
    readonly dogIds: string[];
    private readonly ergaenzungen: Array<{ id: string; requiredBy: string[]; purpose?: string }>;

    constructor(dogIds: string[], baseDogsList: BaseDogInfo[]) {
        const baseDogs = new Map(baseDogsList.map((b) => [b.name, b]));
        // dogIds kommen ungeprueft aus dem Tool-Aufruf -- Fremdes bleibt stehen, wird aber nicht gedeutet.
        const baseDogOf = (id: unknown) =>
            typeof id === 'string' && id.startsWith(BASE_DOG_PREFIX)
                ? baseDogs.get(id.substring(BASE_DOG_PREFIX.length))
                : undefined;

        const result = [...dogIds];
        const added: BaseDogInfo[] = [];
        // result waechst waehrend der Schleife: ein ergaenzter Dog wird selbst auf Pflicht-Eltern geprueft.
        for (let i = 0; i < result.length; i++) {
            for (const parentName of baseDogOf(result[i])?.parentsRequired ?? []) {
                const parent = baseDogs.get(parentName);
                if (!parent || parent.isPact || result.includes(BASE_DOG_PREFIX + parentName)) continue;
                result.push(BASE_DOG_PREFIX + parentName);
                added.push(parent);
            }
        }

        // Erst mit dem fertigen Kennel stehen alle Kinder fest: ein Pflicht-Dog kann mehreren dienen.
        const kennelDogs = [...new Set(result.map(baseDogOf).filter((d): d is BaseDogInfo => !!d))];
        this.dogIds = result;
        this.ergaenzungen = added.map((parent) => ({
            id: BASE_DOG_PREFIX + parent.name,
            requiredBy: kennelDogs.filter((d) => d.parentsRequired?.includes(parent.name)).map((d) => d.name),
            purpose: parent.description?.trim() || undefined,
        }));
    }

    /** Die knappe Meldung fuer die Tool-Antwort. */
    get ergaenzt(): string[] {
        return this.ergaenzungen.map((e) => `${e.id} (Pflicht fuer ${e.requiredBy.join(', ')})`);
    }

    /**
     * nodes[] um den Auto-Kommentar jeder ergaenzten id erweitern, die noch keinen Kommentar hat.
     * Ein vorhandener Kommentar wird nie ueberschrieben, ein Eintrag nur mit Position bekommt ihn
     * dazu. Ohne Ergaenzung kommt nodes unveraendert zurueck.
     */
    kommentiere(nodes: unknown): unknown {
        if (this.ergaenzungen.length === 0) return nodes;
        const list: any[] = Array.isArray(nodes) ? [...nodes] : [];
        for (const e of this.ergaenzungen) {
            const index = list.findIndex((n) => n && n.id === e.id);
            const node = index >= 0 ? list[index] : undefined;
            if (typeof node?.comment === 'string' && node.comment.trim().length > 0) continue;
            const kommentiert = { ...node, id: e.id, comment: PflichtEltern.autoKommentar(e) };
            if (index >= 0) list[index] = kommentiert;
            else list.push(kommentiert);
        }
        return list;
    }

    private static autoKommentar(e: { requiredBy: string[]; purpose?: string }): string {
        const kinder = e.requiredBy.join(', ');
        return `Auto-added by SlopDogs: required by ${kinder}. Purpose: ${e.purpose ?? `required input for ${kinder}.`}`;
    }
}

/**
 * Inline MCP-AuthCtx -> VmGlobalCapabilityContext adapter.
 * Mirrors KennelRunHandler.toCapabilityCtx, but lives here so the MCP tools
 * don't crash on runtimes whose compiled KennelRunHandler predates that
 * method (Welle 9 hotfix). Returns undefined for missing ctx so the core's
 * capabilities stay raw, matching the legacy behaviour.
 */
function authCtxToCapabilityCtx(ctx: AuthCtx | undefined | null):
    { userId: string | null; isSuperUser: boolean } | undefined {
    if (!ctx) return undefined;
    return {
        userId: ctx.user?.id ?? null,
        isSuperUser: !!ctx.isSuperUser,
    };
}

/**
 * SECURITY (2026-09-13, P3.5 W21): a kennel may only reference dogs the caller is allowed
 * to RUN — its own, public, run-only, community/legacy, granted as runner, or BaseDogs.
 * Before this, dogIds were taken unchecked, so attacker B could drop A's PRIVATE lineageId
 * into B's kennel. Referencing a dog is running it (3.5.2); a dog the caller may run but not
 * read is accepted only as a version pin (8.15) — its author cannot slip new code into it.
 *
 * Returns the error text for the first refused id, or null when all pass. Super-users
 * (dev/admin) bypass. Unresolved ids (fresh siblings, base names that aren't stored) are
 * left to the runtime.
 */
async function firstUnreferenceableDog(
    dogIds: unknown,
    ctx: AuthCtx,
    deps: ToolDeps,
): Promise<string | null> {
    const refused = await firstRefusedDogRef(dogIds, ctx, async (id) => {
        const res = await deps.nodesController.getById(id);
        return res.ok && res.data ? (res.data as any) : null;
    });
    return refused ? refusedDogRefMessage(refused) : null;
}

/**
 * OWN changes visibility (3.5.2): an editor edits the content, not who may see it.
 * Returns the refusal text, or null when the call leaves visibility alone or may change it.
 */
function visibilityChangeRefused(existing: any, requested: unknown, ctx: AuthCtx): string | null {
    const next = normalizeVisibility(requested);
    if (!next || next === (existing?.visibility ?? undefined)) return null;
    return canManageAcl(existing, ctx) ? null : 'Only the owner may change visibility';
}

/**
 * Warum eine Kennel-Mutation abgewiesen wird: wer nicht lesen darf, erfaehrt nichts (not found); ein Landing-Kennel
 * (LANDING_KENNEL_IDS) nennt Code und Grund — fuer jeden, auch Owner und Super-User; frozen; sonst keine Rechte.
 */
function kennelMutationRefusal(kennel: any, ctx: AuthCtx, id: string): string {
    if (!canRead(kennel, ctx)) return `Kennel ${id} not found`;
    if (isLandingLocked(kennel)) return `${LandingKennels.LOCK_CODE}: ${LandingKennels.LOCK_MESSAGE}`;
    if (isFrozen(kennel)) return `Kennel ${id} is frozen — unfreeze it first`;
    return 'Not authorized';
}

/** Minimal projection for list_kennels — no payloads, no layout. */
function leanKennel(k: any) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        name: k.name,
        emoji: k.emoji,
        dogCount: Array.isArray(k.dogIds) ? k.dogIds.length : 0,
        visibility: k.visibility ?? 'public',
        updatedAt: k.updatedAt,
    };
}

/**
 * get_kennel fuer RUN (W9): wer ausfuehren, aber nicht lesen darf, bekommt den Namen und seine
 * Rechte — keine dogIds, keine Presence-Flags, keinen Owner.
 */
function kennelRunHeader(k: any, ctx: AuthCtx) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        name: k.name,
        emoji: k.emoji,
        visibility: k.visibility ?? 'public',
        frozen: isFrozen(k),
        myRights: rightsOf(k, ctx),
    };
}

/** Ein Lauf-Fehler fuer die Tool-Antwort: Leser sehen die Nachricht, RUN-Leser den Platzhalter (W13). */
function runErrorText(err: any, access: Access): string {
    return access === 'read' ? err?.message ?? String(err) : REDACTED_TEXT;
}

/** Header projection for get_kennel — payload presence flagged, not dumped. */
function kennelHeader(k: any, ctx: AuthCtx) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        parentId: k.parentId ?? null,
        name: k.name,
        description: k.description,
        emoji: k.emoji,
        dogIds: Array.isArray(k.dogIds) ? k.dogIds : [],
        visibility: k.visibility ?? 'public',
        ownerId: k.ownerId ?? null,
        hasDefaultBody: k.defaultBody !== undefined && k.defaultBody !== null,
        hasDefaultQuery: !!(k.defaultQuery && Object.keys(k.defaultQuery).length > 0),
        hasTask: typeof k.task === 'string' && k.task.length > 0,
        hasNodes: Array.isArray(k.nodes) && k.nodes.length > 0,
        hasEdges: Array.isArray(k.edges) && k.edges.length > 0,
        frozen: isFrozen(k),
        myRights: rightsOf(k, ctx),
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
    };
}

export function getKennelTools(): ToolDef[] {
    return [
        {
            name: 'list_kennels',
            description:
                'Lists kennels visible to the current user — every kennel you may run, run-only kennels included. Returns minimal metadata only (id, lineageId, name, emoji, dogCount, visibility, updatedAt) and `stats` {calls: {total, last30d, leadFailed, leadFailed30d, ranked, ranked30d}, rating: {avg, count, score}}. Find kennels by usage and stars: `{search, sort: "rating" | "calls30d", dir: "desc"}`; filter with minStars (raw average) and minCalls (ranked calls). Filter by how they are used with `usage`: "top" (called, most calls first), "never_used" (0 calls), "never_worked" (called, every run failed), "failing" (a failed run in the last 30 days), "dormant" (called once, silent for 30 days) — e.g. `{search: "weather", usage: "top"}` or `{usage: "failing", sort: "failures30d", dir: "desc"}`; exact definitions in the `usage` parameter. WITHOUT limit the result is a bare array (legacy shape); WITH limit an envelope {kennels, total, offset, limit, hasMore}. Use get_kennel for the header, and the get_kennel_* tools for payload fields (they need the read right).',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    search: { type: 'string', description: 'case-insensitive substring on name, displayName, description, lineageId' },
                    mine: { type: 'boolean', description: 'only kennels owned by the caller' },
                    sort: {
                        type: 'string',
                        enum: ['name', 'createdAt', 'updatedAt', 'calls', 'calls30d', 'rating', 'failures30d'],
                        description: 'calls/calls30d = ranked usage (public + execute paths), rating = Bayes score, failures30d = runs whose lead failed in the last 30 days (stats.calls.leadFailed30d). Default name (with usage "top": most calls first).',
                    },
                    usage: { type: 'string', enum: [...USAGE_FILTERS], description: USAGE_FILTER_HELP },
                    dir: { type: 'string', enum: ['asc', 'desc'], description: 'default: desc for the number sorts (calls, calls30d, rating, failures30d), asc for name and dates' },
                    minStars: { type: 'number', minimum: 1, maximum: 5, description: 'keep kennels whose raw average rating is >= minStars' },
                    minCalls: { type: 'number', minimum: 0, description: 'keep kennels with at least this many ranked calls' },
                    limit: {
                        type: 'number',
                        minimum: 1,
                        maximum: 200,
                        description: 'page size. WITHOUT limit the result is a bare array (legacy shape); WITH limit an envelope {kennels,total,offset,limit,hasMore}.',
                    },
                    offset: { type: 'number', minimum: 0 },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                // W17 (8.17): what you may run is listed — run-only kennels included.
                const visible = filterRunnable(result.data ?? [], ctx);
                // Dieselbe Klasse wie REST: stats haengen VOR dem Filtern und Sortieren.
                await deps.kennelStats.attach(visible as any[]);
                const query = ListQuery.from({
                    q: args.search,
                    mine: args.mine ? '1' : undefined,
                    sort: args.sort,
                    dir: args.dir ?? ListQuery.defaultDirFor(args.sort),
                    minStars: args.minStars,
                    minCalls: args.minCalls,
                    usage: args.usage,
                    limit: args.limit,
                    offset: args.offset,
                });
                const page = query.apply(visible, ctx);
                const kennels = page.data.map((k: any) => ({ ...leanKennel(k), stats: k.stats }));
                if (!query.isPaged) return ok(kennels);
                return ok({
                    kennels,
                    total: page.total,
                    offset: query.offset,
                    limit: query.limit,
                    hasMore: query.offset + kennels.length < page.total,
                });
            },
        },
        {
            name: 'get_kennel',
            description:
                'Returns the header of one kennel — identity, dogIds, visibility, owner, frozen, presence flags for the heavy fields (defaultBody/defaultQuery/task/nodes/edges) and `myRights: {run, read, edit, own, frozen}`. Use get_kennel_default_body / _default_query / _task / _layout to fetch those. If you may only run the kennel (run-only), you get {id, lineageId, name, emoji, visibility, frozen, myRights} — no dogIds, no config. Both forms carry `stats` (calls.ranked30d = ranked calls in the last 30 days; rating.avg/count/score, score = Bayes).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(result.error ?? 'not found');
                const access = accessOf(result.data as any, ctx);
                if (access === 'none') return fail(`Kennel ${args.id} not found`);
                const header = access === 'run' ? kennelRunHeader(result.data, ctx) : kennelHeader(result.data, ctx);
                return ok(await deps.kennelStats.attachOne(header));
            },
        },
        {
            name: 'get_kennel_default_body',
            description: 'Returns the kennel\'s defaultBody JSON.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultBody: (result.data as any).defaultBody ?? null });
            },
        },
        {
            name: 'get_kennel_default_query',
            description: 'Returns the kennel\'s defaultQuery map.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultQuery: (result.data as any).defaultQuery ?? {} });
            },
        },
        {
            name: 'get_kennel_task',
            description: 'Returns the kennel\'s task markdown (mission briefing). null if unset.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ task: (result.data as any).task ?? null });
            },
        },
        {
            name: 'get_kennel_layout',
            description:
                'Returns layout annotations (nodes positions + edges comments) for the kennel\'s wave-view canvas.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({
                    nodes: (result.data as any).nodes ?? [],
                    edges: (result.data as any).edges ?? [],
                });
            },
        },
        {
            name: 'get_kennel_versions',
            description:
                'Lists every version of a kennel\'s lineage. Returns slim version refs (id, parentId, createdAt, displayName) — fetch a specific version\'s details via get_kennel(versionId).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const head = await deps.kennelsController.getById(id);
                if (!head.ok || !head.data) return fail(`Kennel ${id} not found`);
                if (!canRead(head.data as any, ctx)) return fail(`Kennel ${id} not found`);
                const versions = await deps.kennelsController.getVersions(id);
                return ok(
                    versions.map((v) => ({
                        id: v.id,
                        parentId: v.parentId ?? null,
                        createdAt: v.createdAt ?? null,
                        displayName: (v.config as any)?.name ?? null,
                    })),
                );
            },
        },
        {
            name: 'create_kennel',
            description:
                'Creates a new kennel. Defaults visibility to "private" and ownerId to the current user. visibility: public | run-only | private — "run-only" lets everyone run it and see its result, but not read its dogs, config or defaults. dogIds is the ordered pack — first entry is the lead. dogIds may reference dogs you can run; a foreign dog you may run but not read must be pinned to a version (its version GUID from list_nodes / get_node_schema) — a lineageId answers "pin_required". **Spuren:** `task` (User-Wunsch) + `nodes[]` (ein Satz pro Hund) — siehe mcp/skill.md § Spuren & Rechtfertigung. Use refresh_kennel_snapshot afterwards to see the run state.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogIds'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'kennel id (becomes lineageId)' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: [...VISIBILITIES] },
                    ...KENNEL_TRACE_FIELDS,
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create kennels');
                const offending = await firstUnreferenceableDog(args.dogIds, ctx, deps);
                if (offending) return fail(offending);
                const pflicht = new PflichtEltern(Array.isArray(args.dogIds) ? args.dogIds : [], deps.baseDogsList);
                const input = applyCreateDefaults(
                    { ...args, dogIds: pflicht.dogIds, nodes: pflicht.kommentiere(args.nodes) },
                    ctx,
                );
                const result = await deps.kennelsController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                const d = result.data as any;
                return ok({
                    ...(pflicht.ergaenzt.length ? { ergaenzt: pflicht.ergaenzt } : {}),
                    id: result.id,
                    lineageId: d?.lineageId,
                    name: d?.name,
                    dogCount: Array.isArray(d?.dogIds) ? d.dogIds.length : 0,
                    visibility: d?.visibility ?? 'public',
                    spuren: spurenReport(d?.task, d?.nodes, d?.dogIds),
                });
            },
        },
        {
            name: 'build_kennel',
            description:
                'Composed one-shot kennel build. Creates a fresh set of Breeds (SerializedDogs / Mimics) AND assembles a kennel that uses them — atomic, with rollback on failure. **Reuse before you write:** first `list_nodes {search: "<keyword>", sort: "proven"}` for every part you need; a fitting, reliable dog (proven badge, reliability >= 0.8) goes in by its lineageId (parentsRequired / extraDogIds) — write only what is missing. If a new dog in `dogs[]` has the same or a very similar name or description as a proven dog you may run, the response carries `hints[]` {dog, lineageId, reason, similarity, suggestion {lineageId, displayName, proven}, message} — advice only, nothing is blocked. **Keep each dog small** — one dog does one nameable thing. Do not put a whole page into a single dog: HTML fragments, the script block, data preparation and composition each get their own entry in `dogs[]`, and the lead composes them. The response reports any dog that has grown too large. **Lead convention:** by default the **LAST** dog in `dogs[]` becomes the lead (renderers / finalizers typically sit at the end of a pipeline). Pass `lead: "<displayName>"` to override. **Spuren:** `task` + `nodes[]` beim Create (Wunsch, kein Vertrag — mcp/skill.md § Spuren & Rechtfertigung). Sibling dogs reference each other by displayName via "@DisplayName" in parentsRequired/Optional; BaseDogs are referenced as bare class names ("QueryRetriever"), and raw lineageId GUIDs pass through unchanged. If `refresh` is true (default), the kennel is hunted once and the lead\'s spoils are previewed in the response. Rollback semantics: any failure during the build deletes every node already created in this call and the kennel row (if any) — no orphans left in the deep. **firstRun.status values:** `ok` (every dog clean), `lead-ok-with-side-errors` (lead returned cleanly but some upstream/side dog errored — public endpoint still serves), `lead-failed` (the lead itself errored — public endpoint is broken), `failed` (the run could not even be observed: worker crash, kennel vanished). `firstRun.leadOk` is a bool shortcut: true means the public endpoint serves the lead\'s payload. '
                + `The public address is \`${KENNEL_PUBLIC_PREFIX}/<kennelId>\` (returned as publicUrl); docs at \`${KENNEL_PUBLIC_PREFIX}/<kennelId>/docs\` (docsUrl), spec at \`${KENNEL_PUBLIC_PREFIX}/<kennelId>/openapi.json\` (openapiUrl).`,
            inputSchema: {
                type: 'object',
                required: ['id', 'dogs'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'kennel id (becomes lineageId)' },
                    name: { type: 'string' },
                    emoji: { type: 'string' },
                    description: { type: 'string' },
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms for the first hunt (run-time-only, NOT persisted). Overrides SLOPDOGS_VM_TIMEOUT_MS (default 10000).',
                    },
                    visibility: { type: 'string', enum: [...VISIBILITIES] },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    ...KENNEL_TRACE_FIELDS,
                    dogs: {
                        type: 'array',
                        description:
                            'SerializedDogs to create. Each yields a fresh lineageId; later dogs can reference earlier siblings via "@<displayName>" in parentsRequired/Optional. Order matters: a referenced sibling must appear earlier in this array. Each dog requires EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell for code with backticks/newlines/template literals.',
                        items: {
                            type: 'object',
                            required: ['displayName'],
                            additionalProperties: false,
                            properties: {
                                displayName: { type: 'string' },
                                tsCode: { type: 'string', description: 'TypeScript body (return yields the spoils). Mutually exclusive with tsCodeBase64.' },
                                tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body — use to avoid JSON-escape hell. Mutually exclusive with tsCode.' },
                                icon: { type: 'string' },
                                description: {
                                    type: 'string',
                                    description: 'One short sentence: what this dog yields. Searchable via list_nodes {search}, returned by get_node.',
                                },
                                lineDocs: {
                                    type: 'array',
                                    description: 'Optional line-range annotations over this dog\'s tsCode (1-based, inclusive). Each {von, bis, text}; retrieve by id + line via get_node_lines.',
                                    items: {
                                        type: 'object',
                                        required: ['von', 'bis', 'text'],
                                        additionalProperties: false,
                                        properties: {
                                            von: { type: 'number', description: 'first line (1-based, inclusive)' },
                                            bis: { type: 'number', description: 'last line (1-based, inclusive)' },
                                            text: { type: 'string', description: 'what this section does' },
                                        },
                                    },
                                },
                                parentsRequired: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description:
                                        'Use bare class names for BaseDogs (e.g. "QueryRetriever" or "base:QueryRetriever"), "@DisplayName" to ref a sibling dog from this build, or a raw lineageId GUID.',
                                },
                                parentsOptional: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Same syntax as parentsRequired.',
                                },
                                imitates: {
                                    type: 'string',
                                    description:
                                        'PactProviderName, e.g. "WeatherQueryProvider" — makes this a MimicDog.',
                                },
                            },
                        },
                    },
                    extraDogIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description:
                            'Additional dogIds to include in the kennel besides the newly-created ones. Typically "base:XxxRetriever" or known lineageIds. Appended after the newly-created lineageIds; never displaces the lead.',
                    },
                    lead: {
                        type: 'string',
                        description:
                            `displayName of the Lead dog (the one whose result is served at ${KENNEL_PUBLIC_PREFIX}/<kennelId>).` + ' Must match one of the entries in `dogs[].displayName`. Default: the LAST dog in `dogs[]` becomes lead, since in a pipeline the renderer/finalizer typically sits at the end of the chain.',
                    },
                    refresh: {
                        type: 'boolean',
                        description:
                            'If true (default), refresh + wait for first run after creating, and include leadResult preview in the response.',
                    },
                },
            },
            // `dogIds` heisst hier `extraDogIds` — die neuen Dogs stehen in `dogs[]`, nicht als ids.
            argHints: { dogIds: 'extraDogIds' },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to build kennels');
                return await buildKennel(args, ctx, deps);
            },
        },
        {
            name: 'update_kennel',
            description:
                'Updates an existing kennel — creates a new version. The owner or a user with the edit right (editor) can update; changing visibility (public | run-only | private) needs the owner; a frozen kennel takes no update until the owner unfreezes it; a landing kennel (listed in the server env LANDING_KENNEL_IDS) takes none from anyone — "locked_landing". Pass only the fields you want to change; others are preserved. Newly added dogIds must be dogs you can run; run-only foreign dogs are pinned to a version. **Spuren:** `task` + `nodes[]` — User-Wunsch festhalten, nicht JSON-Vertrag (mcp/skill.md § Spuren & Rechtfertigung). Use refresh_kennel_snapshot afterwards to see the run state.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: [...VISIBILITIES] },
                    ...KENNEL_TRACE_FIELDS,
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) return fail(kennelMutationRefusal(existing.data, ctx, id));
                const visibilityRefused = visibilityChangeRefused(existing.data, args.visibility, ctx);
                if (visibilityRefused) return fail(visibilityRefused);
                // SECURITY (2026-09-13): validate only dogIds ADDED in this update, so a
                // pre-existing (possibly legacy) reference never blocks a legitimate edit,
                // but a newly injected foreign private dog is rejected.
                if (Array.isArray(args.dogIds)) {
                    const had = new Set<string>(Array.isArray(existing.data.dogIds) ? existing.data.dogIds : []);
                    const added = (args.dogIds as any[]).filter((d) => typeof d === 'string' && !had.has(d));
                    const offendingUpd = await firstUnreferenceableDog(added, ctx, deps);
                    if (offendingUpd) return fail(offendingUpd);
                }
                // Die resultierenden dogIds zaehlen: ohne neue dogIds bleiben die gespeicherten -- auch die
                // bekommen fehlende Pflicht-Eltern, damit ein alter Kennel beim naechsten Update heilt.
                // Fuer nodes gilt dasselbe: mitgeschickte oder gespeicherte bleiben, der Auto-Kommentar kommt dazu.
                const pflicht = new PflichtEltern(
                    Array.isArray(args.dogIds) ? args.dogIds : existing.data.dogIds ?? [],
                    deps.baseDogsList,
                );
                const nodes = pflicht.kommentiere(args.nodes !== undefined ? args.nodes : existing.data.nodes);
                const result = await deps.kennelsController.save({ ...args, id, dogIds: pflicht.dogIds, nodes } as any);
                if (!result.ok) return fail(result.error ?? 'update failed');
                const d = result.data as any;
                return ok({
                    ...(pflicht.ergaenzt.length ? { ergaenzt: pflicht.ergaenzt } : {}),
                    id: result.id,
                    lineageId: d?.lineageId,
                    name: d?.name,
                    dogCount: Array.isArray(d?.dogIds) ? d.dogIds.length : 0,
                    visibility: d?.visibility ?? 'public',
                    spuren: spurenReport(d?.task, d?.nodes, d?.dogIds),
                });
            },
        },
        {
            name: 'delete_kennel',
            description:
                'Deletes a kennel and ALL its versions. The owner or an editor can delete; not while frozen, never a landing kennel (LANDING_KENNEL_IDS, "locked_landing"). Irreversible — every dog dies forever.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) return fail(kennelMutationRefusal(existing.data, ctx, id));
                const result = await deps.kennelsController.delete(id);
                if (!result.ok) return fail(result.error ?? 'delete failed');
                return ok({ deleted: id });
            },
        },
        {
            name: 'run_kennel',
            description:
                'Runs a kennel and returns the full Waves payload — every dog\'s yield, code, vmContext, errors and timing. WARNING: this can be megabytes per call (5–20 MB on rich kennels). Prefer refresh_kennel_snapshot + the get_snapshot_* / get_kennel_snapshot_* tools for granular access. Use run_kennel only when you truly need every dog\'s details in one shot. Dogs you may not read come without code and context; if you may only run the kennel (run-only), you get just its shape: {ok, waves:[{dogCount}], leadResult, durationMs, dogs:[{status}]}. Optional `vmTimeoutMs` overrides the per-dog VM execution budget for this single run (resolution: vmTimeoutMs > SLOPDOGS_VM_TIMEOUT_MS env > 10000ms default) -- not persisted.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                        description: 'query parameters (overrides defaultQuery)',
                    },
                    body: { description: 'body data (overrides defaultBody)' },
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms. Overrides SLOPDOGS_VM_TIMEOUT_MS (default 10000). Run-time-only, not persisted.',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                const access = accessOf(config as any, ctx);
                if (access === 'none') return fail(`Kennel ${args.id} not found`);
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                const vmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                    ? args.vmTimeoutMs
                    : undefined;
                const startedAt = Date.now();
                try {
                    const waves = await deps.kennelRunHandler.runKennel(
                        config, query, body, authCtxToCapabilityCtx(ctx), vmTimeoutMs, { source: 'mcp-run' },
                    );
                    // Kennel-RUN (W3, W17 Stufe 1): only the run's shape and the lead result.
                    if (access === 'run') return ok(kennelRunView(waves, config, Date.now() - startedAt));
                    // SECURITY (2026-09-13): strip code/runtime of nodes this caller may not read.
                    const safeWaves = await redactWavesForCtx(waves, ctx, deps.nodesStore);
                    return ok({ waves: safeWaves, kennelConfig: withMyRights(config as any, ctx) });
                } catch (err: any) {
                    return fail(runErrorText(err, access));
                }
            },
        },
        {
            name: 'execute_kennel',
            description:
                'Runs a kennel and returns ONLY the lead dog\'s result — the public-facing payload, identical to `GET ' + KENNEL_PUBLIC_PREFIX + '/<kennelId>`. Use this when you want the spoils, not the diagnostic. The lead is the first entry in dogIds. Optional `vmTimeoutMs` overrides the per-dog VM execution budget for this run (resolution: vmTimeoutMs > SLOPDOGS_VM_TIMEOUT_MS env > 10000ms default) -- not persisted.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                    },
                    body: {},
                    vmTimeoutMs: {
                        type: 'number',
                        minimum: 1,
                        description: 'Per-run VM timeout in ms. Overrides SLOPDOGS_VM_TIMEOUT_MS (default 10000). Run-time-only, not persisted.',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                // W3: the lead result is the ware — RUN is enough.
                const access = accessOf(config as any, ctx);
                if (access === 'none') return fail(`Kennel ${args.id} not found`);
                const dogIds = config.dogIds ?? [];
                if (dogIds.length === 0) return fail('Kennel has no dogs');
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                const vmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                    ? args.vmTimeoutMs
                    : undefined;
                try {
                    const waves = await deps.kennelRunHandler.runKennel(
                        config, query, body, authCtxToCapabilityCtx(ctx), vmTimeoutMs, { source: 'mcp-execute' },
                    );
                    const lead = findDogInWaves(waves, dogIds[0]);
                    if (lead && lead.result !== undefined) return ok(lead.result);
                    // Kein Ergebnis ist eine gueltige Antwort, kein Schemafehler: `undefined` hatte keinen Text, und
                    // der MCP-Client meldete einen Schemafehler statt der Wahrheit. Ein Lead ohne Rueckgabewert
                    // erscheint gar nicht in den Waves — auch das ist "kein Ergebnis", kein Werkzeugfehler.
                    if (lead?.error) return fail(access === 'read' ? `Lead failed: ${lead.error}` : 'lead_failed');
                    return ok({
                        result: null,
                        hint: 'The lead yielded no result — GET /k/<kennelId> answers with an empty body. Make the lead return a value; get_snapshot_errors shows what went wrong upstream.',
                    });
                } catch (err: any) {
                    return fail(runErrorText(err, access));
                }
            },
        },
    ];
}

function findDogInWaves(waves: any, dogId: string): { result: any; error?: string } | null {
    if (!waves || !Array.isArray(waves)) return null;
    const searchId = dogId.startsWith('base:') ? dogId.substring(5) : dogId;
    for (const wave of waves) {
        const dogs = Array.isArray(wave) ? wave : wave?.dogs;
        if (!dogs) continue;
        for (const d of dogs) {
            if (d.id === searchId || d.lineageId === searchId || d.displayName === searchId || d.name === searchId) {
                // The lead's error must reach the firstRun-status switch — convertSeasonToWaves
                // brands a crashed dog with `error` (from `__error`), and dropping it here makes
                // `leadOk` lie when the lead itself detonated.
                return { result: d.result, error: d.error };
            }
        }
    }
    return null;
}

// ─── build_kennel implementation ────────────────────────────────────────────
// Composed flow: create N nodes, then a kennel that references them, then
// optionally hunt once and return the lead preview. On any failure: rollback.

interface DogSpec {
    displayName: string;
    tsCode?: string;
    tsCodeBase64?: string;
    icon?: string;
    description?: string;
    lineDocs?: ILineDoc[];
    parentsRequired?: string[];
    parentsOptional?: string[];
    imitates?: string;
}

/**
 * Resolve a parent ref against the sibling map.
 * - "@DisplayName" → lineageId of the sibling (must already exist in the map).
 * - "base:X" → passed through unchanged.
 * - bare class name "X" matching a known BaseDog (heuristic: starts uppercase,
 *   no dashes) → passed through unchanged (the runtime resolves it via
 *   baseDogsMap).
 * - raw lineageId GUID → passed through unchanged.
 */
function resolveParentRef(
    ref: string,
    siblingMap: Map<string, string>,
): string {
    if (typeof ref !== 'string' || ref.length === 0) {
        throw new Error(`Invalid parent ref: ${JSON.stringify(ref)}`);
    }
    if (ref.startsWith('@')) {
        const name = ref.substring(1);
        const lineageId = siblingMap.get(name);
        if (!lineageId) {
            throw new Error(
                `Sibling reference "@${name}" not yet built. Order dogs depth-first: a referenced sibling must appear earlier in the dogs array.`,
            );
        }
        return lineageId;
    }
    return ref;
}

function previewLeadResult(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.length > 200 ? value.substring(0, 200) + '…' : value;
    }
    if (value === null || value === undefined) return value;
    try {
        const json = JSON.stringify(value);
        if (json.length <= 200) return value;
        return json.substring(0, 200) + '…';
    } catch {
        return String(value);
    }
}

/**
 * Bewaehrte Dogs, die der Aufrufer ausfuehren darf (Base-Dogs ohne Pacts und gespeicherte Dogs), gegen die
 * frisch gebauten gehalten (DogReuseAdvisor). Rein beratend: scheitert das Nachschlagen, baut build_kennel
 * trotzdem fertig — ohne hints.
 */
async function reuseHintsFor(built: BuiltDog[], ctx: AuthCtx, deps: ToolDeps): Promise<ReuseHint[]> {
    try {
        const listed = await deps.nodesController.listLatest();
        const stored: ReuseCandidate[] = filterRunnable(listed.ok ? listed.data ?? [] : [], ctx).map((d: any) => ({
            id: d.id,
            lineageId: d.lineageId,
            displayName: d.displayName ?? null,
            description: d.description ?? null,
            ownerId: d.ownerId ?? null,
            runOnly: !canRead(d, ctx),
        }));
        const bases: ReuseCandidate[] = deps.baseDogsList
            .filter((b) => b.isPact !== true)
            .map((b) => ({ id: b.id, displayName: b.name, description: b.description ?? null, ownerId: null }));
        const candidates = [...bases, ...stored];
        await deps.dogStats.attach(candidates as any[]);
        return new DogReuseAdvisor().hintsFor(built.filter((b) => b.lineageId), candidates);
    } catch (err) {
        console.warn('[build_kennel] reuse hints skipped:', err instanceof Error ? err.message : err);
        return [];
    }
}

async function buildKennel(
    args: Record<string, any>,
    ctx: AuthCtx,
    deps: ToolDeps,
) {
    const kennelId = typeof args.id === 'string' ? args.id.trim() : '';
    if (!kennelId) return fail('id is required');
    const rawDogs = Array.isArray(args.dogs) ? (args.dogs as DogSpec[]) : null;
    if (!rawDogs || rawDogs.length === 0) {
        return fail('dogs array is required and must be non-empty');
    }

    // Validate displayNames are unique within this build — otherwise @-refs are ambiguous.
    // Also pre-resolve tsCode/tsCodeBase64 per dog (each dog needs exactly one).
    const seenNames = new Set<string>();
    const resolvedCode = new Map<string, string>(); // displayName -> tsCode
    for (const dog of rawDogs) {
        if (!dog || typeof dog.displayName !== 'string' || dog.displayName.length === 0) {
            return fail('every dog must have a non-empty displayName');
        }
        if (seenNames.has(dog.displayName)) {
            return fail(
                `duplicate displayName "${dog.displayName}" in dogs[] — sibling references via "@${dog.displayName}" would be ambiguous`,
            );
        }
        seenNames.add(dog.displayName);
        try {
            const code = resolveTsCode({ tsCode: dog.tsCode, tsCodeBase64: dog.tsCodeBase64 });
            // VOR dem ersten create_node pruefen -- sonst legen wir Nodes an, rollen sie gleich
            // wieder zurueck und der Aufrufer sucht den Fehler in einem 9000-Zeichen-Einzeiler.
            const pruefung = checkSerializedDogCode(code);
            if (!pruefung.ok) {
                return fail(`dogs[].tsCode von "${dog.displayName}" laesst sich nicht uebersetzen: ${pruefung.message}`);
            }
            resolvedCode.set(dog.displayName, code);
        } catch (err: any) {
            return fail(`dog "${dog.displayName}": ${err?.message ?? String(err)}`);
        }
    }

    const extraDogIds: string[] = Array.isArray(args.extraDogIds)
        ? (args.extraDogIds as string[]).filter((s) => typeof s === 'string' && s.length > 0)
        : [];

    // SECURITY (2026-09-13): the dogs created below are owned by the caller, but
    // extraDogIds can point at ARBITRARY existing dogs. Reject any that resolve to a
    // stored node the caller may not read (another user's private dog) before we
    // create anything. Own/public/community/base dogs pass.
    const offendingExtra = await firstUnreferenceableDog(extraDogIds, ctx, deps);
    if (offendingExtra) return fail(`extraDogIds: ${offendingExtra}`);

    // Lead resolution — explicit `lead` overrides the default; default is the LAST dog in dogs[].
    // The Lead is the dog whose result is served at /k/<kennelId>. In a pipeline the renderer
    // sits at the end, so making the last entry the Lead matches the caller's typical intent
    // (and frees them from having to reorder Renderer-before-Producer just to satisfy lead = dogs[0]).
    const leadDisplayName: string | null =
        typeof args.lead === 'string' && args.lead.trim().length > 0 ? args.lead.trim() : null;
    let leadIndex = rawDogs.length - 1; // default: last entry
    if (leadDisplayName) {
        const idx = rawDogs.findIndex((d) => d.displayName === leadDisplayName);
        if (idx < 0) {
            return fail(
                `lead "${leadDisplayName}" does not match any dog in dogs[] (available: ${rawDogs
                    .map((d) => d.displayName)
                    .join(', ')})`,
            );
        }
        leadIndex = idx;
    }

    // Rollback ledger — created node lineageIds, oldest first.
    const createdNodeLineageIds: string[] = [];
    let kennelCreated = false;

    const rollback = async (reason: string): Promise<void> => {
        // Drop the kennel first (so nothing references the dying nodes mid-delete).
        if (kennelCreated) {
            try {
                await deps.kennelsController.delete(kennelId);
            } catch (err) {
                console.error(`[build_kennel rollback] failed to delete kennel ${kennelId}:`, err);
            }
        }
        for (const lineageId of createdNodeLineageIds) {
            try {
                // Delete every version of the node lineage so no orphan rows linger.
                const versions = await deps.nodesController.getVersions(lineageId);
                for (const v of versions) {
                    try {
                        await deps.nodesController.delete(v.id);
                    } catch (err) {
                        console.error(`[build_kennel rollback] failed to delete node version ${v.id}:`, err);
                    }
                }
                // Fallback: try by lineageId directly in case getVersions found nothing.
                if (versions.length === 0) {
                    try { await deps.nodesController.delete(lineageId); } catch { /* swallow */ }
                }
            } catch (err) {
                console.error(`[build_kennel rollback] failed to enumerate versions for ${lineageId}:`, err);
            }
        }
        if (createdNodeLineageIds.length > 0 || kennelCreated) {
            console.error(`[build_kennel] rolled back: ${reason}`);
        }
    };

    try {
        const siblingMap = new Map<string, string>(); // displayName → lineageId
        const builtDogs: Array<{ displayName: string; lineageId: string }> = [];

        for (const spec of rawDogs) {
            const required = Array.isArray(spec.parentsRequired)
                ? spec.parentsRequired.map((ref) => resolveParentRef(ref, siblingMap))
                : [];
            const optional = Array.isArray(spec.parentsOptional)
                ? spec.parentsOptional.map((ref) => resolveParentRef(ref, siblingMap))
                : [];

            const createInput: Record<string, any> = {
                displayName: spec.displayName,
                theRun: resolvedCode.get(spec.displayName) ?? '',
                parentsRequired: required,
                parentsOptional: optional,
            };
            if (typeof spec.icon === 'string') createInput.icon = spec.icon;
            if (typeof spec.description === 'string') createInput.description = spec.description;
            if (spec.lineDocs !== undefined) createInput.lineDocs = sanitizeLineDocs(spec.lineDocs);
            if (typeof spec.imitates === 'string' && spec.imitates.length > 0) {
                createInput.imitates = spec.imitates;
            }

            const withDefaults = applyCreateDefaults(createInput, ctx);
            const created = await deps.nodesController.create(withDefaults);
            if (!created.ok) {
                await rollback(`create_node failed for "${spec.displayName}": ${created.error}`);
                return fail(
                    `create_node failed for "${spec.displayName}": ${created.error ?? 'unknown error'}`,
                );
            }
            const lineageId = (created.data as any)?.lineageId;
            if (!lineageId || typeof lineageId !== 'string') {
                await rollback(`create_node for "${spec.displayName}" returned no lineageId`);
                return fail(`create_node for "${spec.displayName}" returned no lineageId`);
            }
            createdNodeLineageIds.push(lineageId);
            siblingMap.set(spec.displayName, lineageId);
            builtDogs.push({ displayName: spec.displayName, lineageId });
        }

        // Compose the kennel — Lead goes to position 0, the rest in original order.
        // `createdNodeLineageIds` is already in dogs[] order, so we just shift the leadIndex entry.
        const orderedLineageIds: string[] = (() => {
            if (leadIndex === 0) return [...createdNodeLineageIds];
            const reordered: string[] = [];
            reordered.push(createdNodeLineageIds[leadIndex]);
            createdNodeLineageIds.forEach((lid, i) => {
                if (i !== leadIndex) reordered.push(lid);
            });
            return reordered;
        })();
        const pflicht = new PflichtEltern([...orderedLineageIds, ...extraDogIds], deps.baseDogsList);
        const dogIds = pflicht.dogIds;
        const kennelInput: Record<string, any> = {
            id: kennelId,
            dogIds,
        };
        if (typeof args.name === 'string') kennelInput.name = args.name;
        if (typeof args.emoji === 'string') kennelInput.emoji = args.emoji;
        if (typeof args.description === 'string') kennelInput.description = args.description;
        // vmTimeoutMs ist Run-Time-Param und wandert NICHT in den Kennel (Welle 12 Korrektur).
        if (normalizeVisibility(args.visibility)) {
            kennelInput.visibility = args.visibility;
        }
        if (args.defaultQuery && typeof args.defaultQuery === 'object') {
            kennelInput.defaultQuery = args.defaultQuery;
        }
        if (args.defaultBody !== undefined) {
            kennelInput.defaultBody = args.defaultBody;
        }
        if (typeof args.task === 'string') kennelInput.task = args.task;
        // Spuren-ids aufloesen: bei build_kennel entstehen die Hunde ERST in diesem Aufruf -- der
        // Agent kann ihre lineageIds unmoeglich kennen, sein einziger Griff ist der displayName
        // (wie bei parentsRequired auch, dort per "@Name"). Ohne diese Aufloesung landen die
        // Kommentare an ids, die in dogIds nie vorkommen: gespeichert, aber an nichts gehaengt.
        // Alles Unbekannte bleibt unveraendert (lineageId, Version-GUID, base:Name).
        const resolveTraceId = (rawId: unknown): unknown => {
            if (typeof rawId !== 'string' || rawId.length === 0) return rawId;
            const key = rawId.startsWith('@') ? rawId.slice(1) : rawId;
            return siblingMap.get(key) ?? rawId;
        };
        if (Array.isArray(args.nodes)) {
            kennelInput.nodes = args.nodes.map((n: any) =>
                n && typeof n === 'object' ? { ...n, id: resolveTraceId(n.id) } : n,
            );
        }
        if (Array.isArray(args.edges)) {
            kennelInput.edges = args.edges.map((e: any) =>
                e && typeof e === 'object'
                    ? { ...e, fromId: resolveTraceId(e.fromId), toId: resolveTraceId(e.toId) }
                    : e,
            );
        }
        kennelInput.nodes = pflicht.kommentiere(kennelInput.nodes);
        const kennelWithDefaults = applyCreateDefaults(kennelInput, ctx);
        const kennelResult = await deps.kennelsController.create(kennelWithDefaults);
        if (!kennelResult.ok) {
            await rollback(`create_kennel failed: ${kennelResult.error}`);
            return fail(`create_kennel failed: ${kennelResult.error ?? 'unknown error'}`);
        }
        kennelCreated = true;
        const kennelData = kennelResult.data as any;
        const kennelLineageId = kennelData?.lineageId ?? kennelId;

        // Optional first-run preview.
        const refresh = args.refresh !== false;
        // status-Semantik (Welle 11):
        //   'ok'                        — every dog returned cleanly (errorCount === 0)
        //   'lead-ok-with-side-errors'  — lead has no error, but at least one other dog did
        //   'lead-failed'               — the lead itself errored (downstream consumers will see undefined)
        //   'failed'                    — the run could not be observed (worker crash, kennel vanished, ...)
        let firstRun:
            | {
                  status: 'ok' | 'lead-ok-with-side-errors' | 'lead-failed' | 'failed';
                  leadOk: boolean;
                  durationMs: number;
                  errorCount: number;
                  leadDogId: string | null;
                  leadResultPreview: unknown;
                  error?: string;
              }
            | undefined;

        if (refresh) {
            const startedAt = Date.now();
            try {
                const freshConfig = await deps.kennelRunHandler.loadKennelConfig(kennelLineageId);
                if (!freshConfig) {
                    firstRun = {
                        status: 'failed',
                        leadOk: false,
                        durationMs: Date.now() - startedAt,
                        errorCount: 0,
                        leadDogId: null,
                        leadResultPreview: null,
                        error: 'kennel vanished between create and refresh',
                    };
                } else {
                    const mergedQuery = deps.kennelRunHandler.mergeQueryParams(
                        freshConfig.defaultQuery,
                        {},
                    );
                    const buildVmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                        ? args.vmTimeoutMs
                        : undefined;
                    const waves = await deps.kennelRunHandler.runKennel(
                        freshConfig,
                        mergedQuery,
                        freshConfig.defaultBody,
                        authCtxToCapabilityCtx(ctx),
                        buildVmTimeoutMs,
                        { source: 'mcp-build' },
                    );

                    // Cache the snapshot so subsequent get_snapshot_* calls work directly — for the
                    // builder: the run carried his capabilities, the snapshot is his.
                    deps.snapshotCache.startJob(
                        kennelLineageId,
                        KennelSnapshotCache.viewerOf(ctx),
                        freshConfig.id,
                        mergedQuery,
                        freshConfig.defaultBody,
                        ctx.user?.id ?? null,
                    );

                    const leadRef = freshConfig.dogIds?.[0];
                    const lead = leadRef ? findDogInWaves(waves, leadRef) : null;
                    const flat: any[] = (waves as any[]).flat();
                    const errorCount = flat.filter((d) => d?.error).length;
                    const leadOk = !!lead && !(lead as any)?.error;

                    deps.snapshotCache.markOk(kennelLineageId, KennelSnapshotCache.viewerOf(ctx), {
                        waves: waves as any,
                        kennelConfig: freshConfig,
                        leadDogId: lead ? leadRef ?? undefined : undefined,
                        leadResult: lead?.result,
                    });

                    let status: 'ok' | 'lead-ok-with-side-errors' | 'lead-failed';
                    if (errorCount === 0) {
                        status = 'ok';
                    } else if (leadOk) {
                        status = 'lead-ok-with-side-errors';
                    } else {
                        status = 'lead-failed';
                    }

                    firstRun = {
                        status,
                        leadOk,
                        durationMs: Date.now() - startedAt,
                        errorCount,
                        leadDogId: leadRef ?? null,
                        leadResultPreview: previewLeadResult(lead?.result),
                    };
                }
            } catch (err: any) {
                // The kennel was created successfully — a failed first hunt is
                // not a build failure, it's just the dogs telling us the code
                // needs work. Surface it, don't roll back.
                deps.snapshotCache.markFailed(kennelLineageId, KennelSnapshotCache.viewerOf(ctx), err?.message ?? String(err));
                firstRun = {
                    status: 'failed',
                    leadOk: false,
                    durationMs: Date.now() - startedAt,
                    errorCount: 0,
                    leadDogId: null,
                    leadResultPreview: null,
                    error: err?.message ?? String(err),
                };
            }
        }

        // Waechter: build_kennel legt die Dogs selbst an (nicht ueber das create_node-Tool),
        // also wird hier geprueft. Rein beratend -- der Bau laeuft, der Hinweis steht in der Antwort.
        const hinweise: string[] = [];
        for (const spec of rawDogs) {
            const code = resolvedCode.get(spec.displayName);
            for (const h of codeHinweise(code, spec)) {
                hinweise.push(`${spec.displayName}: ${h}`);
            }
        }

        // Wiederverwenden vor Schreiben (Feature-Runde, 10-0: "wiederverwenden wenn gefunden und toll"):
        // gleicht ein neuer Dog einem bewaehrten, ausfuehrbaren, steht dessen lineageId als Vorschlag da.
        const hints = await reuseHintsFor(
            rawDogs.map((spec) => ({ displayName: spec.displayName, lineageId: siblingMap.get(spec.displayName) ?? '', description: spec.description ?? null })),
            ctx,
            deps,
        );

        // Hinweise ZUERST. Sie standen bisher hinter der dogs-Liste und gingen damit in jeder
        // gekuerzten Ansicht unter -- ein Log, das Tool-Antworten beschneidet, zeigte nur noch
        // lineageIds. Was gelesen werden soll, gehoert nach oben.
        return ok({
            ...(hinweise.length ? { hinweise } : {}),
            ...(hints.length ? { hints } : {}),
            ...(pflicht.ergaenzt.length ? { ergaenzt: pflicht.ergaenzt } : {}),
            kennelId,
            kennelLineageId,
            publicUrl: publicKennelPath(kennelId),
            docsUrl: publicKennelDocsPath(kennelId),
            openapiUrl: publicKennelOpenApiPath(kennelId),
            runUrl: `/api/kennels/${kennelId}/run`,
            dogs: builtDogs,
            spuren: spurenReport(kennelInput.task, kennelInput.nodes, dogIds),
            ...(firstRun ? { firstRun } : {}),
        });
    } catch (err: any) {
        await rollback(`unexpected error: ${err?.message ?? String(err)}`);
        return fail(`build_kennel failed: ${err?.message ?? String(err)}`);
    }
}
