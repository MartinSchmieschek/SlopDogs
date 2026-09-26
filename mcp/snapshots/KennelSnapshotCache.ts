// KennelSnapshotCache — Gedaechtnis ohne Stein.
// Map im Prozessspeicher, LRU + Idle-TTL. Keine Persistenz, kein Timer.
// Eviction laeuft lazy — wer get() ruft, weckt den Aufraeumer.
//
// Je Kennel UND je Betrachter (P3.5): ein Lauf traegt die Kapazitaeten dessen, der ihn
// ausloest — jsonStore unter `user:<id>:`, spaeter seine Keys. Seine Ergebnisse sind damit
// Daten dieses Nutzers. Ein Snapshot gehoert deshalb dem, der ihn ausgeloest hat, und nur
// der liest ihn; jeder andere loest seinen eigenen aus und sieht, was /run IHM zeigen wuerde.

import type { IKennelConfig } from '@slopdogs/core';
import type { AuthCtx } from '../auth/middleware';
import type { Waves } from '../../services/WavesConverter';
import type { KennelSnapshotEntry } from './types';
import { KeyRunState } from '../../services/keysCapability';

interface CacheOptions {
    maxEntries?: number;
    idleTtlMs?: number;
}

interface MarkOkParams {
    waves: Waves;
    kennelConfig: IKennelConfig;
    leadDogId?: string;
    leadResult?: unknown;
}

export class KennelSnapshotCache {
    private readonly entries = new Map<string, KennelSnapshotEntry>();
    private readonly maxEntries: number;
    private readonly idleTtlMs: number;

    constructor(options: CacheOptions = {}) {
        this.maxEntries = options.maxEntries ?? 200;
        this.idleTtlMs = options.idleTtlMs ?? 30 * 60 * 1000;
    }

    /**
     * Der Betrachter eines Aufrufs — die Identitaet, deren Kapazitaeten ein Lauf traegt.
     * Super-User (dev) und alle Anonymen teilen je einen Topf: Anonyme teilen auch `anon:`.
     */
    static viewerOf(ctx: AuthCtx | null | undefined): string {
        if (ctx?.isSuperUser) return 'super';
        return ctx?.user?.id ? `user:${ctx.user.id}` : 'anon';
    }

    private static keyOf(lineageId: string, viewer: string): string {
        return `${viewer}\u0000${lineageId}`;
    }

    /** Starte einen Run — markiere die Hoehle, in der das Echo eintrifft. */
    startJob(
        lineageId: string,
        viewer: string,
        kennelVersionId: string,
        query: Record<string, string> | undefined,
        body: unknown,
        triggerUserId: string | null | undefined,
    ): void {
        const now = new Date();
        const entry: KennelSnapshotEntry = {
            kennelLineageId: lineageId,
            kennelVersionId,
            viewer,
            status: 'running',
            startedAt: now,
            lastAccessedAt: now,
            query,
            body,
            triggerUserId: triggerUserId ?? null,
        };
        this.entries.set(KennelSnapshotCache.keyOf(lineageId, viewer), entry);
        this.evict();
    }

    /**
     * Beute trifft ein. P4c: vor dem Ablegen der Scrub des Laufs, der die Waves erzeugt hat — kein
     * Schluessel-Wert erreicht den Speicher, aus dem die Snapshot-Werkzeuge lesen (Defense-in-Depth).
     */
    markOk(lineageId: string, viewer: string, params: MarkOkParams): void {
        const entry = this.entries.get(KennelSnapshotCache.keyOf(lineageId, viewer));
        if (!entry) return;
        const now = new Date();
        const run = KeyRunState.forResult(params.waves);
        entry.status = 'ok';
        entry.finishedAt = now;
        entry.durationMs = now.getTime() - entry.startedAt.getTime();
        entry.waves = run.scrubValue(params.waves);
        entry.kennelConfig = params.kennelConfig;
        entry.leadDogId = params.leadDogId;
        entry.leadResult = run.scrubValue(params.leadResult);
        entry.lastAccessedAt = now;
    }

    /** Der Run zerbarst — markiere den Fehler. */
    markFailed(lineageId: string, viewer: string, error: string): void {
        const entry = this.entries.get(KennelSnapshotCache.keyOf(lineageId, viewer));
        if (!entry) return;
        const now = new Date();
        entry.status = 'failed';
        entry.finishedAt = now;
        entry.durationMs = now.getTime() - entry.startedAt.getTime();
        entry.errorMessage = error;
        entry.lastAccessedAt = now;
    }

    /** Lese — nur den eigenen Snapshot — und beruehre die LRU-Asche. */
    get(lineageId: string, viewer: string): KennelSnapshotEntry | undefined {
        this.evict();
        const entry = this.entries.get(KennelSnapshotCache.keyOf(lineageId, viewer));
        if (entry) {
            entry.lastAccessedAt = new Date();
        }
        return entry;
    }

    has(lineageId: string, viewer: string): boolean {
        return this.entries.has(KennelSnapshotCache.keyOf(lineageId, viewer));
    }

    delete(lineageId: string, viewer: string): void {
        this.entries.delete(KennelSnapshotCache.keyOf(lineageId, viewer));
    }

    /** Lazy eviction — idle entries verfallen, ueberzaehlige fallen aelteste-zuerst. */
    private evict(): void {
        const now = Date.now();

        // 1. Idle-Verfall.
        for (const [key, entry] of this.entries) {
            const idle = now - entry.lastAccessedAt.getTime();
            if (idle > this.idleTtlMs) {
                this.entries.delete(key);
            }
        }

        // 2. Ueberlauf — die Aeltesten gehen.
        if (this.entries.size <= this.maxEntries) return;
        const sorted = Array.from(this.entries.entries())
            .sort((a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime());
        const overflow = this.entries.size - this.maxEntries;
        for (let i = 0; i < overflow; i++) {
            this.entries.delete(sorted[i][0]);
        }
    }
}
