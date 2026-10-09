// Lesbarer, farbiger Speicher-Logger fuer den Betrieb (uebernommen aus perf/memory-log-and-heap, f42fa50).
// Je Kennel-Lauf eine Zeile (Dauer, Dogs, Wellen, RSS vorher->nachher mit Delta, Heap, external), je Boot-Phase
// eine Zeile (wo liegt die Boot-Spitze?) und ein Heartbeat mit dem Grundstand.
// Farbe nach Schwelle gegen MEMORY_LIMIT_MB (Render-Box, Default 512): gruen < 70 %, gelb 70-88 %, rot > 88 %.
// Render-Logs stellen ANSI dar. Standardmaessig an (ausser NODE_ENV=development); SLOPDOGS_MEMLOG=0/1 ueberschreibt.
//
// Heartbeat: gemessen wird alle MEMORY_LOG_INTERVAL_MS (Default 30 s), GESCHRIEBEN nur, wenn sich die RSS seit
// der letzten Zeile um mindestens MEMORY_LOG_DELTA_MB (Default 16) bewegt hat, spaetestens aber alle
// MEMORY_LOG_MAX_SILENCE_MS (Default 5 min). So zeigt das Log jede Stufe einer Ratsche, ohne im Leerlauf
// 2 880 gleiche Zeilen am Tag zu schreiben (30-s-Takt ohne Filter).
import { ProcessMemory } from '../../services/ProcessMemory';
import { Watchpost } from '../../services/Watchpost';

const C = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    gray: '\x1b[90m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

const MB = (bytes: number): number => Math.round(bytes / 1048576);

function positiveFromEnv(name: string, fallback: number): number {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function limitMb(): number {
    return positiveFromEnv('MEMORY_LIMIT_MB', 512);
}

/** An, ausser es ist development — und SLOPDOGS_MEMLOG (0/1/true/false) sticht immer. */
export function memLogEnabled(): boolean {
    const flag = (process.env.SLOPDOGS_MEMLOG ?? '').trim().toLowerCase();
    if (flag === '1' || flag === 'true' || flag === 'on') return true;
    if (flag === '0' || flag === 'false' || flag === 'off') return false;
    return (process.env.NODE_ENV || 'development') !== 'development';
}

function rssColor(rssMb: number): string {
    const p = rssMb / limitMb();
    return p >= 0.88 ? C.red : p >= 0.70 ? C.yellow : C.green;
}

export interface MemSnap { rss: number; heapUsed: number; heapTotal: number; external: number; arrayBuffers: number; }

export function memSnapshot(): MemSnap {
    const m = process.memoryUsage();
    return { rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal, external: m.external, arrayBuffers: m.arrayBuffers ?? 0 };
}

function rssTag(rssMb: number): string {
    return `${rssColor(rssMb)}${rssMb} MB${C.reset}`;
}

const dot = `${C.gray}·${C.reset}`;

/** Hochwasser und Container-Stand — die Zahlen, nach denen der Kill entscheidet (Linux), sonst nur maxRSS. */
function peakTail(): string {
    const linux = ProcessMemory.linux();
    const cgroup = linux?.cgroup;
    const parts = [`max ${Math.round(ProcessMemory.maxRssMb())}`];
    if (linux?.smapsAnonymousMb != null) parts.push(`anon ${Math.round(linux.smapsAnonymousMb)}`);
    if (linux?.threads != null) parts.push(`thr ${linux.threads}`);
    if (cgroup?.currentMb != null) parts.push(`cg ${Math.round(cgroup.currentMb)}${cgroup.peakMb != null ? `/${Math.round(cgroup.peakMb)}` : ''}`);
    return ` ${dot} ${C.gray}${parts.join(' ')}${C.reset}`;
}

let kennelRuns = 0;

/** Begonnene Kennel-Laeufe seit Start (health_check: runsSinceBoot) — gezaehlt auch bei abgeschaltetem Log. */
export function kennelRunsSinceBoot(): number {
    return kennelRuns;
}

/** Ein Kennel-Lauf: eine farbige Zeile mit allem, was zum Speicher-Verhalten zaehlt. */
export function logKennelRun(opts: {
    kennelId: string; source?: string; dogCount?: number; waveCount?: number;
    durationMs: number; before: MemSnap; after: MemSnap;
}): void {
    kennelRuns += 1;
    if (!memLogEnabled()) return;
    const beforeRss = MB(opts.before.rss);
    const afterRss = MB(opts.after.rss);
    const dRss = afterRss - beforeRss;
    const dCol = dRss >= 50 ? C.red : dRss >= 20 ? C.yellow : C.green;
    const dStr = `${dRss >= 0 ? '+' : ''}${dRss}`;
    console.log(
        `${C.cyan}[mem]${C.reset} ${C.bold}▶${C.reset} ${opts.kennelId}`
        + (opts.source ? ` ${C.gray}(${opts.source})${C.reset}` : '')
        + ` ${dot} ${opts.dogCount ?? '?'} dogs`
        + (opts.waveCount != null ? `, ${opts.waveCount} waves` : '')
        + ` ${dot} ${opts.durationMs}ms`
        + ` ${dot} rss ${C.gray}${beforeRss}→${C.reset}${rssTag(afterRss)} ${dCol}(Δ${dStr})${C.reset}`
        + ` ${dot} heap ${MB(opts.after.heapUsed)}/${MB(opts.after.heapTotal)}`
        + ` ${dot} ext ${MB(opts.after.external)} MB`
        + peakTail(),
    );
}

/** Eine Boot-Phase (Seeds, App started, Referenzindex): wo die Spitze entsteht, steht im Log. */
export function logBootMemory(phase: string): void {
    // Der Wachposten nennt die letzte Phase in jeder Alarmzeile — auch bei abgeschaltetem Log.
    Watchpost.shared?.bootPhaseReached(phase);
    if (!memLogEnabled()) return;
    const s = memSnapshot();
    console.log(
        `${C.magenta}[mem]${C.reset} ${C.bold}boot${C.reset} ${phase} ${dot} rss ${rssTag(MB(s.rss))}`
        + ` ${dot} heap ${MB(s.heapUsed)}/${MB(s.heapTotal)} ${dot} ext ${MB(s.external)} MB`
        + peakTail(),
    );
}

/** Verzoegerung der Event-Loop seit Start (Wachposten), wenn er laeuft. */
function eventLoopTail(): string {
    const delay = Watchpost.shared?.delayMs();
    return delay ? ` ${dot} ${C.gray}loop p99 ${delay.p99} max ${delay.max} ms${C.reset}` : '';
}

let heartbeat: ReturnType<typeof setInterval> | null = null;

/** Grundstand-Heartbeat: misst im Takt, schreibt nur bei Bewegung oder nach langer Stille (siehe Kopf). */
export function startMemoryHeartbeat(): void {
    if (heartbeat || !memLogEnabled()) return;
    const intervalMs = Math.max(5000, positiveFromEnv('MEMORY_LOG_INTERVAL_MS', 30_000));
    const deltaMb = positiveFromEnv('MEMORY_LOG_DELTA_MB', 16);
    const maxSilenceMs = positiveFromEnv('MEMORY_LOG_MAX_SILENCE_MS', 300_000);
    let lastRssMb = -Infinity;
    let lastAt = 0;
    heartbeat = setInterval(() => {
        const s = memSnapshot();
        const rssMb = MB(s.rss);
        const now = Date.now();
        if (Math.abs(rssMb - lastRssMb) < deltaMb && now - lastAt < maxSilenceMs) return;
        lastRssMb = rssMb;
        lastAt = now;
        console.log(
            `${C.magenta}[mem]${C.reset} ${C.gray}♥${C.reset} rss ${rssTag(rssMb)} ${C.gray}/ ${limitMb()} MB${C.reset}`
            + ` ${dot} heap ${MB(s.heapUsed)}/${MB(s.heapTotal)} ${dot} ext ${MB(s.external)} ${dot} ab ${MB(s.arrayBuffers)} MB`
            + peakTail()
            + eventLoopTail(),
        );
    }, intervalMs);
    // Darf den Prozess nicht am Leben halten.
    heartbeat.unref?.();
}
