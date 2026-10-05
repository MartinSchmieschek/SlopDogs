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
}

/**
 * Die echte Messung. `global.gc` gibt es nur mit `--expose-gc` (die Startskripte setzen es). Fehlt es,
 * holt der Waechter sich die Funktion einmal ueber V8-Flag + frischen VM-Kontext — der bekannte, von Node
 * selbst getragene Weg. Scheitert auch das, bleibt es beim Messen ohne GC. Worker erben das Flag nicht
 * (execArgv: []) — Dog-Code bekommt kein gc().
 */
class ProcessMemoryProbe implements MemoryProbe {
    private gcFn: (() => void) | null | undefined;

    rssBytes(): number {
        return process.memoryUsage().rss;
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

/**
 * Ein lebendes Isolat. `terminating()` beim Ergebnis (terminate() angestossen), `exited()` genau einmal
 * aus dem `'exit'`-Ereignis des Workers — erst dann geht der Slot zurueck.
 */
export class DogIsolateHandle {
    private terminatingMarked = false;
    private exitedMarked = false;

    constructor(private readonly gate: DogWorkerGate, private readonly lease: DogWorkerLease) {}

    terminating(): void {
        if (this.terminatingMarked || this.exitedMarked) return;
        this.terminatingMarked = true;
        this.gate.isolateTerminating();
    }

    exited(): void {
        if (this.exitedMarked) return;
        this.exitedMarked = true;
        this.gate.isolateExited(this.terminatingMarked);
        this.lease.release();
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

    /** Direkt nach erfolgreichem `new Worker(...)`. */
    isolateSpawned(lease: DogWorkerLease): DogIsolateHandle {
        this.liveIsolates++;
        return new DogIsolateHandle(this, lease);
    }

    /** Nur ueber DogIsolateHandle. */
    isolateTerminating(): void {
        this.terminatingIsolates++;
    }

    /** Nur ueber DogIsolateHandle — genau einmal je Worker. */
    isolateExited(wasTerminating: boolean): void {
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
        };
    }

    /** Nur fuer Tests: eine eigene Messung einsetzen; null stellt die echte wieder her. */
    setMemoryProbe(probe: MemoryProbe | null): void {
        this.probe = probe ?? this.processProbe;
        this.lastGcAt = 0;
    }

    private readRssMb(): number {
        return Math.round(this.probe.rssBytes() / MB);
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
