// Snapshot-Tools — die Karte zur eingefrorenen Beute.
// Ein `refresh_kennel_snapshot` setzt die Hoehle, alle anderen Tools lesen aus ihr.
// Volle Waves werden niemals in einem Aufruf zurueckgegeben — die Inspektion ist granular.

import { accessOf, type Access } from '../auth/visibility';
import { type ToolDef, type ToolDeps, ok, fail } from './types';
import type { AuthCtx } from '../auth/middleware';
import type { NodeEntry, Waves, ReadTrackingEntry } from '../../services/WavesConverter';
import type { KennelSnapshotEntry } from '../snapshots/types';
import { KennelSnapshotCache } from '../snapshots/KennelSnapshotCache';
import type { IKennelConfig } from '@slopdogs/core';
import { REDACTED_TEXT, redactWavesForCtx } from '../../services/wavesRedaction';

/**
 * Inline MCP-AuthCtx -> VmGlobalCapabilityContext adapter (Welle 9 hotfix).
 * Duplicated from kennels.ts so snapshots.ts doesn't depend on a method that
 * may be missing from a stale-compiled KennelRunHandler at runtime.
 */
function authCtxToCapabilityCtx(ctx: AuthCtx | undefined | null):
    { userId: string | null; isSuperUser: boolean } | undefined {
    if (!ctx) return undefined;
    return {
        userId: ctx.user?.id ?? null,
        isSuperUser: !!ctx.isSuperUser,
    };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Suche einen Dog in den Waves ueber id/lineageId/displayName/name. */
function findDogInWaves(waves: Waves, dogId: string): NodeEntry | undefined {
    const searchId = dogId.startsWith('base:') ? dogId.substring(5) : dogId;
    for (const wave of waves) {
        for (const dog of wave) {
            if (
                dog.id === searchId ||
                dog.id === dogId ||
                dog.lineageId === searchId ||
                dog.lineageId === dogId ||
                dog.displayName === searchId ||
                dog.name === searchId
            ) {
                return dog;
            }
        }
    }
    return undefined;
}

/** Wave-Index eines NodeEntries. -1 wenn nicht gefunden. */
function waveIndexOf(waves: Waves, nodeId: string): number {
    for (let i = 0; i < waves.length; i++) {
        if (waves[i].some((d) => d.id === nodeId)) return i;
    }
    return -1;
}

/** Lead-Dog-Id aufloesen — erster dogIds-Eintrag, gemapt auf NodeEntry.id. */
function resolveLeadDogId(waves: Waves, config: IKennelConfig): string | undefined {
    const leadRef = config.dogIds?.[0];
    if (!leadRef) return undefined;
    const node = findDogInWaves(waves, leadRef);
    return node?.id;
}

/** Lead-Beute aus den Waves vorbeproben. */
function extractLeadResult(waves: Waves, config: IKennelConfig): unknown {
    const leadRef = config.dogIds?.[0];
    if (!leadRef) return undefined;
    const node = findDogInWaves(waves, leadRef);
    return node?.result;
}

interface VisibleSnapshot {
    snapshot: KennelSnapshotEntry;
    currentVersionId: string;
    /** READ: je Dog redigiert wie /run. RUN: nur Kopf und Lead-Ergebnis (W17 Stufe 1). */
    access: Access;
}

/**
 * Stale-Marker, der vom Caller im success-Pfad gerendert wird.
 *
 * Welle 8 + 11: Stale ist KEIN Tool-Failure, sondern ein normaler Zustand der
 * Snapshot-Cache-Schicht. Wir geben deshalb `ok(marker)` zurueck -- nicht
 * `fail(JSON.stringify(marker))`. `ok()` setzt `isError` NICHT, der MCP-Client
 * sieht ein gewoehnliches Success-Payload mit `stale: true` als Marker und
 * triggert keine Retry-Logik. Aufrufer-Pattern:
 *
 *   const gate = await loadVisibleSnapshot(id, ctx, deps);
 *   if (!gate.ok) return gate.result; // bei stale: ein ok() mit Marker; bei fail: ein fail()
 *
 * loadVisibleSnapshot kapselt die Unterscheidung; Aufrufer brauchen nichts
 * Stale-Spezifisches zu tun. Das `stale: true`-Discriminant im Result-Tuple
 * ist nur dokumentarisch -- der Wert sitzt im `result`-Feld als `ok(marker)`.
 */
export interface StaleSnapshotMarker {
    stale: true;
    snapshotVersionId: string;
    currentVersionId: string;
    hint: 'call refresh_kennel_snapshot';
}

/**
 * Laed Snapshot + prueft Visibility + Stale.
 * - `not-found` / `forbidden` / `no-snapshot` -> fail() (echte Fehler)
 * - `stale` -> ok(StaleSnapshotMarker), kein isError
 * - sonst -> die Visible-Snapshot-Daten, je Dog redigiert fuer DIESEN Aufrufer
 *
 * Einzige Tuer zu den Snapshot-Waves: jedes Werkzeug, das aus dem Snapshot liest,
 * geht hier durch und sieht genau das, was `/api/kennels/:id/run` demselben
 * Aufrufer zeigen wuerde. Kennel-Gate RUN (W4); ein RUN-Leser kommt nur durch, wo das
 * Werkzeug `runOnly: true` erlaubt (Kopf, Lead-Ergebnis) — alles je Dog braucht READ.
 * Gelesen wird nur der eigene Snapshot (KennelSnapshotCache.viewerOf).
 */
async function loadVisibleSnapshot(
    id: string,
    ctx: Parameters<ToolDef['handler']>[1],
    deps: ToolDeps,
    options: { runOnly?: boolean } = {},
): Promise<
    | { ok: true; data: VisibleSnapshot }
    | { ok: false; result: ReturnType<typeof fail> }
    | { ok: false; stale: true; result: ReturnType<typeof ok> }
> {
    const current = await deps.kennelsController.getById(id);
    if (!current.ok || !current.data) {
        return { ok: false, result: fail(`Kennel ${id} not found`) };
    }
    const access = accessOf(current.data as any, ctx);
    if (access === 'none') {
        return { ok: false, result: fail(`Kennel ${id} not found`) };
    }
    if (access === 'run' && !options.runOnly) {
        return { ok: false, result: fail(`Kennel ${id}: run-only for you — per-dog inspection needs the read right`) };
    }

    const lineageId = (current.data as any).lineageId ?? current.data.id;
    const snapshot = deps.snapshotCache.get(lineageId, KennelSnapshotCache.viewerOf(ctx));
    if (!snapshot) {
        return {
            ok: false,
            result: fail('no snapshot — call refresh_kennel_snapshot first'),
        };
    }
    const currentVersionId = current.data.id;
    if (snapshot.kennelVersionId !== currentVersionId) {
        const marker: StaleSnapshotMarker = {
            stale: true,
            snapshotVersionId: snapshot.kennelVersionId,
            currentVersionId,
            hint: 'call refresh_kennel_snapshot',
        };
        return { ok: false, stale: true, result: ok(marker) };
    }
    if (access === 'run') {
        return { ok: true, data: { snapshot, currentVersionId, access } };
    }
    return { ok: true, data: { snapshot: await redactSnapshotForCtx(snapshot, ctx, deps), currentVersionId, access } };
}

/**
 * Die Sicht eines Aufrufers auf einen Snapshot. Redaktion beim LESEN, nicht beim
 * Cachen: der Cache haelt rohe Waves; seit P3.5 liest jeder nur seinen eigenen Snapshot,
 * aber die Rechte je Dog koennen sich seit dem Lauf geaendert haben — also wird beim Lesen
 * redigiert. Der Cache-Eintrag selbst bleibt unberuehrt — redactWavesForCtx liefert Kopien.
 * Ist der Lead redigiert, ist es auch die vorbeprobte Lead-Beute.
 */
async function redactSnapshotForCtx(
    snapshot: KennelSnapshotEntry,
    ctx: Parameters<ToolDef['handler']>[1],
    deps: ToolDeps,
): Promise<KennelSnapshotEntry> {
    if (!snapshot.waves) return snapshot;
    const waves = await redactWavesForCtx(snapshot.waves, ctx, deps.nodesStore);
    if (waves === snapshot.waves) return snapshot;
    const lead = snapshot.leadDogId
        ? waves.flat().find((d) => d.id === snapshot.leadDogId)
        : undefined;
    const leadResult = lead && (lead as any).redacted ? lead.result : snapshot.leadResult;
    return { ...snapshot, waves, leadResult };
}

/** Slim-Projection eines NodeEntry fuer Listen. */
function slimDog(dog: NodeEntry, waveIndex: number) {
    return {
        id: dog.id,
        lineageId: dog.lineageId,
        displayName: dog.displayName,
        name: dog.name,
        waveIndex,
        hasError: !!dog.error,
    };
}

/**
 * Der Kopf eines Snapshots. Fuer RUN-Leser ohne Lead-Identitaet und ohne Fehlertext (W13) —
 * Zaehler, Status und Zeiten sind die Form des Laufs, die kennelRunView auch zeigt.
 */
function summaryHeader(snapshot: KennelSnapshotEntry, access: Access = 'read') {
    const waves = snapshot.waves ?? [];
    const flat = waves.flat();
    const readable = access === 'read';
    return {
        kennelLineageId: snapshot.kennelLineageId,
        kennelVersionId: snapshot.kennelVersionId,
        status: snapshot.status,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        durationMs: snapshot.durationMs,
        waveCount: waves.length,
        dogCount: flat.length,
        errorCount: flat.filter((d) => d.error).length,
        leadDogId: readable ? snapshot.leadDogId : undefined,
        errorMessage: readable ? snapshot.errorMessage : snapshot.errorMessage ? REDACTED_TEXT : undefined,
    };
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export function getSnapshotTools(): ToolDef[] {
    return [
        // ── PHASE 1 ─────────────────────────────────────────────────────────

        {
            name: 'refresh_kennel_snapshot',
            description:
                'Runs a kennel asynchronously and stores the full Waves in-memory as a snapshot, keyed by kennelLineageId and by you: a run carries your capabilities (your jsonStore), so every caller reads only his own snapshot. The run right is enough to refresh; per-dog inspection needs the read right. Returns immediately with status=running. Use wait_for_kennel_snapshot or get_kennel_snapshot to observe completion. Prefer this over run_kennel for any inspection workflow — subsequent get_snapshot_* tools read from the cached run. Optional `vmTimeoutMs` overrides the per-dog VM execution budget for this run (resolution: vmTimeoutMs > SLOPDOGS_VM_TIMEOUT_MS env > 10000ms default) -- not persisted.',
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
                const id = String(args.id);
                const current = await deps.kennelsController.getById(id);
                if (!current.ok || !current.data) return fail(`Kennel ${id} not found`);
                const access = accessOf(current.data as any, ctx);
                if (access === 'none') return fail(`Kennel ${id} not found`);

                const config = current.data;
                const lineageId = (config as any).lineageId ?? config.id;
                const kennelVersionId = config.id;
                const viewer = KennelSnapshotCache.viewerOf(ctx);

                const existing = deps.snapshotCache.get(lineageId, viewer);
                if (existing && existing.status === 'running') {
                    return fail('snapshot run already in flight');
                }

                const query = (args.query as Record<string, string> | undefined) ?? undefined;
                const body = args.body;
                const vmTimeoutMs = typeof args.vmTimeoutMs === 'number' && args.vmTimeoutMs > 0
                    ? args.vmTimeoutMs
                    : undefined;
                deps.snapshotCache.startJob(
                    lineageId,
                    viewer,
                    kennelVersionId,
                    query,
                    body,
                    ctx.user?.id ?? null,
                );

                // Async hunt — return now, let the dogs run.
                void (async () => {
                    try {
                        const freshConfig = await deps.kennelRunHandler.loadKennelConfig(id);
                        if (!freshConfig) {
                            deps.snapshotCache.markFailed(lineageId, viewer, `Kennel ${id} not found`);
                            return;
                        }
                        const mergedQuery = deps.kennelRunHandler.mergeQueryParams(
                            freshConfig.defaultQuery,
                            query ?? {},
                        );
                        const effectiveBody = body !== undefined ? body : freshConfig.defaultBody;
                        const waves = await deps.kennelRunHandler.runKennel(
                            freshConfig,
                            mergedQuery,
                            effectiveBody,
                            authCtxToCapabilityCtx(ctx),
                            vmTimeoutMs,
                            { source: 'mcp-snapshot' },
                        );
                        const leadDogId = resolveLeadDogId(waves, freshConfig);
                        const leadResult = extractLeadResult(waves, freshConfig);
                        deps.snapshotCache.markOk(lineageId, viewer, {
                            waves,
                            kennelConfig: freshConfig,
                            leadDogId,
                            leadResult,
                        });
                    } catch (err: any) {
                        deps.snapshotCache.markFailed(lineageId, viewer, err?.message ?? String(err));
                    }
                })();

                return ok({
                    jobId: lineageId,
                    kennelLineageId: lineageId,
                    kennelVersionId,
                    status: 'running',
                });
            },
        },

        {
            name: 'get_kennel_snapshot',
            description:
                'Returns the snapshot header (status, timing, counts, lead) for a kennel. Does NOT return waves payload — use the granular get_snapshot_* tools for that. Fails if no snapshot exists. If the snapshot is stale (kennel version changed), returns `{stale:true, snapshotVersionId, currentVersionId, hint:"call refresh_kennel_snapshot"}` in the result (no isError) — refresh first, then re-query.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps, { runOnly: true });
                if (!gate.ok) return gate.result;
                return ok(summaryHeader(gate.data.snapshot, gate.data.access));
            },
        },

        {
            name: 'wait_for_kennel_snapshot',
            description:
                'Polls the snapshot until status leaves "running" or timeoutMs elapses (default 30000ms). Returns the snapshot header; sets timedOut=true if the wait expired. If the snapshot is stale (kennel version changed during the wait), returns `{stale:true, snapshotVersionId, currentVersionId, hint:"call refresh_kennel_snapshot"}` (no isError) — refresh first.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    timeoutMs: { type: 'number', description: 'default 30000' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const timeoutMs = typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000;
                const pollMs = 200;
                const deadline = Date.now() + timeoutMs;

                // Visibility gate first (early fail). Gate RUN: the header is the run's shape.
                const current = await deps.kennelsController.getById(id);
                if (!current.ok || !current.data) return fail(`Kennel ${id} not found`);
                const access = accessOf(current.data as any, ctx);
                if (access === 'none') return fail(`Kennel ${id} not found`);
                const lineageId = (current.data as any).lineageId ?? current.data.id;
                const currentVersionId = current.data.id;
                const viewer = KennelSnapshotCache.viewerOf(ctx);

                while (Date.now() < deadline) {
                    const snap = deps.snapshotCache.get(lineageId, viewer);
                    if (snap && snap.status !== 'running') {
                        if (snap.kennelVersionId !== currentVersionId) {
                            // Stale: ok() statt fail() -- Marker im Success-Payload,
                            // damit MCP-Clients keinen automatischen Retry triggern.
                            const marker: StaleSnapshotMarker = {
                                stale: true,
                                snapshotVersionId: snap.kennelVersionId,
                                currentVersionId,
                                hint: 'call refresh_kennel_snapshot',
                            };
                            return ok(marker);
                        }
                        return ok(summaryHeader(snap, access));
                    }
                    if (!snap) {
                        return fail('no snapshot — call refresh_kennel_snapshot first');
                    }
                    await new Promise((r) => setTimeout(r, pollMs));
                }

                const snap = deps.snapshotCache.get(lineageId, viewer);
                if (!snap) return fail('no snapshot — call refresh_kennel_snapshot first');
                return ok({ ...summaryHeader(snap, access), timedOut: true });
            },
        },

        // ── PHASE 3 — per-dog inspection ────────────────────────────────────

        {
            name: 'get_kennel_snapshot_summary',
            description:
                'Returns the snapshot map: header counts plus a flat dog index with (id, lineageId, displayName, name, type, waveIndex, hasError, onLeadPath, mimic). No code, no vmContext, no result. Use this to navigate before drilling into a specific dog.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const snap = gate.data.snapshot;
                const waves = snap.waves ?? [];
                const dogs: Array<Record<string, unknown>> = [];
                waves.forEach((wave, idx) => {
                    for (const d of wave) {
                        dogs.push({
                            id: d.id,
                            lineageId: d.lineageId,
                            displayName: d.displayName,
                            name: d.name,
                            type: d.editable ? 'SerializedDog' : 'BaseDog',
                            waveIndex: idx,
                            hasError: !!d.error,
                            onLeadPath: d.onLeadDependencyPath,
                            mimic: d.mimic,
                        });
                    }
                });
                return ok({
                    kennelLineageId: snap.kennelLineageId,
                    kennelVersionId: snap.kennelVersionId,
                    takenAt: snap.finishedAt ?? snap.startedAt,
                    status: snap.status,
                    leadDogId: snap.leadDogId,
                    dogCount: dogs.length,
                    waveCount: waves.length,
                    errorCount: dogs.filter((d) => d.hasError).length,
                    dogs,
                });
            },
        },

        {
            name: 'get_kennel_snapshot_lead_result',
            description:
                'Returns the snapshot\'s lead result — the same payload that the public GET /k/<kennelId> endpoint yields. Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                // Das Lead-Ergebnis ist die Ware (/k/:id) — RUN darf es sehen, nur nicht, wer es liefert.
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps, { runOnly: true });
                if (!gate.ok) return gate.result;
                const snap = gate.data.snapshot;
                const leadDogId = gate.data.access === 'read' ? snap.leadDogId : undefined;
                return ok({ leadDogId, leadResult: snap.leadResult });
            },
        },

        {
            name: 'get_snapshot_dog',
            description:
                'Returns the metadata header of one dog in the snapshot — identity, type, flags, parents counts. No result, no code, no vmContext. Drill into those with the dedicated get_snapshot_dog_* tools. Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    dogId: { type: 'string' },
                },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const snap = gate.data.snapshot;
                const waves = snap.waves ?? [];
                const dog = findDogInWaves(waves, String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({
                    id: dog.id,
                    lineageId: dog.lineageId ?? null,
                    displayName: dog.displayName ?? null,
                    name: dog.name,
                    icon: dog.icon ?? null,
                    description: dog.description ?? null,
                    type: dog.editable ? 'SerializedDog' : 'BaseDog',
                    waveIndex: waveIndexOf(waves, dog.id),
                    hasResult: dog.result !== undefined,
                    hasError: !!dog.error,
                    parentsRequired: (dog.parentsRequired ?? []).length,
                    parentsOptional: (dog.parentsOptional ?? []).length,
                    deletable: dog.deletable,
                    editable: dog.editable,
                    mimic: dog.mimic,
                    onLeadPath: dog.onLeadDependencyPath ?? null,
                    vmExpectedReturnTypeName: dog.vmExpectedReturnTypeName ?? null,
                    isCurrentLead: dog.id === snap.leadDogId,
                });
            },
        },

        {
            name: 'get_snapshot_dog_result',
            description: 'Returns only the dog\'s result payload from the snapshot. Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({ result: dog.result });
            },
        },

        {
            name: 'get_snapshot_dog_code',
            description:
                'Returns the dog\'s TypeScript source (codeTs). null for BaseDogs (they are hardcoded). Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({ codeTs: dog.codeTs ?? null });
            },
        },

        {
            name: 'get_snapshot_dog_typedef',
            description:
                'Returns the dog\'s VM type definition library and expected return-type alias — schema only, no runtime data. Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({
                    vmContextTypeDef: dog.vmContextTypeDef ?? null,
                    vmExpectedReturnTypeName: dog.vmExpectedReturnTypeName ?? null,
                });
            },
        },

        {
            name: 'get_snapshot_dog_vmcontext',
            description:
                'Returns the full VM scope (vmContext) plus its type definition. Expensive — contains every parent yield this dog could read. Use sparingly. Dogs you may not read are redacted (no code, no context, no result), exactly like /api/kennels/:id/run.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({
                    vmContext: dog.vmContext ?? null,
                    vmContextTypeDef: dog.vmContextTypeDef ?? null,
                });
            },
        },

        {
            name: 'get_snapshot_dog_parents',
            description:
                'Returns the dog\'s declared parents — required and optional refs (storageId, lineageId or BaseDog name).',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({
                    parentsRequired: dog.parentsRequired ?? [],
                    parentsOptional: dog.parentsOptional ?? [],
                });
            },
        },

        {
            name: 'get_snapshot_dog_error',
            description: 'Returns the dog\'s error message if it failed; null otherwise.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({ error: dog.error ?? null });
            },
        },

        // ── PHASE 4 — dataflow + graph ──────────────────────────────────────

        {
            name: 'get_snapshot_dog_read_from',
            description:
                'Returns which sources this dog read from during the run — ReadTrackingEntry[] with waveIndex, sourceInstanceName, propertyPath.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({ readFrom: dog.readFrom ?? [] });
            },
        },

        {
            name: 'get_snapshot_dog_read_by',
            description:
                'Returns which downstream readers consumed this dog\'s yield — ReadTrackingEntry[] with waveIndex, readerInstanceName, propertyPath.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const dog = findDogInWaves(gate.data.snapshot.waves ?? [], String(args.dogId));
                if (!dog) return fail(`Dog ${args.dogId} not in snapshot`);
                return ok({ readBy: dog.readBy ?? [] });
            },
        },

        {
            name: 'get_snapshot_lead_dependency_path',
            description:
                'Returns the NodeEntry.ids of every dog on the transitive lead-dependency path (lead itself + ancestors that fed it). Empty if not annotated.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const waves = gate.data.snapshot.waves ?? [];
                const dogIds = waves.flat()
                    .filter((d) => d.onLeadDependencyPath === true)
                    .map((d) => d.id);
                return ok({ dogIds });
            },
        },

        {
            name: 'get_snapshot_errors',
            description:
                'Lists every dog that errored in the snapshot — minimal shape per entry (dogId, lineageId, displayName, name, error, waveIndex).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const waves = gate.data.snapshot.waves ?? [];
                const errors: Array<Record<string, unknown>> = [];
                waves.forEach((wave, idx) => {
                    for (const d of wave) {
                        if (!d.error) continue;
                        errors.push({
                            dogId: d.id,
                            lineageId: d.lineageId,
                            displayName: d.displayName,
                            name: d.name,
                            error: d.error,
                            waveIndex: idx,
                        });
                    }
                });
                return ok(errors);
            },
        },

        {
            name: 'list_snapshot_waves',
            description:
                'Returns only the tide structure: per wave, the dogs (id, lineageId, displayName, name, hasError). No code, no result, no vmContext.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const waves = gate.data.snapshot.waves ?? [];
                const out = waves.map((wave, idx) => ({
                    waveIndex: idx,
                    dogIds: wave.map((d) => ({
                        id: d.id,
                        lineageId: d.lineageId,
                        displayName: d.displayName,
                        name: d.name,
                        hasError: !!d.error,
                    })),
                }));
                return ok(out);
            },
        },

        {
            name: 'get_snapshot_graph',
            description:
                'Returns a dependency graph: dogs (slim) + edges (from, to, kind=required|optional) resolved from parents. Use for visualization or topological reasoning.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const waves = gate.data.snapshot.waves ?? [];
                const flat = waves.flat();
                const dogs = waves.flatMap((wave, idx) =>
                    wave.map((d) => ({
                        id: d.id,
                        displayName: d.displayName,
                        waveIndex: idx,
                        onLeadPath: d.onLeadDependencyPath,
                        hasError: !!d.error,
                    })),
                );
                const edges: Array<{ from: string; to: string; kind: 'required' | 'optional' }> = [];
                for (const d of flat) {
                    for (const ref of d.parentsRequired ?? []) {
                        const parent = findDogInWaves(waves, ref);
                        if (parent) edges.push({ from: parent.id, to: d.id, kind: 'required' });
                    }
                    for (const ref of d.parentsOptional ?? []) {
                        const parent = findDogInWaves(waves, ref);
                        if (parent) edges.push({ from: parent.id, to: d.id, kind: 'optional' });
                    }
                }
                return ok({ dogs, edges });
            },
        },

        {
            name: 'get_snapshot_layout',
            description:
                'Pass-through of the kennel\'s node/edge layout annotations as captured at run time (position hints, comments).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const cfg = gate.data.snapshot.kennelConfig;
                return ok({
                    nodes: cfg?.nodes ?? [],
                    edges: cfg?.edges ?? [],
                });
            },
        },

        // ── PHASE 5 — convenience ───────────────────────────────────────────

        {
            name: 'find_snapshot_dogs',
            description:
                'Filters the snapshot\'s dogs by a where-clause. Combine any of: hasError, onLeadPath, mimic, displayNameContains (case-insensitive substring), type ("BaseDog"|"SerializedDog"). Returns slim dog refs.',
            inputSchema: {
                type: 'object',
                required: ['id', 'where'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    where: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            hasError: { type: 'boolean' },
                            onLeadPath: { type: 'boolean' },
                            mimic: { type: 'boolean' },
                            displayNameContains: { type: 'string' },
                            type: { type: 'string', enum: ['BaseDog', 'SerializedDog'] },
                        },
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const where = (args.where as Record<string, unknown>) ?? {};
                const needle = typeof where.displayNameContains === 'string'
                    ? where.displayNameContains.toLowerCase()
                    : null;
                const waves = gate.data.snapshot.waves ?? [];
                const out: Array<Record<string, unknown>> = [];
                waves.forEach((wave, idx) => {
                    for (const d of wave) {
                        const dogType = d.editable ? 'SerializedDog' : 'BaseDog';
                        if (typeof where.hasError === 'boolean' && !!d.error !== where.hasError) continue;
                        if (typeof where.onLeadPath === 'boolean' && !!d.onLeadDependencyPath !== where.onLeadPath) continue;
                        if (typeof where.mimic === 'boolean' && d.mimic !== where.mimic) continue;
                        if (typeof where.type === 'string' && dogType !== where.type) continue;
                        if (needle) {
                            const hay = (d.displayName ?? d.name ?? '').toLowerCase();
                            if (!hay.includes(needle)) continue;
                        }
                        out.push({
                            id: d.id,
                            lineageId: d.lineageId,
                            displayName: d.displayName,
                            name: d.name,
                            waveIndex: idx,
                        });
                    }
                });
                return ok(out);
            },
        },

        {
            name: 'get_snapshot_dog_chain',
            description:
                'Walks the dog\'s ancestry transitively (BFS over parentsRequired/parentsOptional) up to the roots. Returns ordered ancestors with depth (0 = the dog itself).',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogId'],
                additionalProperties: false,
                properties: { id: { type: 'string' }, dogId: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const gate = await loadVisibleSnapshot(String(args.id), ctx, deps);
                if (!gate.ok) return gate.result;
                const waves = gate.data.snapshot.waves ?? [];
                const start = findDogInWaves(waves, String(args.dogId));
                if (!start) return fail(`Dog ${args.dogId} not in snapshot`);

                const out: Array<{ id: string; displayName?: string; waveIndex: number; depth: number }> = [];
                const seen = new Set<string>();
                const queue: Array<{ node: NodeEntry; depth: number }> = [{ node: start, depth: 0 }];
                while (queue.length > 0) {
                    const { node, depth } = queue.shift()!;
                    if (seen.has(node.id)) continue;
                    seen.add(node.id);
                    out.push({
                        id: node.id,
                        displayName: node.displayName,
                        waveIndex: waveIndexOf(waves, node.id),
                        depth,
                    });
                    const refs = [...(node.parentsRequired ?? []), ...(node.parentsOptional ?? [])];
                    for (const ref of refs) {
                        const parent = findDogInWaves(waves, ref);
                        if (parent && !seen.has(parent.id)) {
                            queue.push({ node: parent, depth: depth + 1 });
                        }
                    }
                }
                return ok(out);
            },
        },
    ];
}

// Re-export helper so other modules may reuse (kennels.ts execute_kennel could
// switch, but for now we keep its private copy to avoid a refactor of that tool).
export { findDogInWaves };
// Type re-exports for callers who want strong types on snapshot ReadTracking lists.
export type { ReadTrackingEntry };
