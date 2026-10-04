// Lesbarer, farbiger Speicher-Logger fuer den Betrieb. Zeigt je Kennel-Lauf, was passiert (Dauer, Dogs,
// Wellen, RSS vorher->nachher mit Delta, Heap, external) und einen periodischen Heartbeat mit dem Grundstand.
// Farbe nach Schwelle gegen MEMORY_LIMIT_MB (Render-Box, Default 512): gruen < 70 %, gelb 70-88 %, rot > 88 %.
// Render-Logs stellen ANSI dar. Standardmaessig an (ausser NODE_ENV=development); SLOPDOGS_MEMLOG=0/1 ueberschreibt.

const C = {
    reset: '\x1b[0m', bold: '\x1b[1m',
    gray: '\x1b[90m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
};

const MB = (bytes: number): number => Math.round(bytes / 1048576);

function limitMb(): number {
    const n = Number(process.env.MEMORY_LIMIT_MB);
    return Number.isFinite(n) && n > 0 ? n : 512;
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
    return { rss: m.rss, heapUsed: m.heapUsed, heapTotal: m.heapTotal, external: m.external, arrayBuffers: (m as any).arrayBuffers ?? 0 };
}

function rssTag(rssMb: number): string {
    return `${rssColor(rssMb)}${rssMb} MB${C.reset}`;
}

/** Ein Kennel-Lauf: eine farbige Zeile mit allem, was zum Speicher-Verhalten zaehlt. */
export function logKennelRun(opts: {
    kennelId: string; source?: string; dogCount?: number; waveCount?: number;
    durationMs: number; before: MemSnap; after: MemSnap;
}): void {
    if (!memLogEnabled()) return;
    const beforeRss = MB(opts.before.rss);
    const afterRss = MB(opts.after.rss);
    const dRss = afterRss - beforeRss;
    const dCol = dRss >= 50 ? C.red : dRss >= 20 ? C.yellow : C.green;
    const dStr = `${dRss >= 0 ? '+' : ''}${dRss}`;
    const dot = `${C.gray}·${C.reset}`;
    console.log(
        `${C.cyan}[mem]${C.reset} ${C.bold}▶${C.reset} ${opts.kennelId}`
        + (opts.source ? ` ${C.gray}(${opts.source})${C.reset}` : '')
        + ` ${dot} ${opts.dogCount ?? '?'} dogs`
        + (opts.waveCount != null ? `, ${opts.waveCount} waves` : '')
        + ` ${dot} ${opts.durationMs}ms`
        + ` ${dot} rss ${C.gray}${beforeRss}→${C.reset}${rssTag(afterRss)} ${dCol}(Δ${dStr})${C.reset}`
        + ` ${dot} heap ${MB(opts.after.heapUsed)}/${MB(opts.after.heapTotal)}`
        + ` ${dot} ext ${MB(opts.after.external)} MB`,
    );
}

let heartbeat: ReturnType<typeof setInterval> | null = null;

/** Periodischer Grundstand-Heartbeat (Default alle 30 s), damit man Wachstum ueber die Zeit sieht. */
export function startMemoryHeartbeat(): void {
    if (heartbeat || !memLogEnabled()) return;
    const ms = Math.max(5000, Number(process.env.MEMORY_LOG_INTERVAL_MS) || 30000);
    const dot = `${C.gray}·${C.reset}`;
    heartbeat = setInterval(() => {
        const s = memSnapshot();
        console.log(
            `${C.magenta}[mem]${C.reset} ${C.gray}♥${C.reset} rss ${rssTag(MB(s.rss))} ${C.gray}/ ${limitMb()} MB${C.reset}`
            + ` ${dot} heap ${MB(s.heapUsed)}/${MB(s.heapTotal)} ${dot} ext ${MB(s.external)} ${dot} ab ${MB(s.arrayBuffers)} MB`,
        );
    }, ms);
    // Darf den Prozess nicht am Leben halten.
    (heartbeat as any).unref?.();
}
