/**
 * ~~~ DOG WORKER GATE — Slot-Deckel und Speicher-Waechter mit Gegendruck ~~~
 *
 * Jeder SerializedDog-Lauf spannt ein eigenes Worker-Isolat auf. Zwei Deckel halten den Prozess
 * unter seinem Container-Budget:
 *
 *   1. Der Slot-Deckel (`DOG_WORKER_GLOBAL_LIMIT`) zaehlt LEBENDE Isolate ueber alle Laeufe und
 *      Requests. Ein Slot wird erst frei, wenn das Isolat wirklich beendet ist (`'exit'` des Workers),
 *      nicht schon, wenn das Ergebnis da ist. Frueher ging der Slot im finally zurueck, waehrend
 *      `terminate()` noch lief — gemessen lebten dann 2 Isolate bei Limit 1.
 *
 *   2. Der Speicher-Waechter misst die echte Prozess-RSS — NACH dem Slot, unmittelbar vor dem Spawn.
 *      Steht sie ueber dem Soft-Limit:
 *        a) zuerst ein GC-Versuch (gedrosselt) und neu messen — die RSS zaehlt uneingesammelten Muell
 *           mit (lokal gemessen: 67 MB Muell, RSS fiel nach GC um 61 MB);
 *        b) laeuft noch ein anderes Isolat, wird auf dessen Ende gewartet (begrenzt durch
 *           `MEMORY_GUARD_WAIT_MS`) und neu gemessen. Gewartet wird NUR auf Isolat-Enden, nie auf eine
 *           Slot-Freigabe — sonst wartet bei Limit 1 ein Slot-Inhaber auf sich selbst;
 *        c) laeuft kein Isolat mehr (niemand gibt mehr Speicher frei) oder ist die Frist um, wird
 *           abgewiesen — mit DOG_MEMPRESSURE_MARKER und einer Logzeile.
 *      Wartende werden der Reihe nach geweckt, einer je beendetem Isolat; endet das letzte Isolat,
 *      werden alle geweckt (sonst warteten sie als Waisen bis zur Frist).
 *
 *   3. Der Laufzeit-Waechter misst WAEHREND Isolate leben (alle `MEMORY_RUNTIME_CHECK_MS`, nur dann laeuft
 *      sein Timer). Die Zulassung oben sieht nur den Augenblick vor dem Spawn; ein Worker, der danach
 *      waechst, lief bis zum Kill des ganzen Containers. Gemessen wird, was der OOM-Killer zaehlt: der
 *      Arbeitsspeicher der cgroup (memory.current - inactive_file, v2; ohne cgroup die RSS). Steht er ueber der harten Schwelle
 *      (`MEMORY_HARD_LIMIT_MB`, sonst Budget minus 96 MB), erst ein GC-Versuch, dann wird das JUENGSTE
 *      laufende Isolat beendet — sein Lauf scheitert mit DOG_MEMPRESSURE_MARKER (wie eine Abweisung,
 *      also 503 am Lead), der Prozess lebt weiter. Ein Isolat je Takt, damit die RSS fallen kann.
 *
 * process.memoryUsage().rss umfasst den ganzen Prozess inkl. aller Worker-Threads — die Zahl, nach der
 * auch der OOM-Killer des Containers entscheidet. Prozesse daneben (npm, sh, cross-env) sieht sie nicht.
 */

import { DOG_MEMPRESSURE_MARKER } from "../core/entities/IDogRunObserver";

/** Default des globalen Slot-Deckels — auf 512 MB ausgelegt (2 Isolate ~ 2 x (64 + 16) MB Worst Case). */
const DEFAULT_DOG_WORKER_GLOBAL_LIMIT = 2;
/** Container-Budget in MB, Bezugsgroesse des Waechters. */
const DEFAULT_MEMORY_LIMIT_MB = 512;
/** Soft-Limit ohne eigene Angabe: dieser Anteil des Budgets. */
const DEFAULT_MEMORY_SOFT_LIMIT_SHARE = 0.85;
/** So lange wartet ein Spawn hoechstens auf das Ende anderer Isolate, bevor er abgewiesen wird. */
const DEFAULT_MEMORY_GUARD_WAIT_MS = 30_000;
/** Mindestabstand zwischen zwei erzwungenen GCs — ein voller GC haelt die Ereignisschleife an. */
const DEFAULT_MEMORY_GUARD_GC_MIN_INTERVAL_MS = 2_000;
/**
 * Harte Schwelle ohne eigene Angabe: so viel unter dem Budget — Luft fuer den Takt bis zur naechsten Messung und
 * fuer terminate() bis zur Freigabe. Gemessen (Docker -m 512m, nativer Speicherfresser, 100-ms-Takt): bei 24 MB
 * Luft starb der Container in 3 von 5 Faellen, bei 64 MB keiner (memory.peak bis 489), bei 96 MB keiner (bis 452).
 */
const DEFAULT_MEMORY_HARD_LIMIT_HEADROOM_MB = 96;
/**
 * Takt des Laufzeit-Waechters, solange Isolate leben. 100 statt 500 ms: gemessen (Gauss, 08.10.) baut ein
 * Worker mit nativen Puffern 221-231 MB je 500 ms auf — bei 500 ms waere die Marge zigfach ueberrannt.
 */
const DEFAULT_MEMORY_RUNTIME_CHECK_MS = 100;

const MB = 1024 * 1024;

function positiveNumberFromEnv(name: string): number | undefined {
    const configured = Number(process.env[name]);
    return Number.isFinite(configured) && configured > 0 ? configured : undefined;
}

function positiveIntFromEnv(name: string): number | undefined {
    const configured = Number(process.env[name]);
    return Number.isInteger(configured) && configured > 0 ? configured : undefined;
}

/** Non-negative Integer (0 erlaubt) aus der Umgebung. */
function nonNegativeIntFromEnv(name: string): number | undefined {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return undefined;
    const configured = Number(raw);
    return Number.isInteger(configured) && configured >= 0 ? configured : undefined;
}

/** Wie misst und raeumt der Waechter? Austauschbar, damit Tests deterministisch sind. */
export interface MemoryProbe {
    /** Prozess-RSS in Bytes. */
    rssBytes(): number;
    /** Ein voller GC; false, wenn keiner verfuegbar ist. */
    collectGarbage(): boolean;
    /**
     * Was der Container-OOM-Killer zaehlt, in Bytes — fuer den Laufzeit-Waechter. Ohne diese Methode
     * (Tests) misst er rssBytes().
     */
    containerBytes?(): number;
}

const CGROUP_V2_CURRENT = '/sys/fs/cgroup/memory.current';
const CGROUP_V2_STAT = '/sys/fs/cgroup/memory.stat';

/**
 * Arbeitsspeicher der cgroup (v2): memory.current minus inactive_file — dieselbe "working set"-Zahl, nach
 * der kubelet/cAdvisor entscheiden. memory.current allein zaehlt auch Datei-Cache mit, den der Kernel vor
 * einem OOM-Kill erst zurueckholt; der Waechter wuerde sonst Dogs beenden, obwohl nur Cache im Weg liegt.
 * null, wenn keine cgroup v2 lesbar ist (Windows, macOS, cgroup v1) — dann misst der Waechter die RSS.
 * Kosten: zwei kleine Dateien aus /sys, Mikrosekunden — darum auch im 100-ms-Takt vertretbar.
 */
function readCgroupWorkingSetBytes(): number | null {
    let fs: typeof import('fs');
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        fs = require('fs');
        const current = Number(fs.readFileSync(CGROUP_V2_CURRENT, 'utf8').trim());
        if (!Number.isFinite(current)) return null;
        let inactiveFile = 0;
        try {
            const match = /^inactive_file (\d+)$/m.exec(fs.readFileSync(CGROUP_V2_STAT, 'utf8'));
            if (match) inactiveFile = Number(match[1]);
        } catch { /* ohne memory.stat: memory.current allein */ }
        return Math.max(0, current - inactiveFile);
    } catch {
        return null;
    }
}

/**
 * Die echte Messung. `global.gc` gibt es nur mit `--expose-gc` (die Startskripte setzen es). Fehlt es,
 * holt der Waechter sich die Funktion einmal ueber V8-Flag + frischen VM-Kontext — der bekannte, von Node
 * selbst getragene Weg. Scheitert auch das, bleibt es beim Messen ohne GC. Worker erben das Flag nicht
 * (execArgv: []) — Dog-Code bekommt kein gc().
 */
class ProcessMemoryProbe implements MemoryProbe {
    private gcFn: (() => void) | null | undefined;
    private cgroupReadable: boolean | undefined;

    rssBytes(): number {
        return process.memoryUsage().rss;
    }

    /** cgroup-Arbeitsspeicher, sonst RSS. Ist die cgroup einmal unlesbar, wird sie nicht mehr versucht. */
    containerBytes(): number {
        if (this.cgroupReadable !== false) {
            const bytes = readCgroupWorkingSetBytes();
            this.cgroupReadable = bytes !== null;
            if (bytes !== null) return bytes;
        }
        return this.rssBytes();
    }

    /** Welche Quelle der Laufzeit-Waechter misst — fuer health_check. */
    get containerSource(): 'cgroup' | 'rss' {
        if (this.cgroupReadable === undefined) this.containerBytes();
        return this.cgroupReadable ? 'cgroup' : 'rss';
    }

    collectGarbage(): boolean {
        const gc = this.resolveGc();
        if (!gc) return false;
        try {
            gc();
            return true;
        } catch {
            return false;
        }
    }

    get gcAvailable(): boolean {
        return this.resolveGc() !== null;
    }

    private resolveGc(): (() => void) | null {
        if (this.gcFn !== undefined) return this.gcFn ?? null;
        const exposed = (globalThis as any).gc;
        if (typeof exposed === 'function') {
            this.gcFn = exposed as () => void;
            return exposed as () => void;
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const v8 = require('v8');
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const vm = require('vm');
            v8.setFlagsFromString('--expose-gc');
            const fromContext = vm.runInNewContext('gc');
            this.gcFn = typeof fromContext === 'function' ? fromContext : null;
        } catch {
            this.gcFn = null;
        }
        return this.gcFn ?? null;
    }
}

/** Was ein Aufrufer ueber den Zustand des Tors erfahren darf (health_check) — Zahlen, keine Namen. */
export interface DogWorkerGateStats {
    slotLimit: number;
    slotsActive: number;
    slotWaiters: number;
    liveIsolates: number;
    terminatingIsolates: number;
    memoryWaiters: number;
    memoryRejectionsSinceBoot: number;
    memoryGuardEnabled: boolean;
    memoryLimitMb: number;
    memorySoftLimitMb: number;
    memoryGuardWaitMs: number;
    gcAvailable: boolean;
    gcRunsSinceBoot: number;
    slotReleaseAnomalies: number;
    memoryHardLimitMb: number;
    memoryRuntimeCheckMs: number;
    /** Laufende Isolate, die der Laufzeit-Waechter seit Start beendet hat. */
    memoryRuntimeKillsSinceBoot: number;
    /** Was der Laufzeit-Waechter misst: cgroup-Arbeitsspeicher oder (ohne cgroup v2) Prozess-RSS. */
    memoryRuntimeSource: 'cgroup' | 'rss';
}

/** Wer um Speicher bittet — nur fuer die Fehlermeldung und das Log. */
export interface DogWorkerApplicant {
    storageId: string;
    name: string;
}

/** Ein belegter Slot. Wird genau einmal zurueckgegeben — ein zweiter Aufruf ist wirkungslos. */
export class DogWorkerLease {
    private released = false;

    constructor(private readonly gate: DogWorkerGate) {}

    get isReleased(): boolean {
        return this.released;
    }

    release(): void {
        if (this.released) return;
        this.released = true;
        this.gate.releaseSlot();
    }
}

/** Beendet den Lauf eines Isolats mit diesem Fehler (terminate + reject) — vom Laufzeit-Waechter gerufen. */
export type DogIsolateKill = (error: Error) => void;

/**
 * Ein lebendes Isolat. `terminating()` beim Ergebnis (terminate() angestossen), `exited()` genau einmal
 * aus dem `'exit'`-Ereignis des Workers — erst dann geht der Slot zurueck. Mit `kill` kann der
 * Laufzeit-Waechter es unter Speicherdruck beenden.
 */
export class DogIsolateHandle {
    private terminatingMarked = false;
    private exitedMarked = false;

    constructor(
        private readonly gate: DogWorkerGate,
        private readonly lease: DogWorkerLease,
        readonly applicant?: DogWorkerApplicant,
        private readonly kill?: DogIsolateKill,
    ) {}

    /** Kann der Laufzeit-Waechter dieses Isolat beenden? Nur, solange es noch rechnet. */
    get killable(): boolean {
        return this.kill !== undefined && !this.terminatingMarked && !this.exitedMarked;
    }

    terminating(): void {
        if (this.terminatingMarked || this.exitedMarked) return;
        this.terminatingMarked = true;
        this.gate.isolateTerminating();
    }

    exited(): void {
        if (this.exitedMarked) return;
        this.exitedMarked = true;
        this.gate.isolateExited(this, this.terminatingMarked);
        this.lease.release();
    }

    /** Nur ueber DogWorkerGate — der Aufrufer (SerializedDog) markiert terminating und beendet den Worker. */
    killForMemory(error: Error): void {
        if (!this.killable) return;
        this.kill!(error);
    }
}

export class DogWorkerGate {
    /** Das prozessweite Tor — alle Laeufe aller Requests teilen es. */
    public static readonly shared = new DogWorkerGate();

    private activeSlots = 0;
    private readonly slotWaiters: Array<() => void> = [];
    private liveIsolates = 0;
    private terminatingIsolates = 0;
    private readonly exitWaiters: Array<() => void> = [];
    private memoryRejections = 0;
    private releaseAnomalies = 0;
    private gcRuns = 0;
    private lastGcAt = 0;
    private readonly processProbe = new ProcessMemoryProbe();
    private probe: MemoryProbe = this.processProbe;
    /** Lebende Isolate in Spawn-Reihenfolge (das letzte ist das juengste). */
    private readonly liveHandles: DogIsolateHandle[] = [];
    private runtimeTimer: ReturnType<typeof setInterval> | null = null;
    private runtimeKills = 0;

    // --- Konfiguration (bei jedem Zugriff aus der Env, damit Tests und Betrieb sie umstellen koennen) ---

    static slotLimit(): number {
        return positiveIntFromEnv('DOG_WORKER_GLOBAL_LIMIT') ?? DEFAULT_DOG_WORKER_GLOBAL_LIMIT;
    }

    static memoryLimitMb(): number {
        return positiveNumberFromEnv('MEMORY_LIMIT_MB') ?? DEFAULT_MEMORY_LIMIT_MB;
    }

    /**
     * Schwelle, ab der der Waechter eingreift. Explizit via MEMORY_SOFT_LIMIT_MB, sonst 85 % des Budgets —
     * Luft fuer ein frisch gespawntes Isolat (64 + 16 MB Deckel) zwischen Messung und hartem Deckel.
     */
    static memorySoftLimitMb(): number {
        return positiveNumberFromEnv('MEMORY_SOFT_LIMIT_MB')
            ?? Math.round(DogWorkerGate.memoryLimitMb() * DEFAULT_MEMORY_SOFT_LIMIT_SHARE);
    }

    /**
     * Der Waechter ist im Betrieb AN, in der Entwicklung AUS: unter ts-node liegt die RSS dauerhaft weit
     * ueber 512 MB (Toolchain im selben Prozess) — er wuerde jeden Dog abweisen. MEMORY_GUARD=1/0
     * ueberschreibt die Automatik in beide Richtungen.
     */
    static memoryGuardEnabled(): boolean {
        const flag = process.env.MEMORY_GUARD;
        if (flag === '1' || flag === 'true') return true;
        if (flag === '0' || flag === 'false') return false;
        return process.env.NODE_ENV !== 'development';
    }

    /** Wartebudget auf das Ende anderer Isolate; 0 = sofort abweisen (das alte Verhalten). */
    static memoryGuardWaitMs(): number {
        return nonNegativeIntFromEnv('MEMORY_GUARD_WAIT_MS') ?? DEFAULT_MEMORY_GUARD_WAIT_MS;
    }

    static gcMinIntervalMs(): number {
        return nonNegativeIntFromEnv('MEMORY_GUARD_GC_MIN_INTERVAL_MS') ?? DEFAULT_MEMORY_GUARD_GC_MIN_INTERVAL_MS;
    }

    /** Ab hier beendet der Laufzeit-Waechter laufende Isolate. Explizit via MEMORY_HARD_LIMIT_MB, sonst Budget - 96. */
    static memoryHardLimitMb(): number {
        return positiveNumberFromEnv('MEMORY_HARD_LIMIT_MB')
            ?? DogWorkerGate.memoryLimitMb() - DEFAULT_MEMORY_HARD_LIMIT_HEADROOM_MB;
    }

    static memoryRuntimeCheckMs(): number {
        return positiveIntFromEnv('MEMORY_RUNTIME_CHECK_MS') ?? DEFAULT_MEMORY_RUNTIME_CHECK_MS;
    }

    // --- Slots ---

    /** Einen Slot belegen — wartet (FIFO), bis einer frei ist. Gegendruck statt OOM. */
    async acquire(): Promise<DogWorkerLease> {
        if (this.activeSlots < DogWorkerGate.slotLimit()) {
            this.activeSlots++;
            return new DogWorkerLease(this);
        }
        // Beim Freigeben wird der Slot DIREKT uebergeben (die Zahl bleibt) — hier nicht hochzaehlen.
        await new Promise<void>((resolve) => this.slotWaiters.push(resolve));
        return new DogWorkerLease(this);
    }

    /** Nur ueber DogWorkerLease.release() — die Lease garantiert "genau einmal". */
    releaseSlot(): void {
        const next = this.slotWaiters.shift();
        if (next) {
            next();
            return;
        }
        if (this.activeSlots <= 0) {
            // Mehr Freigaben als Belegungen waere ein Fehler im Aufrufer. Nicht kaschieren: zaehlen und laut sagen.
            this.releaseAnomalies++;
            console.error(`[DogWorkerGate] slot released more often than acquired (anomaly #${this.releaseAnomalies})`);
            return;
        }
        this.activeSlots--;
    }

    // --- Isolate ---

    /**
     * Direkt nach erfolgreichem `new Worker(...)`. Mit `kill` darf der Laufzeit-Waechter das Isolat unter
     * Speicherdruck beenden; sein Timer laeuft nur, solange ein solches Isolat lebt.
     */
    isolateSpawned(lease: DogWorkerLease, applicant?: DogWorkerApplicant, kill?: DogIsolateKill): DogIsolateHandle {
        this.liveIsolates++;
        const handle = new DogIsolateHandle(this, lease, applicant, kill);
        this.liveHandles.push(handle);
        if (kill) this.startRuntimeGuard();
        return handle;
    }

    /** Nur ueber DogIsolateHandle. */
    isolateTerminating(): void {
        this.terminatingIsolates++;
    }

    /** Nur ueber DogIsolateHandle — genau einmal je Worker. */
    isolateExited(handle: DogIsolateHandle, wasTerminating: boolean): void {
        const at = this.liveHandles.indexOf(handle);
        if (at >= 0) this.liveHandles.splice(at, 1);
        if (!this.liveHandles.some((h) => h.killable)) this.stopRuntimeGuard();
        if (wasTerminating && this.terminatingIsolates > 0) this.terminatingIsolates--;
        if (this.liveIsolates <= 0) {
            console.error('[DogWorkerGate] isolate exit without a live isolate — counter out of step');
        } else {
            this.liveIsolates--;
        }
        if (this.liveIsolates === 0) {
            // Niemand mehr da, der Speicher freigeben koennte: ALLE neu bewerten lassen.
            this.wakeAllMemoryWaiters();
        } else {
            // Sonst genau einen — misst die ganze Herde denselben Wert, spawnt sie gemeinsam.
            this.exitWaiters.shift()?.();
        }
    }

    // --- Speicher-Waechter ---

    /**
     * Zulassung zum Spawn — wird mit einem belegten Slot aufgerufen. Wirft mit DOG_MEMPRESSURE_MARKER,
     * wenn der Speicher auch nach GC und Warten nicht reicht. Der Aufrufer gibt seinen Slot dann zurueck.
     */
    async admit(applicant: DogWorkerApplicant): Promise<void> {
        if (!DogWorkerGate.memoryGuardEnabled()) return;
        const startedAt = Date.now();
        const deadline = startedAt + DogWorkerGate.memoryGuardWaitMs();
        let waited = false;
        for (;;) {
            // Strikte Reihenfolge: wer neu kommt, misst nicht an schon Wartenden vorbei.
            if (!waited && this.exitWaiters.length > 0 && this.liveIsolates > 0) {
                waited = true;
                await this.waitForIsolateExit(deadline - Date.now());
                continue;
            }
            const softMb = DogWorkerGate.memorySoftLimitMb();
            let rssMb = this.readRssMb();
            if (rssMb < softMb) return;
            if (this.tryCollectGarbage()) {
                rssMb = this.readRssMb();
                if (rssMb < softMb) return;
            }
            const remaining = deadline - Date.now();
            if (this.liveIsolates === 0 || remaining <= 0) {
                throw this.reject(applicant, rssMb, softMb, Date.now() - startedAt);
            }
            waited = true;
            await this.waitForIsolateExit(remaining);
        }
    }

    stats(): DogWorkerGateStats {
        return {
            slotLimit: DogWorkerGate.slotLimit(),
            slotsActive: this.activeSlots,
            slotWaiters: this.slotWaiters.length,
            liveIsolates: this.liveIsolates,
            terminatingIsolates: this.terminatingIsolates,
            memoryWaiters: this.exitWaiters.length,
            memoryRejectionsSinceBoot: this.memoryRejections,
            memoryGuardEnabled: DogWorkerGate.memoryGuardEnabled(),
            memoryLimitMb: DogWorkerGate.memoryLimitMb(),
            memorySoftLimitMb: DogWorkerGate.memorySoftLimitMb(),
            memoryGuardWaitMs: DogWorkerGate.memoryGuardWaitMs(),
            gcAvailable: this.probe === this.processProbe ? this.processProbe.gcAvailable : true,
            gcRunsSinceBoot: this.gcRuns,
            slotReleaseAnomalies: this.releaseAnomalies,
            memoryHardLimitMb: DogWorkerGate.memoryHardLimitMb(),
            memoryRuntimeCheckMs: DogWorkerGate.memoryRuntimeCheckMs(),
            memoryRuntimeKillsSinceBoot: this.runtimeKills,
            memoryRuntimeSource: this.containerSource,
        };
    }

    /** Laeuft der Laufzeit-Waechter gerade? (Tests, Diagnose) */
    get runtimeGuardActive(): boolean {
        return this.runtimeTimer !== null;
    }

    // --- Laufzeit-Waechter ---

    private startRuntimeGuard(): void {
        if (this.runtimeTimer) return;
        this.runtimeTimer = setInterval(() => this.checkRuntimeMemory(), DogWorkerGate.memoryRuntimeCheckMs());
        // Ein lebender Worker haelt die Ereignisschleife selbst; der Takt soll es nicht.
        this.runtimeTimer.unref?.();
    }

    private stopRuntimeGuard(): void {
        if (!this.runtimeTimer) return;
        clearInterval(this.runtimeTimer);
        this.runtimeTimer = null;
    }

    /**
     * Ein Takt: unter der harten Schwelle nichts; darueber ein (gedrosselter) GC-Versuch, und reicht der nicht,
     * wird das juengste noch rechnende Isolat beendet. Juengstes statt groesstes: die Groesse je Worker kennt
     * nur eine asynchrone Heap-Abfrage je Isolat — bis die antwortet, ist der Container schon tot; das
     * juengste hat am wenigsten Arbeit verloren und ist meist das, mit dem die Spitze kam.
     */
    private checkRuntimeMemory(): void {
        if (!DogWorkerGate.memoryGuardEnabled()) return;
        const hardMb = DogWorkerGate.memoryHardLimitMb();
        let usedMb = this.readContainerMb();
        if (usedMb < hardMb) return;
        if (this.tryCollectGarbage()) {
            usedMb = this.readContainerMb();
            if (usedMb < hardMb) return;
        }
        const source = this.containerSource;
        const victim = [...this.liveHandles].reverse().find((h) => h.killable);
        if (!victim) return;
        this.runtimeKills++;
        const limitMb = DogWorkerGate.memoryLimitMb();
        const who = victim.applicant ? `${victim.applicant.storageId} ("${victim.applicant.name}")` : '(unbekannt)';
        console.warn(
            `[DogWorkerGate] runtime memory guard terminated dog ${who}: ${source} ${usedMb} MB >= hard limit ${hardMb} MB `
            + `of ${limitMb} MB, live isolates ${this.liveIsolates}, runtime kills since boot ${this.runtimeKills}`,
        );
        victim.killForMemory(new Error(
            `SerializedDog ${who}: ${DOG_MEMPRESSURE_MARKER} (runtime guard: ${source} ${usedMb} MB >= hard limit ${hardMb} MB `
            + `of ${limitMb} MB; the dog was terminated mid-run to keep the container alive). Retry shortly. `
            + `Tune via MEMORY_HARD_LIMIT_MB / MEMORY_LIMIT_MB, or lower DOG_WORKER_GLOBAL_LIMIT / DOG_WORKER_MAX_HEAP_MB.`,
        ));
    }

    /** Nur fuer Tests: eine eigene Messung einsetzen; null stellt die echte wieder her. */
    setMemoryProbe(probe: MemoryProbe | null): void {
        this.probe = probe ?? this.processProbe;
        this.lastGcAt = 0;
    }

    private readRssMb(): number {
        return Math.round(this.probe.rssBytes() / MB);
    }

    /** Laufzeit-Waechter: cgroup-Arbeitsspeicher (sieht auch Prozesse neben dem Server), sonst RSS. */
    private readContainerMb(): number {
        return Math.round((this.probe.containerBytes ? this.probe.containerBytes() : this.probe.rssBytes()) / MB);
    }

    /** Welche Zahl der Laufzeit-Waechter misst: 'cgroup' (memory.current - inactive_file) oder 'rss'. */
    get containerSource(): 'cgroup' | 'rss' {
        return this.probe === this.processProbe ? this.processProbe.containerSource : (this.probe.containerBytes ? 'cgroup' : 'rss');
    }

    /** GC hoechstens alle MEMORY_GUARD_GC_MIN_INTERVAL_MS — ein voller GC haelt die Ereignisschleife an. */
    private tryCollectGarbage(): boolean {
        const now = Date.now();
        if (this.lastGcAt > 0 && now - this.lastGcAt < DogWorkerGate.gcMinIntervalMs()) return false;
        this.lastGcAt = now;
        const collected = this.probe.collectGarbage();
        if (collected) this.gcRuns++;
        return collected;
    }

    /**
     * Wartet auf das naechste Isolat-Ende oder die Frist. Der Timer ist unref'd: gewartet wird nur, solange
     * ein Isolat lebt — und ein lebender Worker haelt die Ereignisschleife selbst am Leben.
     */
    private waitForIsolateExit(ms: number): Promise<void> {
        return new Promise<void>((resolve) => {
            let done = false;
            const wake = (): void => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                resolve();
            };
            const timer = setTimeout(() => {
                const index = this.exitWaiters.indexOf(wake);
                if (index >= 0) this.exitWaiters.splice(index, 1);
                wake();
            }, Math.max(0, ms));
            timer.unref?.();
            this.exitWaiters.push(wake);
        });
    }

    private wakeAllMemoryWaiters(): void {
        for (const wake of this.exitWaiters.splice(0)) wake();
    }

    private reject(applicant: DogWorkerApplicant, rssMb: number, softMb: number, waitedMs: number): Error {
        this.memoryRejections++;
        const limitMb = DogWorkerGate.memoryLimitMb();
        const reason = this.liveIsolates === 0 ? 'no other dog is running that could free memory' : `waited ${waitedMs} ms`;
        console.warn(
            `[DogWorkerGate] memory guard refused dog ${applicant.storageId} ("${applicant.name}"): `
            + `RSS ${rssMb} MB >= soft limit ${softMb} MB of ${limitMb} MB, live isolates ${this.liveIsolates}, `
            + `waited ${waitedMs} ms, rejections since boot ${this.memoryRejections}`,
        );
        // Endet hier niemand mehr, warten die anderen sonst umsonst bis zur Frist.
        if (this.liveIsolates === 0) this.wakeAllMemoryWaiters();
        return new Error(
            `SerializedDog ${applicant.storageId} ("${applicant.name}"): ${DOG_MEMPRESSURE_MARKER} `
            + `(RSS ${rssMb} MB >= soft limit ${softMb} MB of ${limitMb} MB; ${reason}). `
            + `The dog was not run to avoid an out-of-memory crash of the whole container; retry shortly. `
            + `Tune via MEMORY_SOFT_LIMIT_MB / MEMORY_LIMIT_MB / MEMORY_GUARD_WAIT_MS, or lower DOG_WORKER_GLOBAL_LIMIT.`
        );
    }
}
