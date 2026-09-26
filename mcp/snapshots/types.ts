// Snapshot-Pakte fuer das Void-Gedaechtnis.
// Eine Kennel-Welle wird einmal gerannt, vollstaendig in den Speicher gefroren,
// dann darf die Pack-Inspektion granular zugreifen — ohne die volle Beute jedesmal zu schleppen.

import type { Waves } from '../../services/WavesConverter';
import type { IKennelConfig } from '@slopdogs/core';

export type SnapshotStatus = 'running' | 'ok' | 'failed';

/**
 * Eine eingefrorene Beute. Lebt nur im Prozess.
 * Die `kennelVersionId` ist der Stale-Anker — wechselt der Kennel die Version,
 * wird der Snapshot ungueltig und der Aufrufer bekommt einen klaren Hinweis.
 */
export interface KennelSnapshotEntry {
    kennelLineageId: string;
    /** Kennel-Version zum Zeitpunkt des Run-Starts; Anker fuer Stale-Detection. */
    kennelVersionId: string;
    /** Wessen Kapazitaeten der Lauf trug (KennelSnapshotCache.viewerOf) — nur der liest ihn. */
    viewer: string;
    status: SnapshotStatus;
    startedAt: Date;
    finishedAt?: Date;
    durationMs?: number;
    query?: Record<string, string>;
    body?: unknown;
    /** Volle Waves — in-memory, ohne Persistenz. */
    waves?: Waves;
    /** Charter zum Run-Zeitpunkt; Pass-through fuer Layout/Task/Defaults. */
    kennelConfig?: IKennelConfig;
    /** Erster dogIds-Eintrag, aufgeloest auf NodeEntry.id. */
    leadDogId?: string;
    /** Vorbeprobte Lead-Beute (Convenience, kein Re-Walk noetig). */
    leadResult?: unknown;
    errorMessage?: string;
    triggerUserId?: string | null;
    /** LRU-Anker — wird bei jedem get() neu gesetzt. */
    lastAccessedAt: Date;
}
