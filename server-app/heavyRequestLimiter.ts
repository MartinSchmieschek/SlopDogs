/**
 * ~~~ HEAVY REQUEST LIMITER — eine Schleuse vor den teuren Pfaden ~~~
 *
 * Body-Limits (express.json) deckeln, was HEREIN kommt. Sie sagen nichts darueber,
 * wie viele teure Antworten der Prozess GLEICHZEITIG baut — und genau dort entsteht
 * die Speicherspitze: ein Kennel-Run oder ein Listen-Endpunkt haelt waehrend seiner
 * Laufzeit Zeilen, geparste Configs und Ergebnisse im Heap. Zehn davon parallel sind
 * zehnmal so viel, und in einem 512-MB-Container ist das die Wasserlinie, die danach
 * nicht mehr faellt.
 *
 * Die Schleuse laesst `MAX_CONCURRENT_HEAVY_REQUESTS` gleichzeitig durch; der Rest
 * wartet in einer FIFO-Schlange. Wer nicht binnen `HEAVY_REQUEST_QUEUE_TIMEOUT_MS`
 * an die Reihe kommt, bekommt 503 mit `Retry-After` statt einer haengenden Verbindung.
 *
 * Bewusst grosszuegig: eine zu enge Bremse bricht die UI, die beim Seitenaufbau
 * mehrere dieser Pfade parallel zieht. Die Schleuse soll die SPITZE kappen, nicht
 * den Normalbetrieb takten.
 *
 * Zwei Instanzen, zwei Toepfe: `heavy()` fuer UI-Listen und Runs der Werkstatt,
 * `publicRuns()` fuer oeffentliche Kennel-Laeufe (`/k/:id`, `/k/:id/openapi.json`).
 * Getrennt, damit die UI nicht hinter einer Besucherwelle wartet — und Besucher
 * nicht an jeder Bremse vorbeilaufen.
 */

import type { Application, RequestHandler } from 'express';

/**
 * Default-Breite der Schleuse. Nicht 4: der Waves-Viewer zieht beim Seitenaufbau
 * Node- und Kennel-Liste parallel und startet danach Runs; bei 4 stellt sich ein
 * einzelner Nutzer schon selbst in die Warteschlange. 8 laesst den Normalbetrieb in
 * Ruhe und begrenzt die Spitze trotzdem auf eine Groesse, die in 512 MB passt.
 * Wer misst, setzt MAX_CONCURRENT_HEAVY_REQUESTS.
 */
const DEFAULT_MAX_CONCURRENT_HEAVY_REQUESTS = 8;

/** Wartebudget in der Schlange, bevor 503 gemeldet wird. */
const DEFAULT_HEAVY_REQUEST_QUEUE_TIMEOUT_MS = 20_000;

/**
 * Breite der Public-Schleuse. 4 statt 8: 512 MB, --max-old-space-size=320, und jeder
 * oeffentliche Lauf haelt seine Waves im Heap. Gesetzt, nicht gemessen — wer misst,
 * setzt MAX_CONCURRENT_PUBLIC_RUNS.
 */
const DEFAULT_MAX_CONCURRENT_PUBLIC_RUNS = 4;

/** Wartebudget in der Public-Schlange, bevor 503 gemeldet wird. */
const DEFAULT_PUBLIC_RUN_QUEUE_TIMEOUT_MS = 20_000;

/** Liest einen positiven Integer aus der Umgebung; alles andere faellt auf den Default. */
function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

interface QueuedRequest {
    grant: (granted: boolean) => void;
    timer: ReturnType<typeof setTimeout>;
}

export interface HeavyRequestLimiterOptions {
    /** Fuer Log und 503-Text: 'heavy' | 'public'. */
    name: string;
    /** Getestet gegen req.path. */
    paths: readonly RegExp[];
    /** Gebremste Methoden; ohne Angabe alle. */
    methods?: readonly string[];
    maxConcurrent: number;
    queueTimeoutMs: number;
}

export class HeavyRequestLimiter {
    /**
     * Die teuren Pfade: Kennel-Run (fuehrt die ganze Meute aus) und die beiden
     * Listen-Endpunkte (ziehen eine Typ-Partition und parsen sie). Alles andere
     * laeuft ungebremst durch — eine Schleuse vor `/api/kennels/:id` waere nur Reibung.
     */
    private static readonly HEAVY_PATHS: readonly RegExp[] = [
        /^\/api\/kennels\/?$/,
        /^\/api\/nodes\/?$/,
        /^\/api\/kennels\/[^/]+\/(run|execute)\/?$/,
    ];

    /**
     * Die oeffentlichen Laeufe: `/k/:id` und die Spec-Erzeugung `/k/:id/openapi.json`.
     * Seit dem Praefix `/k/` exakt: kein Angular-Artefakt, kein festes Segment und kein
     * Kennel-Name mit Punkt faellt mehr durch. `/k/:id/docs` liefert nur statisches HTML
     * und bleibt ungebremst. Disjunkt zu HEAVY_PATHS — kein Request wird doppelt gebremst.
     */
    private static readonly PUBLIC_PATHS: readonly RegExp[] = [
        /^\/k\/[^/]+\/?$/,
        /^\/k\/[^/]+\/openapi\.json\/?$/,
    ];

    /** UI-Listen und Runs der Werkstatt. */
    public static heavy(): HeavyRequestLimiter {
        return new HeavyRequestLimiter({
            name: 'heavy',
            paths: HeavyRequestLimiter.HEAVY_PATHS,
            maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_HEAVY_REQUESTS', DEFAULT_MAX_CONCURRENT_HEAVY_REQUESTS),
            queueTimeoutMs: positiveIntFromEnv('HEAVY_REQUEST_QUEUE_TIMEOUT_MS', DEFAULT_HEAVY_REQUEST_QUEUE_TIMEOUT_MS),
        });
    }

    /** Oeffentliche Kennel-Laeufe. HEAD bleibt ungebremst — er fuehrt keinen Lauf aus. */
    public static publicRuns(): HeavyRequestLimiter {
        return new HeavyRequestLimiter({
            name: 'public',
            paths: HeavyRequestLimiter.PUBLIC_PATHS,
            methods: ['GET', 'POST'],
            maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_PUBLIC_RUNS', DEFAULT_MAX_CONCURRENT_PUBLIC_RUNS),
            queueTimeoutMs: positiveIntFromEnv('PUBLIC_RUN_QUEUE_TIMEOUT_MS', DEFAULT_PUBLIC_RUN_QUEUE_TIMEOUT_MS),
        });
    }

    private active = 0;
    private readonly waiting: QueuedRequest[] = [];
    private readonly name: string;
    private readonly paths: readonly RegExp[];
    /** Grossgeschriebene Methoden; null = alle. */
    private readonly methods: ReadonlySet<string> | null;
    private readonly maxConcurrent: number;
    private readonly queueTimeoutMs: number;

    constructor(options: HeavyRequestLimiterOptions) {
        this.name = options.name;
        this.paths = options.paths;
        this.methods = options.methods ? new Set(options.methods.map((m) => m.toUpperCase())) : null;
        this.maxConcurrent = options.maxConcurrent;
        this.queueTimeoutMs = options.queueTimeoutMs;
    }

    /**
     * Haengt die Schleuse in die App. Muss VOR den Route-Handlern montiert werden —
     * Express laeuft die Middleware in Montage-Reihenfolge.
     */
    public applyTo(app: Application): void {
        app.use(this.middleware());
    }

    private middleware(): RequestHandler {
        return (req, res, next) => {
            if (!this.isHeavy(req.path, req.method)) {
                next();
                return;
            }

            void this.acquire().then((granted) => {
                if (!granted) {
                    res.setHeader('Retry-After', String(Math.ceil(this.queueTimeoutMs / 1000)));
                    res.status(503).json({
                        error:
                            `Server ist ausgelastet (${this.name}): mehr als ${this.maxConcurrent} teure Anfragen gleichzeitig. `
                            + 'Bitte in Kuerze erneut versuchen.',
                    });
                    return;
                }

                // Der Platz wird genau einmal zurueckgegeben: 'finish' bei sauberer Antwort,
                // 'close' auch dann, wenn der Aufrufer vorher auflegt. Ohne das zweite
                // Ereignis leckt die Schleuse bei jedem Abbruch einen Platz.
                let released = false;
                const release = (): void => {
                    if (released) return;
                    released = true;
                    this.release();
                };
                res.on('finish', release);
                res.on('close', release);

                next();
            });
        };
    }

    /**
     * Trifft die Schleuse diesen Request? Ohne `method` zaehlt nur der Pfad.
     * Oeffentlich fuer den StartupTest.
     */
    public isHeavy(path: string, method?: string): boolean {
        if (this.methods && method !== undefined && !this.methods.has(method.toUpperCase())) return false;
        return this.paths.some((pattern) => pattern.test(path));
    }

    /** Liefert true, sobald ein Platz frei ist — oder false, wenn das Wartebudget reisst. */
    private acquire(): Promise<boolean> {
        if (this.active < this.maxConcurrent) {
            this.active++;
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            const queued: QueuedRequest = {
                grant: resolve,
                timer: setTimeout(() => {
                    const index = this.waiting.indexOf(queued);
                    if (index >= 0) this.waiting.splice(index, 1);
                    resolve(false);
                }, this.queueTimeoutMs),
            };
            // Ein Wartender darf den Prozess nicht am Leben halten.
            queued.timer.unref?.();
            this.waiting.push(queued);
        });
    }

    /** Gibt den Platz weiter an den naechsten Wartenden — oder frei, wenn keiner wartet. */
    private release(): void {
        const next = this.waiting.shift();
        if (!next) {
            this.active--;
            return;
        }
        clearTimeout(next.timer);
        next.grant(true);
    }
}
