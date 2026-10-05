// Meta tools — README, health, describe_tool.
// get_readme returns the canonical README that describes the kennel-building workflow,
// the available pacts, the API surface. Use this to ground yourself before issuing
// commands; the README is the source of truth.
//
// describe_tool returns the full long-form description + input schema of any tool.
// tools/list ships only short one-liner descriptions (Welle 11 token diet); when the
// LLM needs the canonical long form, it calls describe_tool(name).

import { promises as fs } from 'fs';
import path from 'path';
import v8 from 'v8';
import { DogWorkerGate } from '@slopdogs/core';
import { type ToolDef, type ToolDeps, ok, fail } from './types';

const MB = 1024 * 1024;
const toMb = (bytes: number): number => Math.round((bytes / MB) * 10) / 10;

/**
 * Das Messgeraet hinter health_check: Speicher des Prozesses, Zustand des Dog-Tors (Slots, Isolate,
 * Waechter) und der Lauf-Zulassung (Toepfe, Quellen). Nur Zahlen — keine Quell-IPs, keine User-IDs,
 * keine Dog-Namen.
 */
class RuntimeHealth {
    static memory(deps: ToolDeps): Record<string, unknown> {
        const usage = process.memoryUsage();
        const gate = DogWorkerGate.shared.stats();
        return {
            rssMb: toMb(usage.rss),
            heapUsedMb: toMb(usage.heapUsed),
            heapTotalMb: toMb(usage.heapTotal),
            externalMb: toMb(usage.external),
            arrayBuffersMb: toMb(usage.arrayBuffers ?? 0),
            heapSizeLimitMb: toMb(v8.getHeapStatistics().heap_size_limit),
            guard: {
                enabled: gate.memoryGuardEnabled,
                limitMb: gate.memoryLimitMb,
                softLimitMb: gate.memorySoftLimitMb,
                waitMs: gate.memoryGuardWaitMs,
                waiting: gate.memoryWaiters,
                rejectionsSinceBoot: gate.memoryRejectionsSinceBoot,
                gcAvailable: gate.gcAvailable,
                gcRunsSinceBoot: gate.gcRunsSinceBoot,
            },
            isolates: {
                slotLimit: gate.slotLimit,
                slotsActive: gate.slotsActive,
                slotWaiters: gate.slotWaiters,
                live: gate.liveIsolates,
                terminating: gate.terminatingIsolates,
                slotReleaseAnomalies: gate.slotReleaseAnomalies,
            },
            snapshotCache: deps.snapshotCache.stats(),
        };
    }

    static admission(deps: ToolDeps): Record<string, unknown> | null {
        if (!deps.runGates) return null;
        const stats = deps.runGates.stats();
        return {
            pots: stats.pots,
            sources: stats.sources,
            rejected429SinceBoot: stats.rejected429SinceBoot,
            rejected503SinceBoot: stats.rejected503SinceBoot,
        };
    }
}

/**
 * Lazy tool registry. Populated once at startup by createMcpRouter via
 * setMetaToolRegistry(), so describe_tool can look up the full long form of any
 * tool by name without taking on a circular import dependency.
 */
let toolRegistry: ReadonlyArray<ToolDef> = [];

export function setMetaToolRegistry(tools: ReadonlyArray<ToolDef>): void {
    toolRegistry = tools;
}

export function getMetaTools(): ToolDef[] {
    return [
        {
            name: 'get_readme',
            description:
                'Returns the SlopDogs README — the living document of the API, architecture, and conventions. Read this once at session start; it is the truth that other tool descriptions assume.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, _ctx, deps) => {
                const candidates = [
                    path.join(deps.projectRoot, 'README.md'),
                    path.join(deps.projectRoot, '..', 'README.md'),
                ];
                for (const p of candidates) {
                    try {
                        const text = await fs.readFile(p, 'utf-8');
                        return ok(text);
                    } catch { /* try next */ }
                }
                return fail('README.md not found');
            },
        },
        {
            name: 'health_check',
            description: 'Cheap liveness probe. Returns the current server time, the authenticated user (if any) and the kennel call counter `stats` {pending, dropped, lastFlushError}: pending = unflushed (kennel, day, source) keys, flushed every KENNEL_CALL_FLUSH_MS; plus `dogStats` {pendingDogs, referenceRows}: unflushed per-dog run keys and the rows of the dog reference index (who uses which dog); plus `memory` (process RSS/heap/external/arrayBuffers in MB, V8 heap_size_limit, the memory guard with soft limit, waiting runs, rejections and GC runs since boot, dog isolate slots: active/live/terminating, snapshot cache entries and approximate bytes) and `admission` (the run queues: active/waiting per pot, tracked sources, 429/503 refusals since boot). Numbers only — no client addresses or ids.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => {
                return ok({
                    ok: true,
                    serverTime: new Date().toISOString(),
                    user: ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null,
                    isSuperUser: ctx.isSuperUser,
                    stats: deps.callCounter.status(),
                    dogStats: deps.dogStats.health(),
                    memory: RuntimeHealth.memory(deps),
                    admission: RuntimeHealth.admission(deps),
                });
            },
        },
        {
            name: 'describe_tool',
            description:
                'Returns the full long-form description and input JSON schema of a tool by name. tools/list ships truncated one-line descriptions to save tokens — call describe_tool(name) when you need the canonical long form (semantics, edge cases, exact field syntax).',
            inputSchema: {
                type: 'object',
                required: ['name'],
                additionalProperties: false,
                properties: { name: { type: 'string', description: 'tool name as listed by tools/list' } },
            },
            handler: async (args) => {
                const name = typeof args.name === 'string' ? args.name : '';
                if (!name) return fail('name is required');
                const found = toolRegistry.find((t) => t.name === name);
                if (!found) return fail(`Unknown tool: ${name}`);
                return ok({
                    name: found.name,
                    description: found.description,
                    inputSchema: found.inputSchema,
                });
            },
        },
    ];
}
