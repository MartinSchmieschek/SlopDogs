// KennelSnapshotCache — Gedaechtnis ohne Stein.
// Map im Prozessspeicher, Idle-TTL + LRU + Byte-Obergrenze. Keine Persistenz, kein Timer.
// Geraeumt wird bei jeder Mutation (startJob, markOk, markFailed, delete) und bei jedem Lesen
// (get, has, stats) — nicht erst, wenn jemand zufaellig get() ruft.
// Reihenfolge der Raeumung: Idle-Verfall, dann Anzahl > maxEntries, dann Summe Bytes > maxBytes;
// jeweils aelteste lastAccessedAt zuerst. Laufende Eintraege ('running') wiegen 0 Bytes.
// Die Bytes eines Eintrags schaetzt ApproxHeapSize beim markOk ueber das, was wirklich gehalten
// wird (gescrubbte Waves, leadResult, Charter, Query, Body). Ein Eintrag, der allein schwerer ist
// als maxBytes, wird nicht gehalten — er endet als 'failed' mit einem Hinweis auf die Auswege.
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
import { ApproxHeapSize } from './ApproxHeapSize';

const MB = 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_MB = 64;

interface CacheOptions {
    maxEntries?: number;
    idleTtlMs?: number;
    /** Obergrenze der geschaetzten Bytes aller gehaltenen Snapshots. Default: SNAPSHOT_CACHE_MAX_MB (64 MB). */
    maxBytes?: number;
}

interface MarkOkParams {
    waves: Waves;
    kennelConfig: IKennelConfig;
    leadDogId?: string;
    leadResult?: unknown;
}

/** Zahlen fuer health_check — keine IDs, keine Betrachter. */
export interface KennelSnapshotCacheStats {
    entries: number;
    running: number;
    approxBytes: number;
    maxBytes: number;
    maxEntries: number;
    evictedSinceBoot: number;
}

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatMb(bytes: number): string {
    const mb = bytes / MB;
    if (mb >= 10) return mb.toFixed(0);
    if (mb >= 1) return mb.toFixed(1);
    return mb.toFixed(2);
}

export class KennelSnapshotCache {
    private readonly entries = new Map<string, KennelSnapshotEntry>();
    /** Geschaetzte Bytes je Schluessel; nur fertige Eintraege mit Beute stehen hier. */
    private readonly bytesByKey = new Map<string, number>();
    private totalBytes = 0;
    private evictedSinceBoot = 0;
    private readonly maxEntries: number;
    private readonly idleTtlMs: number;
    private readonly maxBytes: number;

    constructor(options: CacheOptions = {}) {
        this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
        this.maxBytes = options.maxBytes ?? positiveIntFromEnv('SNAPSHOT_CACHE_MAX_MB', DEFAULT_MAX_MB) * MB;
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
        const key = KennelSnapshotCache.keyOf(lineageId, viewer);
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
        this.entries.set(key, entry);
        this.setBytes(key, 0);
        this.evict();
    }

    /**
     * Beute trifft ein. P4c: vor dem Ablegen der Scrub des Laufs, der die Waves erzeugt hat — kein
     * Schluessel-Wert erreicht den Speicher, aus dem die Snapshot-Werkzeuge lesen (Defense-in-Depth).
     * Gewogen wird das Gescrubbte; ist es allein schwerer als maxBytes, bleibt nur ein Fehler zurueck.
     */
    markOk(lineageId: string, viewer: string, params: MarkOkParams): void {
        const key = KennelSnapshotCache.keyOf(lineageId, viewer);
        const entry = this.entries.get(key);
        if (!entry) {
            this.evict();
            return;
        }
        const run = KeyRunState.forResult(params.waves);
        const waves = run.scrubValue(params.waves);
        const leadResult = run.scrubValue(params.leadResult);
        const bytes = ApproxHeapSize.of([waves, leadResult, params.kennelConfig, entry.query, entry.body]);

        if (bytes > this.maxBytes) {
            this.markFailed(lineageId, viewer, this.tooLargeMessage(bytes));
            return;
        }

        const now = new Date();
        entry.status = 'ok';
        entry.finishedAt = now;
        entry.durationMs = now.getTime() - entry.startedAt.getTime();
        entry.waves = waves;
        entry.kennelConfig = params.kennelConfig;
        entry.leadDogId = params.leadDogId;
        entry.leadResult = leadResult;
        entry.errorMessage = undefined;
        entry.lastAccessedAt = now;
        this.setBytes(key, bytes);
        this.evict();
    }

    /** Der Run zerbarst — markiere den Fehler. */
    markFailed(lineageId: string, viewer: string, error: string): void {
        const key = KennelSnapshotCache.keyOf(lineageId, viewer);
        const entry = this.entries.get(key);
        if (entry) {
            const now = new Date();
            entry.status = 'failed';
            entry.finishedAt = now;
            entry.durationMs = now.getTime() - entry.startedAt.getTime();
            entry.errorMessage = error;
            entry.waves = undefined;
            entry.leadResult = undefined;
            entry.lastAccessedAt = now;
            this.setBytes(key, 0);
        }
        this.evict();
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
        this.evict();
        return this.entries.has(KennelSnapshotCache.keyOf(lineageId, viewer));
    }

    delete(lineageId: string, viewer: string): void {
        this.remove(KennelSnapshotCache.keyOf(lineageId, viewer));
        this.evict();
    }

    /** Zahlen fuer die Diagnose (health_check) — keine IDs, keine Betrachter. */
    stats(): KennelSnapshotCacheStats {
        this.evict();
        let running = 0;
        for (const entry of this.entries.values()) {
            if (entry.status === 'running') running++;
        }
        return {
            entries: this.entries.size,
            running,
            approxBytes: this.totalBytes,
            maxBytes: this.maxBytes,
            maxEntries: this.maxEntries,
            evictedSinceBoot: this.evictedSinceBoot,
        };
    }

    private tooLargeMessage(bytes: number): string {
        return `Snapshot too large to keep in memory (~${formatMb(bytes)} MB, limit ${formatMb(this.maxBytes)} MB). `
            + 'Use execute_kennel or run_kennel, or raise SNAPSHOT_CACHE_MAX_MB.';
    }

    private setBytes(key: string, bytes: number): void {
        this.totalBytes -= this.bytesByKey.get(key) ?? 0;
        if (bytes > 0) {
            this.bytesByKey.set(key, bytes);
            this.totalBytes += bytes;
        } else {
            this.bytesByKey.delete(key);
        }
    }

    private remove(key: string): void {
        this.setBytes(key, 0);
        this.entries.delete(key);
    }

    private evictKey(key: string): void {
        this.remove(key);
        this.evictedSinceBoot++;
    }

    /** Raeumung — Idle-Verfall, dann Anzahl, dann Bytes; die Aeltesten gehen zuerst. */
    private evict(): void {
        const now = Date.now();

        // 1. Idle-Verfall.
        for (const [key, entry] of this.entries) {
            if (now - entry.lastAccessedAt.getTime() > this.idleTtlMs) {
                this.evictKey(key);
            }
        }

        if (this.entries.size <= this.maxEntries && this.totalBytes <= this.maxBytes) return;
        const oldestFirst = Array.from(this.entries.entries())
            .sort((a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime());

        // 2. Ueberlauf der Anzahl.
        let i = 0;
        while (this.entries.size > this.maxEntries && i < oldestFirst.length) {
            this.evictKey(oldestFirst[i++][0]);
        }

        // 3. Ueberlauf der Bytes — nur Eintraege mit Gewicht helfen; laufende bleiben.
        for (; this.totalBytes > this.maxBytes && i < oldestFirst.length; i++) {
            const key = oldestFirst[i][0];
            if (this.bytesByKey.has(key)) this.evictKey(key);
        }
    }
}
