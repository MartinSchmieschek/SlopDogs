/**
 * ~~~ HEAVY REQUEST LIMITER — die HTTP-Seite der Lauf-Zulassung ~~~
 *
 * Body-Limits (express.json) deckeln, was HEREIN kommt. Sie sagen nichts darueber,
 * wie viele teure Antworten der Prozess GLEICHZEITIG baut — und genau dort entsteht
 * die Speicherspitze: ein Kennel-Run oder ein Listen-Endpunkt haelt waehrend seiner
 * Laufzeit Zeilen, geparste Configs und Ergebnisse im Heap.
 *
 * Diese Klasse haengt einen Topf (RunAdmission, siehe runAdmission.ts) vor bestimmte Pfade:
 *   - frei -> sofort durch; belegt -> FIFO-Schlange, die Anfrage WARTET und kommt seriell dran;
 *   - abgewiesen wird nur bei voller Schlange (sofort 503) oder nach dem langen Wartebudget (503);
 *   - fuer Kennel-LAEUFE (sourcePaths) gilt zusaetzlich die Sperre je Quelle (429 + Retry-After).
 *
 * Der Platz haengt am Leben der Verbindung, ab dem Einreihen: 'close' wird SOFORT beim Einreihen
 * abonniert. Legt ein Wartender auf, verlaesst er die Schlange und erbt nie einen Platz; legt ein
 * Zugelassener auf oder ist die Antwort fertig ('finish'), geht der Platz genau einmal zurueck.
 * Frueher hingen die Listener erst nach dem Durchlassen — ein in der Schlange Aufgelegter erbte
 * spaeter den Platz, antwortete ins Leere (kein 'finish', 'close' schon vorbei) und gab ihn nie zurueck.
 *
 * Zwei Instanzen, zwei Toepfe: `heavy()` fuer UI-Listen und Runs der Werkstatt,
 * `publicRuns()` fuer oeffentliche Kennel-Laeufe (`/k/:id`, `/k/:id/openapi.json`).
 * Getrennt, damit die UI nicht hinter einer Besucherwelle wartet.
 */

import type { Application, Request, RequestHandler, Response } from 'express';
import {
    AdmissionDenial,
    RunAdmission,
    RunGates,
    RunSource,
    SourceRunGate,
    positiveIntFromEnv,
} from './runAdmission';

/** Default-Wartebudget der Schlangen: lang — warten und seriell weiterlaufen statt abweisen. */
const DEFAULT_QUEUE_TIMEOUT_MS = 120_000;
/** Default-Obergrenze der Schlangen; darueber sofort 503. */
const DEFAULT_QUEUE_MAX = 50;

export interface HeavyRequestLimiterOptions {
    /** Fuer Log und Statistik: 'heavy' | 'public'. */
    name: string;
    /** Getestet gegen req.path. */
    paths: readonly RegExp[];
    /** Gebremste Methoden; ohne Angabe alle. */
    methods?: readonly string[];
    maxConcurrent: number;
    queueTimeoutMs: number;
    /** Obergrenze der Schlange (Default 50). */
    queueMax?: number;
    /** Pfade, fuer die zusaetzlich die Sperre je Quelle gilt (Kennel-Laeufe). Ohne Angabe: keine. */
    sourcePaths?: readonly RegExp[];
    /** Die Sperre je Quelle (geteilt mit MCP). Ohne Angabe: keine. */
    sourceGate?: SourceRunGate | null;
    /** Ein vorhandener Topf (geteilt mit MCP); ohne Angabe baut die Klasse ihren eigenen. */
    admission?: RunAdmission;
}

export class HeavyRequestLimiter {
    /**
     * Die teuren Pfade: Kennel-Run (fuehrt die ganze Meute aus) und die beiden
     * Listen-Endpunkte (ziehen eine Typ-Partition und parsen sie).
     */
    private static readonly HEAVY_PATHS: readonly RegExp[] = [
        /^\/api\/kennels\/?$/,
        /^\/api\/nodes\/?$/,
        /^\/api\/kennels\/[^/]+\/(run|execute)\/?$/,
    ];

    /** Darunter die Kennel-LAEUFE — nur sie zaehlen gegen die Sperre je Quelle, die UI-Listen nicht. */
    private static readonly HEAVY_RUN_PATHS: readonly RegExp[] = [
        /^\/api\/kennels\/[^/]+\/(run|execute)\/?$/,
    ];

    /**
     * Die oeffentlichen Laeufe: `/k/:id` und die Spec-Erzeugung `/k/:id/openapi.json`.
     * `/k/:id/docs` liefert nur statisches HTML und bleibt ungebremst. Disjunkt zu HEAVY_PATHS.
     */
    private static readonly PUBLIC_PATHS: readonly RegExp[] = [
        /^\/k\/[^/]+\/?$/,
        /^\/k\/[^/]+\/openapi\.json\/?$/,
    ];

    /** UI-Listen und Runs der Werkstatt. Mit `gates` teilt die Schleuse Topf und Quellen-Sperre mit MCP. */
    public static heavy(gates?: RunGates): HeavyRequestLimiter {
        return new HeavyRequestLimiter({
            name: 'heavy',
            paths: HeavyRequestLimiter.HEAVY_PATHS,
            maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_HEAVY_REQUESTS', 8),
            queueTimeoutMs: positiveIntFromEnv('HEAVY_REQUEST_QUEUE_TIMEOUT_MS', DEFAULT_QUEUE_TIMEOUT_MS),
            queueMax: positiveIntFromEnv('HEAVY_REQUEST_QUEUE_MAX', DEFAULT_QUEUE_MAX),
            sourcePaths: HeavyRequestLimiter.HEAVY_RUN_PATHS,
            sourceGate: gates?.sources ?? null,
            admission: gates?.heavy,
        });
    }

    /** Oeffentliche Kennel-Laeufe. HEAD bleibt ungebremst — er fuehrt keinen Lauf aus. */
    public static publicRuns(gates?: RunGates): HeavyRequestLimiter {
        return new HeavyRequestLimiter({
            name: 'public',
            paths: HeavyRequestLimiter.PUBLIC_PATHS,
            methods: ['GET', 'POST'],
            maxConcurrent: positiveIntFromEnv('MAX_CONCURRENT_PUBLIC_RUNS', 4),
            queueTimeoutMs: positiveIntFromEnv('PUBLIC_RUN_QUEUE_TIMEOUT_MS', DEFAULT_QUEUE_TIMEOUT_MS),
            queueMax: positiveIntFromEnv('PUBLIC_RUN_QUEUE_MAX', DEFAULT_QUEUE_MAX),
            sourcePaths: HeavyRequestLimiter.PUBLIC_PATHS,
            sourceGate: gates?.sources ?? null,
            admission: gates?.publicRuns,
        });
    }

    private readonly paths: readonly RegExp[];
    /** Grossgeschriebene Methoden; null = alle. */
    private readonly methods: ReadonlySet<string> | null;
    private readonly sourcePaths: readonly RegExp[];
    private readonly sourceGate: SourceRunGate | null;
    readonly admission: RunAdmission;

    constructor(options: HeavyRequestLimiterOptions) {
        this.paths = options.paths;
        this.methods = options.methods ? new Set(options.methods.map((m) => m.toUpperCase())) : null;
        this.sourcePaths = options.sourcePaths ?? [];
        this.sourceGate = options.sourceGate ?? null;
        this.admission = options.admission ?? new RunAdmission({
            name: options.name,
            maxConcurrent: options.maxConcurrent,
            queueTimeoutMs: options.queueTimeoutMs,
            queueMax: options.queueMax ?? DEFAULT_QUEUE_MAX,
        });
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
            // Schon weg (aufgelegt waehrend Session/Auth-Middleware): niemand hoert zu, kein Platz.
            if (HeavyRequestLimiter.isGone(res)) return;

            const sourceKey = this.isSourceLimited(req.path) ? RunSource.ofRequest(req as Request) : null;
            const pending = this.admission.request(sourceKey, this.sourceGate);

            // Ab JETZT haengt der Platz an der Verbindung: wartend -> raus aus der Schlange,
            // zugelassen -> Platz zurueck. close() ist idempotent, 'finish' und 'close' duerfen beide feuern.
            const done = (): void => pending.close();
            res.once('close', done);
            res.once('finish', done);

            void pending.outcome.then((outcome) => {
                if (!outcome.granted) {
                    if (outcome.denial.reason === 'cancelled' || HeavyRequestLimiter.isGone(res)) return;
                    HeavyRequestLimiter.sendDenial(res, outcome.denial);
                    return;
                }
                if (HeavyRequestLimiter.isGone(res)) {
                    pending.close();
                    return;
                }
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

    /** Gilt fuer diesen Pfad die Sperre je Quelle? Oeffentlich fuer den StartupTest. */
    public isSourceLimited(path: string): boolean {
        return this.sourceGate !== null && this.sourcePaths.some((pattern) => pattern.test(path));
    }

    /** Antwort zerstoert oder geschlossen — dann schreibt niemand mehr hinein. */
    private static isGone(res: Response): boolean {
        return Boolean((res as any).destroyed || (res as any).closed || (res as any).writableEnded);
    }

    private static sendDenial(res: Response, denial: AdmissionDenial): void {
        if (denial.retryAfterSec > 0) res.setHeader('Retry-After', String(denial.retryAfterSec));
        res.status(denial.status).json(denial.toBody());
    }
}
