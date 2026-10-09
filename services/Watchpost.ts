// Wachposten — ein eigener Thread, der den Haupt-Thread von aussen beobachtet und mitschreibt.
//
// Zeitgrenze der Dog-Laeufe (setTimeout + worker.terminate), Speicher-Waechter (DogWorkerGate) und Heartbeat
// (memoryLog.ts) haengen alle an der Event-Loop des Haupt-Threads. Blockiert sie, feuert keiner dieser Timer —
// und das Log schweigt bis zum stillen OOM-Kill des Containers. Der Wachposten laeuft in einem eigenen
// worker_thread mit eigener Event-Loop und schreibt mit fs.writeSync(2) am Haupt-Thread vorbei:
//   - Puls: der Haupt-Thread zaehlt alle 50 ms einen Zaehler im SharedArrayBuffer hoch. Steht er laenger als
//     WATCHPOST_STALL_MS, ist der Haupt-Thread blockiert: eine Zeile zu Beginn, hoechstens alle 5 s eine
//     Fortsetzung, eine zum Ende mit Gesamtdauer.
//   - Speicher: liest selbst die cgroup (v2 memory.current/peak/max, sonst v1; ausserhalb von Linux aus) und
//     schreibt nur beim Ueberschreiten der Stufen 80/90/95 % der Grenze (memory.max, sonst MEMORY_LIMIT_MB) —
//     mit Stand, Hochwasser und Anstiegsrate; beim Absinken mit 5 Prozentpunkten Hysterese. Im Leerlauf: nichts.
//   - Kontext: der Haupt-Thread meldet Beginn/Ende der Kennel-Laeufe (Kennel-ID, Quelle) und die Boot-Phasen;
//     jede Alarm- und Blockadezeile nennt den letzten bekannten Stand. Bei blockiertem Haupt-Thread kommen
//     keine Meldungen an — der letzte Stand reicht.
// Nur beobachten: der Wachposten greift nie ein (Dog-Worker beenden kann nur der Thread, der sie gestartet hat).
// Im Haupt-Thread zusaetzlich monitorEventLoopDelay; health_check meldet beides (Block eventLoop).
//
// Env: SLOPDOGS_WATCHPOST=0/1 (Default: an, ausser NODE_ENV=development), WATCHPOST_STALL_MS (Default 1000),
// WATCHPOST_POLL_MS (Default 100), MEMORY_LIMIT_MB (Grenze, wenn keine memory.max lesbar ist; Default 512).
import { Worker } from 'worker_threads';
import { monitorEventLoopDelay, type IntervalHistogram } from 'perf_hooks';

/** Plaetze im geteilten Int32Array — beide Threads lesen und schreiben nur ueber Atomics. */
const SLOT = { pulse: 0, stalls: 1, longestStallMs: 2, cgroupPeakSeenKb: 3, cgroupCurrentKb: 4 } as const;
const SLOT_COUNT = 5;

const PULSE_MS = 50;
const STALL_REPEAT_MS = 5_000;
const MEMORY_LEVELS = [0.8, 0.9, 0.95];
const MEMORY_HYSTERESIS = 0.05;
const DELAY_RESOLUTION_MS = 20;
const MAX_RESTARTS = 1;

export interface StallEvent { kind: 'begin' | 'continue' | 'end'; ms: number; }

/**
 * Erkennt eine Blockade am stehenden Puls. Reine Logik, die Zeit kommt von aussen — die Klasse laeuft im
 * Wachposten-Thread (per toString eingebettet) und darf deshalb nichts importieren und keine statischen Felder haben.
 */
export class StallDetector {
    private lastPulse: number | null = null;
    private lastChangeAt = 0;
    private stalled = false;
    private lastReportAt = 0;

    constructor(private readonly stallMs: number, private readonly repeatMs: number) {}

    observe(pulse: number, now: number): StallEvent | null {
        if (pulse !== this.lastPulse) {
            const gapMs = now - this.lastChangeAt;
            const wasStalled = this.stalled;
            this.lastPulse = pulse;
            this.lastChangeAt = now;
            this.stalled = false;
            return wasStalled ? { kind: 'end', ms: gapMs } : null;
        }
        const ms = now - this.lastChangeAt;
        if (!this.stalled) {
            if (ms < this.stallMs) return null;
            this.stalled = true;
            this.lastReportAt = now;
            return { kind: 'begin', ms };
        }
        if (now - this.lastReportAt < this.repeatMs) return null;
        this.lastReportAt = now;
        return { kind: 'continue', ms };
    }
}

export interface LevelEvent { kind: 'up' | 'down'; threshold: number; }

/**
 * Speicher-Stufen mit Hysterese: meldet das Ueberschreiten einer Stufe sofort, das Absinken erst, wenn der Stand
 * um `hysteresis` unter die Stufe faellt. Reine Logik wie StallDetector (laeuft im Wachposten-Thread).
 */
export class MemoryLevels {
    private level = 0;

    constructor(private readonly thresholds: number[], private readonly hysteresis: number) {}

    observe(fraction: number): LevelEvent | null {
        const before = this.level;
        while (this.level < this.thresholds.length && fraction >= this.thresholds[this.level]) this.level++;
        if (this.level > before) return { kind: 'up', threshold: this.thresholds[this.level - 1] };
        while (this.level > 0 && fraction < this.thresholds[this.level - 1] - this.hysteresis) this.level--;
        if (this.level < before) return { kind: 'down', threshold: this.thresholds[this.level] };
        return null;
    }
}

interface WatchpostWorkerData {
    buffer: SharedArrayBuffer;
    slot: typeof SLOT;
    fd: number;
    stallMs: number;
    pollMs: number;
    repeatMs: number;
    levels: number[];
    hysteresis: number;
    limitMbFallback: number;
    /** Wurzel der cgroup-Dateien; null = Speicher-Teil aus. */
    cgroupDir: string | null;
    bootPhase: string | null;
    restart: boolean;
}

type WatchpostMessage =
    | { type: 'run:start'; token: number; kennelId: string; source: string; at: number }
    | { type: 'run:end'; token: number }
    | { type: 'boot'; phase: string }
    | { type: 'boot:done' };

/**
 * Der Wachposten-Thread selbst. Wird per toString in die Worker-Quelle eingebettet (wie SANDBOX_WORKER_SOURCE in
 * SerializedDog.ts), damit ts-node und dist/ gleich laufen: keine Imports, nur Built-ins per require.
 */
function watchpostThread(): void {
    const { parentPort, workerData } = require('worker_threads');
    const fs = require('fs');
    const { performance } = require('perf_hooks');
    const cfg: WatchpostWorkerData = workerData;
    const shared = new Int32Array(cfg.buffer);
    const C = { reset: '\x1b[0m', bold: '\x1b[1m', gray: '\x1b[90m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m' };
    const BYTES_PER_MB = 1048576;
    const mb = (bytes: number): number => Math.round(bytes / BYTES_PER_MB);
    const pct = (fraction: number): number => Math.round(fraction * 100);

    const write = (line: string): void => {
        try {
            fs.writeSync(cfg.fd, `${C.yellow}[watchpost]${C.reset} ${line}\n`);
        } catch {
            // stderr ist weg — der Wachposten hat niemanden mehr, dem er es sagen koennte.
        }
    };

    const readNumber = (file: string): number | null => {
        try {
            const value = Number(fs.readFileSync(file, 'utf8').trim());
            return Number.isFinite(value) ? value : null;
        } catch {
            return null;
        }
    };

    // cgroup v2 zuerst, sonst v1; ohne lesbare Datei bleibt der Speicher-Teil aus.
    let files: { version: number; current: string; peak: string; max: string } | null = null;
    if (cfg.cgroupDir) {
        const dir = cfg.cgroupDir;
        if (readNumber(`${dir}/memory.current`) !== null) {
            files = { version: 2, current: `${dir}/memory.current`, peak: `${dir}/memory.peak`, max: `${dir}/memory.max` };
        } else if (readNumber(`${dir}/memory/memory.usage_in_bytes`) !== null) {
            files = {
                version: 1,
                current: `${dir}/memory/memory.usage_in_bytes`,
                peak: `${dir}/memory/memory.max_usage_in_bytes`,
                max: `${dir}/memory/memory.limit_in_bytes`,
            };
        }
    }
    // "max" (v2) ist keine Zahl, v1 meldet "unbegrenzt" als Zahl nahe 2^63 — beides heisst: MEMORY_LIMIT_MB.
    const cgroupMax = files ? readNumber(files.max) : null;
    const limitFromCgroup = cgroupMax !== null && cgroupMax > 0 && cgroupMax < 2 ** 50;
    const limitBytes = limitFromCgroup && cgroupMax !== null ? cgroupMax : cfg.limitMbFallback * BYTES_PER_MB;

    const runs = new Map<number, { kennelId: string; source: string; at: number }>();
    let bootPhase: string | null = cfg.bootPhase;
    parentPort.on('message', (message: WatchpostMessage) => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'run:start') {
            runs.set(message.token, { kennelId: String(message.kennelId).slice(0, 80), source: String(message.source), at: message.at });
        } else if (message.type === 'run:end') {
            runs.delete(message.token);
        } else if (message.type === 'boot') {
            bootPhase = String(message.phase);
        } else if (message.type === 'boot:done') {
            bootPhase = null;
        }
    });

    /** Der letzte bekannte Stand des Haupt-Threads: aktive Laeufe mit Laufzeit, Boot-Phase. */
    const context = (withCgroup: boolean): string => {
        const parts: string[] = [];
        if (withCgroup && files) {
            parts.push(`cg ${Math.round(Atomics.load(shared, cfg.slot.cgroupCurrentKb) / 1024)}/${mb(limitBytes)} MB`);
        }
        const now = Date.now();
        if (runs.size === 0) {
            parts.push('keine Laeufe');
        } else {
            const shown = Array.from(runs.values()).slice(0, 3)
                .map((run) => `${run.kennelId} (${run.source}) ${((now - run.at) / 1000).toFixed(1)} s`);
            parts.push(`Laeufe ${runs.size}: ${shown.join(', ')}${runs.size > shown.length ? ', …' : ''}`);
        }
        if (bootPhase !== null) parts.push(`Boot nach '${bootPhase}'`);
        return ` ${C.gray}· ${parts.join(' · ')}${C.reset}`;
    };

    const stall = new StallDetector(cfg.stallMs, cfg.repeatMs);
    const checkPulse = (now: number): void => {
        const event = stall.observe(Atomics.load(shared, cfg.slot.pulse), now);
        if (!event) return;
        const ms = Math.round(event.ms);
        if (event.kind === 'begin') Atomics.add(shared, cfg.slot.stalls, 1);
        if (ms > Atomics.load(shared, cfg.slot.longestStallMs)) Atomics.store(shared, cfg.slot.longestStallMs, ms);
        const head = event.kind === 'begin' ? `${C.red}${C.bold}⏸ Haupt-Thread blockiert${C.reset} seit ${ms} ms`
            : event.kind === 'continue' ? `${C.red}⏸ Haupt-Thread weiter blockiert${C.reset}, ${ms} ms`
                : `${C.green}▶ Haupt-Thread wieder frei${C.reset} nach ${ms} ms`;
        write(head + context(true));
    };

    const levels = new MemoryLevels(cfg.levels, cfg.hysteresis);
    // Anstiegsrate gegen eine Probe, die 1-2 s alt ist.
    let rateBase: { at: number; bytes: number } | null = null;
    let ratePrevious: { at: number; bytes: number } | null = null;
    const checkMemory = (now: number): void => {
        if (!files) return;
        const current = readNumber(files.current);
        if (current === null) return;
        const kb = Math.round(current / 1024);
        Atomics.store(shared, cfg.slot.cgroupCurrentKb, kb);
        if (kb > Atomics.load(shared, cfg.slot.cgroupPeakSeenKb)) Atomics.store(shared, cfg.slot.cgroupPeakSeenKb, kb);
        if (!rateBase || now - rateBase.at >= 1000) {
            ratePrevious = rateBase;
            rateBase = { at: now, bytes: current };
        }
        const event = levels.observe(current / limitBytes);
        if (!event) return;
        const reference = ratePrevious ?? rateBase;
        const seconds = (now - reference.at) / 1000;
        const rate = seconds > 0 ? (current - reference.bytes) / BYTES_PER_MB / seconds : 0;
        const peak = readNumber(files.peak);
        const up = event.kind === 'up';
        const color = !up ? C.gray : event.threshold >= 0.9 ? C.red : C.yellow;
        const head = up ? `▲ Speicher ueber ${pct(event.threshold)} %` : `▼ Speicher zurueck unter ${pct(event.threshold)} %`;
        write(
            `${color}${C.bold}${head}${C.reset}: cg ${mb(current)}/${mb(limitBytes)} MB (${pct(current / limitBytes)} %)`
            + ` · peak ${peak !== null ? mb(peak) : '?'} MB · ${rate >= 0 ? '+' : ''}${rate.toFixed(0)} MB/s`
            + context(false),
        );
    };

    let failureReported = false;
    const poll = (): void => {
        const now = performance.now();
        try {
            checkPulse(now);
            checkMemory(now);
        } catch (err) {
            if (failureReported) return;
            failureReported = true;
            write(`Fehler im Takt (nur einmal gemeldet): ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const memoryNote = files
        ? `Speicher-Stufen ${cfg.levels.map(pct).join('/')} % von ${mb(limitBytes)} MB`
            + ` (${limitFromCgroup ? `cgroup v${files.version} memory.max` : 'MEMORY_LIMIT_MB'})`
        : 'Speicher aus (keine cgroup lesbar)';
    write(`${cfg.restart ? 'wacht wieder (Neustart)' : 'wacht'} · Blockade ab ${cfg.stallMs} ms · Takt ${cfg.pollMs} ms · ${memoryNote}`);
    setInterval(poll, cfg.pollMs);
}

const WATCHPOST_THREAD_SOURCE = `
${StallDetector.toString()}
${MemoryLevels.toString()}
(${watchpostThread.toString()})();
`;

export interface WatchpostOptions {
    stallMs: number;
    pollMs: number;
    limitMb: number;
    /** Ziel der Zeilen (Default 2 = stderr; Tests geben eine Datei). */
    fd: number;
    cgroupDir: string | null;
}

function positiveFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
    const n = Number(env[name]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}


/**
 * Der Haupt-Thread-Teil: haelt den Puls, die Event-Loop-Messung und den Wachposten-Thread. Nichts hiervon darf den
 * Server stoeren — jeder Fehler endet in einer Logzeile, hoechstens ein Neustart des Threads.
 */
export class Watchpost {
    private static current: Watchpost | null = null;

    /** An, ausser es ist development — und SLOPDOGS_WATCHPOST (0/1/true/false) sticht immer. */
    static enabled(env: NodeJS.ProcessEnv = process.env): boolean {
        const flag = (env.SLOPDOGS_WATCHPOST ?? '').trim().toLowerCase();
        if (flag === '1' || flag === 'true' || flag === 'on') return true;
        if (flag === '0' || flag === 'false' || flag === 'off') return false;
        return (env.NODE_ENV || 'development') !== 'development';
    }

    static optionsFromEnv(env: NodeJS.ProcessEnv = process.env): WatchpostOptions {
        return {
            stallMs: Math.max(100, positiveFromEnv(env, 'WATCHPOST_STALL_MS', 1000)),
            pollMs: Math.min(1000, Math.max(10, positiveFromEnv(env, 'WATCHPOST_POLL_MS', 100))),
            limitMb: positiveFromEnv(env, 'MEMORY_LIMIT_MB', 512),
            fd: 2,
            cgroupDir: process.platform === 'linux' ? '/sys/fs/cgroup' : null,
        };
    }

    /** Der Wachposten des Prozesses — einmal, frueh in main.ts. Wirft nie. */
    static startShared(env: NodeJS.ProcessEnv = process.env): void {
        if (Watchpost.current || !Watchpost.enabled(env)) return;
        try {
            const watchpost = new Watchpost(Watchpost.optionsFromEnv(env));
            watchpost.start();
            Watchpost.current = watchpost;
        } catch (err) {
            console.error('[watchpost] Start gescheitert — der Server laeuft ohne Wachposten:', err);
        }
    }

    static async stopShared(): Promise<void> {
        const watchpost = Watchpost.current;
        Watchpost.current = null;
        await watchpost?.stop();
    }

    static get shared(): Watchpost | null {
        return Watchpost.current;
    }

    /** health_check-Block eventLoop; abgeschaltet nur { enabled: false }. */
    static health(): Record<string, unknown> {
        return Watchpost.current?.health() ?? { enabled: false };
    }

    private readonly state = new Int32Array(new SharedArrayBuffer(SLOT_COUNT * Int32Array.BYTES_PER_ELEMENT));
    private readonly delay: IntervalHistogram = monitorEventLoopDelay({ resolution: DELAY_RESOLUTION_MS });
    private worker: Worker | null = null;
    private pulseTimer: ReturnType<typeof setInterval> | null = null;
    private restarts = 0;
    private stopping = false;
    private nextRunToken = 1;
    private bootPhase: string | null = 'Start';

    constructor(private readonly options: WatchpostOptions) {}

    start(): void {
        this.delay.enable();
        this.pulseTimer = setInterval(() => Atomics.add(this.state, SLOT.pulse, 1), PULSE_MS);
        // Weder Puls noch Thread duerfen den Prozess am Leben halten.
        this.pulseTimer.unref();
        this.spawn(false);
    }

    async stop(): Promise<void> {
        this.stopping = true;
        if (this.pulseTimer) clearInterval(this.pulseTimer);
        this.delay.disable();
        const worker = this.worker;
        this.worker = null;
        await worker?.terminate().catch(() => undefined);
    }

    get alive(): boolean {
        return this.worker !== null;
    }

    /** Beginn eines Kennel-Laufs; das Token geht an runEnded. Nur Kennel-ID und Quelle, keine Adressen, keine Keys. */
    runStarted(kennelId: string, source: string): number {
        const token = this.nextRunToken++;
        this.post({ type: 'run:start', token, kennelId, source, at: Date.now() });
        return token;
    }

    runEnded(token: number | undefined): void {
        if (token) this.post({ type: 'run:end', token });
    }

    /** Zuletzt abgeschlossene Boot-Phase (aus logBootMemory). */
    bootPhaseReached(phase: string): void {
        this.bootPhase = phase;
        this.post({ type: 'boot', phase });
    }

    bootFinished(): void {
        this.bootPhase = null;
        this.post({ type: 'boot:done' });
    }

    /**
     * Verzoegerung der Event-Loop seit Start in ms — ueber den 20-ms-Messtakt hinaus (monitorEventLoopDelay misst den
     * ganzen Abstand zweier Takte; der Takt selbst wird abgezogen).
     */
    delayMs(): { p50: number; p99: number; max: number; mean: number } {
        const lag = (ns: number): number => (Number.isFinite(ns) ? Math.max(0, Math.round(ns / 1e5 - DELAY_RESOLUTION_MS * 10) / 10) : 0);
        return {
            p50: lag(this.delay.percentile(50)),
            p99: lag(this.delay.percentile(99)),
            max: lag(this.delay.max),
            mean: lag(this.delay.mean),
        };
    }

    health(): Record<string, unknown> {
        const kbToMb = (kb: number): number | null => (kb > 0 ? Math.round(kb / 102.4) / 10 : null);
        return {
            enabled: true,
            delayMs: this.delayMs(),
            watchpost: {
                alive: this.alive,
                restarts: this.restarts,
                stallThresholdMs: this.options.stallMs,
                pollMs: this.options.pollMs,
                stallsSinceStart: Atomics.load(this.state, SLOT.stalls),
                longestStallMs: Atomics.load(this.state, SLOT.longestStallMs),
                cgroupPeakSeenMb: kbToMb(Atomics.load(this.state, SLOT.cgroupPeakSeenKb)),
                cgroupCurrentMb: kbToMb(Atomics.load(this.state, SLOT.cgroupCurrentKb)),
            },
        };
    }

    private spawn(restart: boolean): void {
        const workerData: WatchpostWorkerData = {
            buffer: this.state.buffer as SharedArrayBuffer,
            slot: SLOT,
            fd: this.options.fd,
            stallMs: this.options.stallMs,
            pollMs: this.options.pollMs,
            repeatMs: STALL_REPEAT_MS,
            levels: MEMORY_LEVELS,
            hysteresis: MEMORY_HYSTERESIS,
            limitMbFallback: this.options.limitMb,
            cgroupDir: this.options.cgroupDir,
            bootPhase: this.bootPhase,
            restart,
        };
        // env/execArgv leer wie bei den Dog-Workern: der Wachposten braucht weder Server-Env noch die -r-Preloads.
        const worker = new Worker(WATCHPOST_THREAD_SOURCE, {
            eval: true,
            workerData,
            env: {},
            execArgv: [],
            resourceLimits: { maxOldGenerationSizeMb: 8, maxYoungGenerationSizeMb: 2, stackSizeMb: 1 },
        });
        worker.unref();
        worker.on('error', (err) => {
            console.error('[watchpost] Fehler im Wachposten-Thread:', err instanceof Error ? err.stack || err.message : err);
        });
        worker.on('exit', (code) => this.onExit(worker, code));
        this.worker = worker;
    }

    private onExit(worker: Worker, code: number): void {
        if (this.worker !== worker) return;
        this.worker = null;
        if (this.stopping) return;
        if (this.restarts >= MAX_RESTARTS) {
            console.error(`[watchpost] Thread beendet (Code ${code}) — kein weiterer Neustart, der Server laeuft ohne Wachposten.`);
            return;
        }
        this.restarts += 1;
        console.error(`[watchpost] Thread beendet (Code ${code}) — Neustart ${this.restarts}/${MAX_RESTARTS}.`);
        try {
            this.spawn(true);
        } catch (err) {
            console.error('[watchpost] Neustart gescheitert — der Server laeuft ohne Wachposten:', err);
        }
    }

    private post(message: WatchpostMessage): void {
        try {
            this.worker?.postMessage(message);
        } catch {
            // Ein Beobachter darf nie stoeren.
        }
    }
}
