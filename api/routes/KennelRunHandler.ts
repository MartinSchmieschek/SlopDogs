// The KennelRunHandler — the huntmaster who unleashes the hounds.
// Vome speaks: to cosmic madness laws submit — the waves obey the dependency graph.
import {
    SerializedDog,
    MimicDog,
    type IMimicDogConfig,
    IKennelConfig,
    KennelRun,
    type MimicAdopter,
    type ICacheHandler,
    type VmGlobalCapabilityContext,
    isRuntimeLogVerbose,
    publicKennelPath,
} from '@slopdogs/core';
import { FIXED_TOP_LEVEL } from './spaRouteConstants';
import { API_ROUTE, LEGACY_ROUTE, PUBLIC_ROUTE } from './routeTable';
import { IStore } from '../../store/IStore';
import { KennelController } from '../KennelController';
import { accessOf, aclOf, withMyRights, type Access } from '../../mcp/auth/visibility';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { convertSeasonToWaves, Waves } from '../../services/WavesConverter';
import { REDACTED_TEXT, kennelRunView, redactWavesForCtx } from '../../services/wavesRedaction';
import { DogAclIndex, DogRunPolicy } from '../../services/dogAccess';
import { isHtmlResultString, isMarkdownResultString } from '../../services/leadResultStringFormat';
import type { KennelCallCounter } from '../../services/KennelCallCounter';
import { dogStatsKeyOf } from '../../services/dogStatsKey';
import type { KennelCallSource } from '../../store/IKennelStatsStore';
import { KeyRunState } from '../../services/keysCapability';

/** Lead-Yield mit { snapshot, live } — Lobby-Konvention fuer den Socket-Dog. */
function isLobbyLeadShape(v: any): boolean {
    return !!v && typeof v === 'object' && typeof v.live === 'string' && typeof v.snapshot === 'object' && v.snapshot !== null;
}

function clientWantsJson(req: any): boolean {
    if (!req) return false;
    const q = req.query || {};
    if (q.format === 'json' || q.data === '1' || q.data === 'true') return true;
    const accept = String(req.headers?.accept || '').toLowerCase();
    if (!accept) return false;
    if (accept.includes('text/html')) return false;
    if (accept.includes('application/json')) return true;
    return false;
}
import { generateVersionId, generateLineageId } from '../utils/versioning';

/** Ein adoptierbarer MimicDog, aus einer rohen Store-Zeile geschaelt. */
interface MimicCandidate {
    versionId: string;
    lineageId: string;
    createdAt: number;
    cfg: IMimicDogConfig;
    /** Die Rechte der Zeile — getLatestVersionsForAll liefert Koepfe, also die gueltigen. */
    acl: ReturnType<typeof aclOf>;
}

/** The provisions required to arm the KennelRunHandler. */
export interface IKennelRunDeps {
    kennelsController: KennelController;
    nodesStore: IStore;
    baseDogsMap: Map<string, new () => any>;
    cacheHandler?: ICacheHandler;
    /** Zaehlt jeden begonnenen Lauf (P4) — synchron, im Speicher. */
    callCounter: KennelCallCounter;
}

/** Ein Besucher ohne Login — die Landing laeuft immer so (P5), unabhaengig vom Request-Kontext. */
const ANONYMOUS: AuthCtx = { user: null, isSuperUser: false };

/** Wer einen Lauf ausgeloest hat — die Quelle der Zaehlung (P4 4.5). */
export interface KennelRunAttribution {
    source: KennelCallSource;
}

export class KennelRunHandler {
    private deps: IKennelRunDeps;

    constructor(deps: IKennelRunDeps) {
        this.deps = deps;
    }

    /**
     * Register run, execute, and public kennel routes (Pfade aus der Routentabelle).
     * HEAD steht VOR GET: ohne eigene Route beantwortet Express HEAD ueber den GET-Handler —
     * und liesse den Kennel laufen. Die Alt-Weiche `/:name` kommt zuletzt.
     */
    registerRoutes(app: any): void {
        app.get(API_ROUTE.kennelRun, (req: any, res: any) => this.handleRun(req, res));
        app.post(API_ROUTE.kennelRun, (req: any, res: any) => this.handleRun(req, res));
        app.get(API_ROUTE.kennelExecute, (req: any, res: any) => this.handleExecute(req, res));
        app.post(API_ROUTE.kennelExecute, (req: any, res: any) => this.handleExecute(req, res));
        app.head(PUBLIC_ROUTE.kennel, (req: any, res: any) => void this.handlePublicHead(req, res));
        app.get(PUBLIC_ROUTE.kennel, (req: any, res: any) => void this.handlePublicGet(req, res));
        app.post(PUBLIC_ROUTE.kennel, (req: any, res: any) => void this.handlePublicPost(req, res));
        if (KennelRunHandler.legacyRedirectEnabled()) {
            app.all(LEGACY_ROUTE.kennel, (req: any, res: any, next: any) => this.legacyRedirect(req, res, next));
        }
    }

    /** LEGACY_KENNEL_REDIRECT: Default an; nur `0`/`false` schaltet die Alt-Weiche ab. */
    public static legacyRedirectEnabled(): boolean {
        const flag = (process.env.LEGACY_KENNEL_REDIRECT || '').trim().toLowerCase();
        return flag !== '0' && flag !== 'false';
    }

    // --- Public helpers (used by KennelSwaggerHandler and KennelBundleHandler) ---

    /** Fetch a kennel config, optionally a specific version. */
    public async loadKennelConfig(id: string, versionOverride?: string): Promise<IKennelConfig | null> {
        const lookupId = versionOverride || id;
        const result = await this.deps.kennelsController.getById(lookupId);
        return (result.ok && result.data) ? result.data : null;
    }

    /** Merge default + request query params (all lowercased). */
    public mergeQueryParams(defaults: Record<string, string> | undefined, reqQuery: Record<string, any>): Record<string, string> {
        const result: Record<string, string> = {};
        if (defaults) {
            Object.entries(defaults).forEach(([k, v]) => { result[k.toLowerCase()] = String(v).toLowerCase(); });
        }
        Object.keys(reqQuery).forEach(key => {
            const val = typeof reqQuery[key] === 'string' ? reqQuery[key] : String(reqQuery[key]);
            result[key.toLowerCase()] = val.toLowerCase();
        });
        return result;
    }

    /**
     * Die Lead-Ausgabe eines Kennels, wie ein anonymer Besucher sie unter GET /k/:id bekaeme — fuer die
     * Landing (P5): dasselbe Gate (RUN fuer Anonyme), derselbe Lauf, aber die Quelle bestimmt der Aufrufer
     * (`landing` rankt nicht). `null`, wenn der Kennel fehlt, fuer Anonyme nicht ausfuehrbar ist oder der
     * Lead kein Ergebnis traegt; ein abgebrochener Lauf wirft wie bei runKennel.
     */
    public async runLeadAsAnonymous(kennelId: string, query: Record<string, string>, attribution: KennelRunAttribution): Promise<unknown | null> {
        const config = await this.loadKennelConfig(kennelId);
        if (!config || accessOf(config as any, ANONYMOUS) === 'none') return null;
        const leadRef = config.dogIds?.[0];
        if (!leadRef) return null;
        const waves = await this.runKennel(config, this.mergeQueryParams(config.defaultQuery, query), config.defaultBody, undefined, undefined, attribution);
        const lead: any = this.findDogInWaves(waves, leadRef);
        if (!lead || lead.error) return null;
        return KeyRunState.forResult(waves).scrubValue(lead.result);
    }

    /**
     * Run a kennel and return waves.
     * @param capabilityCtx Optional auth context (userId/isSuperUser) forwarded to
     *   every SerializedDog so registered VM-Global-Capabilities can tenant-scope
     *   their bridges (e.g. `jsonStore` per-user key prefix).
     * @param vmTimeoutMs Optional per-run override for the SerializedDog VM execution
     *   timeout (ms). Resolution order: vmTimeoutMs param > SLOPDOGS_VM_TIMEOUT_MS env >
     *   10000ms default. Run-Time-Param (Welle 12 Korrektur) -- nicht in IKennelConfig.
     * @param attribution Wer den Lauf ausgeloest hat (P4). Jeder begonnene Lauf wird genau einmal
     *   gezaehlt — im finally, synchron, ohne DB; ein Lauf ohne Quelle zaehlt als `unknown`.
     */
    public async runKennel(
        config: IKennelConfig,
        query?: Record<string, string>,
        body?: any,
        capabilityCtx?: VmGlobalCapabilityContext,
        vmTimeoutMs?: number,
        attribution?: KennelRunAttribution,
    ): Promise<Waves> {
        const lineageId = (config as any).lineageId || config.id;          // dieselbe Regel wie createMimicAdopter
        const source: KennelCallSource = attribution?.source ?? 'unknown';
        if (source === 'unknown' && isRuntimeLogVerbose()) {
            console.warn(`[KennelRunHandler] Lauf ohne Quelle (${lineageId}) — zaehlt als unknown`, new Error('attribution').stack);
        }
        let leadFailed = false;
        const keyRun = new KeyRunState();
        try {
            const policy = new DogRunPolicy(config, capabilityCtx);
            const mimicAdopter = await this.createMimicAdopter(config, policy);
            // P4c: jeder Lauf traegt seinen Kennel und einen eigenen Laufzustand (benutzte Schluessel,
            // Memo) — die Capabilities aller Dogs teilen ihn. Ohne Request-Kontext bleibt es anonym.
            const runCtx: VmGlobalCapabilityContext = {
                ...(capabilityCtx ?? {}),
                kennelLineageId: lineageId,
                kennelOwnerId: (config as any).ownerId ?? null,
                runState: keyRun,
            };

            const kennelRun = new KennelRun(
                config,
                this.deps.baseDogsMap,
                this.createSerializedDogFactory(policy),
                query || {},
                body,
                [],
                this.deps.cacheHandler,
                mimicAdopter
            );
            kennelRun.setCapabilityContext(runCtx);
            if (typeof vmTimeoutMs === 'number' && vmTimeoutMs > 0) {
                kennelRun.setVmTimeoutMs(vmTimeoutMs);
            }
            // P4b: jeder einzelne Dog-Lauf zaehlt — mit derselben Lineage und Quelle wie der Kennel.
            // Synchron im finally von letOut(), im Speicher; kein await, keine Query zwischen Wellen.
            const callCounter = this.deps.callCounter;
            kennelRun.setDogRunObserver({
                onDogRun: (r) => {
                    const dogKey = dogStatsKeyOf(r.dog);
                    if (!dogKey) return;
                    callCounter.recordDog({
                        dogKey, kennelLineageId: lineageId, source, outcome: r.outcome,
                        cached: r.outcome === 'ok' && r.cacheHits > 0 && r.cacheMisses === 0,
                        cacheHits: r.cacheHits, cacheMisses: r.cacheMisses, durationMs: r.durationMs,
                    });
                },
            });
            const season = await kennelRun.run();
            await this.persistNewMimics(config, season.exhausted, policy);
            // Pass config so onLeadDependencyPath is annotated — the lead-trail must be visible.
            // P4c: jeder im Lauf benutzte Schluessel-Wert faellt hier aus result, error und vmContext;
            // die Waves tragen ihren Lauf mit, damit Antwort und Snapshot noch einmal scrubben koennen.
            const waves = convertSeasonToWaves(season, config, keyRun);
            KeyRunState.attach(waves, keyRun);
            // Ein Lead, der gar nicht in den Waves steht (durfte nicht laufen), ist so gescheitert
            // wie einer mit error-Brandzeichen — die Handler antworten dann `lead_failed`.
            const leadRef = config.dogIds?.[0];
            const lead: any = leadRef ? this.findDogInWaves(waves, leadRef) : null;
            leadFailed = !lead || !!lead.error;
            return waves;
        } catch (err) {
            leadFailed = true;                                               // "Nothing to harvest" oder Infrastruktur
            throw keyRun.scrubError(err);                                    // P4c: kein Wert in Text oder Stack
        } finally {
            this.deps.callCounter.record(lineageId, source, leadFailed);     // genau ein record je begonnenem Lauf
        }
    }

    /**
     * Build an adopter that reuses saved MimicDogs instead of conjuring fresh placeholders.
     *
     * Strategy (option c — lineage-aware adoption):
     *   1. Collect every non-base dogId this kennel has ever carried across all its versions.
     *      This is the kennel's "memory" — mimic lineageIds it used to own before the UI (or
     *      any client) dropped them from dogIds on a later PUT.
     *   2. When autoMimic asks for a mimic of pact X, query the deep for all MimicDog lineages
     *      whose config.imitates === X.
     *   3. Prefer a candidate whose lineageId is in the kennel's memory (optionally augmented
     *      with the caller's hint set). Tie-break on newest createdAt. Fall back to the
     *      newest match overall if nothing is remembered.
     *
     * The returned mimic carries its stable lineageId; persistNewMimics later heals it back
     * into config.dogIds so the kennel remembers it on subsequent runs without re-adopting.
     */
    private async createMimicAdopter(config: IKennelConfig, policy: DogRunPolicy): Promise<MimicAdopter> {
        const { kennelsController } = this.deps;

        // Assemble the kennel's lineage memory from every historical version.
        const remembered = new Set<string>();
        const kennelLineageId = (config as any).lineageId || config.id;
        try {
            const versions = await kennelsController.getVersions(kennelLineageId);
            for (const v of versions) {
                const dogIds = (v.config as IKennelConfig)?.dogIds ?? [];
                for (const id of dogIds) {
                    if (typeof id === 'string' && !id.startsWith('base:')) {
                        remembered.add(id);
                    }
                }
            }
        } catch (err) {
            if (isRuntimeLogVerbose()) {
                console.warn('[KennelRunHandler.createMimicAdopter] history lookup failed:', err);
            }
        }

        // Die MimicDog-Partition wird EINMAL pro Run geladen, nicht einmal pro offenem Pact.
        // Der Fetch stand frueher IN der Closure unten, und KennelRun ruft den Adopter in einer
        // sequentiellen Schleife fuer JEDEN unerfuellten Pact auf: drei offene Pacts waren drei
        // volle Tabellenladungen derselben, waehrend des Runs unveraenderlichen Menge in einem
        // einzigen Request.
        //
        // Lazy, nicht eager: es gibt Runs ganz ohne offenen Pact, die sollen nichts laden.
        // Die Promise selbst wird gemerkt (nicht ihr Ergebnis), damit parallele Aufrufe sich
        // dieselbe Ladung teilen statt zwei auszuloesen. Sie lebt genau so lange wie dieser
        // Run — ein prozessweiter Cache waere ein Leck und lieferte ausserdem veraltete Mimics.
        let mimicCandidates: Promise<MimicCandidate[]> | null = null;
        const loadMimicCandidates = (): Promise<MimicCandidate[]> => {
            if (!mimicCandidates) {
                mimicCandidates = this.readMimicCandidates();
            }
            return mimicCandidates;
        };

        return async (pactName, preferredLineageIds) => {
            // Union the kennel's own memory with any hint the core passed in.
            const memory = new Set<string>(remembered);
            preferredLineageIds.forEach(id => memory.add(id));

            // Keep only the mimics that imitate this pact — and that this kennel may run at all
            // (P3.5: a foreign private mimic is no more adoptable than a foreign private dog).
            // `.filter` liefert eine eigene Liste — die gemerkte Ladung darf vom sort() weiter
            // unten nicht umsortiert werden.
            const candidates = (await loadMimicCandidates()).filter(c => c.cfg.imitates === pactName && policy.mayRun(c.acl));
            if (candidates.length === 0) return null;

            // Option (c): remembered lineages win; tie-break by newest createdAt.
            // If nothing is remembered, fall back to the newest match overall.
            const rememberedCands = candidates.filter(c => memory.has(c.lineageId));
            const pool = rememberedCands.length > 0 ? rememberedCands : candidates;
            pool.sort((a, b) => b.createdAt - a.createdAt);
            const winner = pool[0];

            const mimicCfg: IMimicDogConfig = {
                ...winner.cfg,
                id: winner.cfg.id ?? winner.versionId,
                lineageId: winner.lineageId,
            };
            return policy.instantiate(mimicCfg, winner.versionId, winner.acl, winner.lineageId) as MimicDog<unknown>;
        };
    }

    /**
     * Schaelt die neuesten MimicDog-Zeilen aus dem Store zu Adoptions-Kandidaten.
     * Pact-unabhaengig: die Zeilen sind fuer alle offenen Pacts eines Runs dieselben,
     * nur der Filter darauf unterscheidet sich (siehe createMimicAdopter).
     */
    private async readMimicCandidates(): Promise<MimicCandidate[]> {
        const rows = await this.deps.nodesStore.findLatestVersionsByType(MimicDog.name);
        const candidates: MimicCandidate[] = [];
        for (const row of rows as any[]) {
            const raw = typeof row.serializedDogConfig === 'string'
                ? (() => { try { return JSON.parse(row.serializedDogConfig); } catch { return null; } })()
                : row.serializedDogConfig;
            if (!raw) continue;
            const lineageId = raw.lineageId || row.lineageId || row.id;
            if (!lineageId) continue;
            candidates.push({
                versionId: row.id,
                lineageId,
                createdAt: row.createdAt ? new Date(row.createdAt).getTime() : 0,
                cfg: raw as IMimicDogConfig,
                acl: aclOf(row),
            });
        }
        return candidates;
    }

    /**
     * Translate the request's AuthCtx into the core's VmGlobalCapabilityContext.
     * - logged in: { userId, isSuperUser:false }
     * - dev mode / super-user: { userId:null, isSuperUser:true }
     * - anonymous: { userId:null, isSuperUser:false }
     * undefined req.ctx (legacy callers) -> undefined, capabilities stay raw.
     */
    public toCapabilityCtx(reqCtx: any): VmGlobalCapabilityContext | undefined {
        if (!reqCtx) return undefined;
        return {
            userId: reqCtx.user?.id ?? null,
            isSuperUser: !!reqCtx.isSuperUser,
        };
    }

    // --- Private internals ---

    /**
     * Laedt die Dogs eines Laufs. P3.5: nur, was der Kennel tragen darf (DogRunPolicy.mayRun —
     * ein fremder privater Dog fehlt, der Lead faellt dann aus), und mit den Rechten des
     * Lineage-Kopfes, nicht der gepinnten Version. Dem Aufrufer fremde Dogs laufen in einem
     * eigenen Kapazitaets-Namensraum (8.15: kein Owner-jsonStore, keine Keys).
     */
    private createSerializedDogFactory(policy: DogRunPolicy) {
        const { nodesStore } = this.deps;
        return async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            // Deduplicate by lineageId — if a dog exists as both SerializedDog and MimicDog type,
            // keep only the most recent version (MimicDog wins when type was upgraded via save).
            const byLineage = new Map<string, any>();
            for (const sd of [...serialized, ...mimics]) {
                const row = sd as any;
                const cfg = typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig) : row.serializedDogConfig;
                const lid = cfg.lineageId || row.lineageId || row.id;
                const existing = byLineage.get(lid);
                if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
                    byLineage.set(lid, row);
                }
            }
            const rows = Array.from(byLineage.entries());
            const acl = await DogAclIndex.load(nodesStore, rows.map(([lineageId, sd]) => ({ id: sd.id, lineageId })));
            const dogs: Array<SerializedDog<unknown>> = [];
            for (const [lineageId, sd] of rows) {
                const dogAcl = acl.aclOf({ id: sd.id, lineageId });
                if (!policy.mayRun(dogAcl)) {
                    if (isRuntimeLogVerbose()) console.log(`[KennelRunHandler] Dog ${lineageId} darf in diesem Kennel nicht laufen (P3.5)`);
                    continue;
                }
                const config = typeof sd.serializedDogConfig === 'string'
                    ? JSON.parse(sd.serializedDogConfig)
                    : sd.serializedDogConfig;
                dogs.push(policy.instantiate(config, sd.id, dogAcl!, lineageId));
            }
            return dogs;
        };
    }

    /**
     * Speichert frisch erzeugte Auto-Mimics und heilt adoptierte in die dogIds. Ein neuer Mimic
     * bekommt Owner und Sichtbarkeit aus seinem Kennel (DogRunPolicy.newMimicAcl).
     */
    private async persistNewMimics(config: IKennelConfig, exhausted: any[], policy: DogRunPolicy): Promise<void> {
        const { nodesStore } = this.deps;
        const mimicAcl = policy.newMimicAcl();
        const currentDogIds = new Set<string>(config.dogIds ?? []);
        const freshLineageIds: string[] = [];
        const adoptedLineageIds: string[] = [];

        for (const dog of exhausted) {
            if (!(dog instanceof MimicDog)) continue;
            const mimic = dog as MimicDog<unknown>;
            const existingLineageId = mimic.instanceConfig?.lineageId;

            if (existingLineageId) {
                // Already persisted in the deep (either from dogIds or adopted via MimicAdopter).
                // If the kennel's dogIds don't yet remember it, heal it in so next run loads it directly.
                if (!currentDogIds.has(existingLineageId)) {
                    adoptedLineageIds.push(existingLineageId);
                    currentDogIds.add(existingLineageId);
                    if (isRuntimeLogVerbose()) {
                        console.log(`[KennelRunHandler] Heal adopted mimic into dogIds (lineageId: ${existingLineageId})`);
                    }
                }
                continue;
            }

            const versionId = generateVersionId();
            const lineageId = generateLineageId();
            const cfg = {
                ...mimic.instanceConfig,
                id: versionId,
                lineageId,
                parentId: null,
                displayName: mimic.instanceConfig?.displayName || mimic.storageId,
            };

            await nodesStore.save({
                id: versionId,
                type: MimicDog.name,
                lineageId,
                parentId: null,
                displayName: cfg.displayName,
                serializedDogConfig: JSON.stringify(cfg),
                ownerId: mimicAcl.ownerId,
                visibility: mimicAcl.visibility,
                createdAt: new Date(),
            });

            mimic.instanceConfig.id = versionId;
            mimic.instanceConfig.lineageId = lineageId;
            mimic.instanceConfig.parentId = null;
            mimic.instanceConfig.displayName = cfg.displayName;

            freshLineageIds.push(lineageId);
            if (isRuntimeLogVerbose()) {
                console.log(`[KennelRunHandler] Persisted new mimic '${cfg.displayName}' (lineageId: ${lineageId})`);
            }
        }

        const addedLineageIds = [...freshLineageIds, ...adoptedLineageIds];
        if (addedLineageIds.length > 0) {
            const updatedDogIds = [...(config.dogIds ?? []), ...addedLineageIds];
            await this.deps.kennelsController.heal(config.id, {
                dogIds: updatedDogIds,
            } as any);
            // Keep the in-memory config in sync so the /run response reflects the heal.
            config.dogIds = updatedDogIds;
        }
    }

    private findDogInWaves(waves: Waves, targetDogId: string) {
        const searchId = targetDogId.startsWith('base:')
            ? targetDogId.substring(5)
            : targetDogId;

        for (const wave of waves) {
            for (const node of wave) {
                if (node.id === searchId ||
                    node.id === targetDogId ||
                    (node as any).lineageId === searchId ||
                    (node as any).lineageId === targetDogId) {
                    return node;
                }
            }
        }
        return null;
    }

    /**
     * Das Lead-Ergebnis als Antwort. P4c: vorher noch einmal der Scrub des Laufs (`waves`) — die
     * Waves sind schon bereinigt, das hier ist die letzte Tuer vor dem Draht (Defense-in-Depth).
     */
    private sendResult(res: any, rawResult: any, req: any, waves: Waves) {
        const result = KeyRunState.forResult(waves).scrubValue(rawResult);
        // Lobby-Shape { snapshot, live }: Browser bekommt das HTML, API-Clients den Snapshot.
        if (isLobbyLeadShape(result)) {
            const wantsJson = clientWantsJson(req);
            if (wantsJson) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.status(200).json((result as any).snapshot);
                return;
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send((result as any).live);
            return;
        }
        if (typeof result === 'string' && isHtmlResultString(result)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(result);
        } else if (typeof result === 'string' && isMarkdownResultString(result)) {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.status(200).send(result);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).json(result);
        }
    }

    /**
     * Ein Fehlertext fuer die Antwort: Leser (READ) bekommen die Nachricht, RUN-Leser nur den
     * Platzhalter (W13) — die Nachricht eines Laufs kann Dog-Namen und Code-Stellen tragen.
     * `String(err)` statt `err.stack`: nie ein Stack nach draussen.
     */
    private static errorText(err: any, access: Access): string {
        if (access !== 'read') return REDACTED_TEXT;
        return err?.message || String(err);
    }

    // --- Route handlers ---

    /**
     * GET|POST /api/kennels/:id/run. Kennel-Gate RUN; READ bekommt die Waves (je Dog redigiert)
     * und die Konfiguration, RUN nur die Form des Laufs (kennelRunView, W17 Stufe 1).
     */
    private async handleRun(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ ok: false, error: `Kennel ${req.params.id} not found` });
                return;
            }
            const access = accessOf(config as any, req.ctx);
            if (access === 'none') {
                res.status(404).json({ ok: false, error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const query = this.mergeQueryParams(config.defaultQuery, req.query);
            const body =
                req.method === 'POST' && req.body !== undefined && req.body !== null
                    ? req.body
                    : config.defaultBody;

            const startedAt = Date.now();
            try {
                const waves = await this.runKennel(config, query, body, this.toCapabilityCtx(req.ctx), undefined, { source: 'api-run' });
                if (access === 'run') {
                    res.json(kennelRunView(waves, config, Date.now() - startedAt));
                    return;
                }
                const safeWaves = await redactWavesForCtx(waves, req.ctx, this.deps.nodesStore);
                res.json({ ok: true, waves: safeWaves, kennelConfig: withMyRights(config as any, req.ctx) });
            } catch (runError: any) {
                const msg = KennelRunHandler.errorText(runError, access);
                const kennelConfig = access === 'read' ? { kennelConfig: withMyRights(config as any, req.ctx) } : {};
                if (String(runError?.message ?? runError).includes("Nothing to harvest")) {
                    res.json({ ok: false, error: msg, ...kennelConfig });
                } else {
                    console.error("[KennelRunHandler.handleRun] runKennel", runError);
                    res.status(500).json({ ok: false, error: msg, ...kennelConfig });
                }
            }
        } catch (err) {
            console.error('[KennelRunHandler.handleRun]', err);
            res.status(500).json({ ok: false, error: REDACTED_TEXT });
        }
    }

    private async handleExecute(req: any, res: any): Promise<void> {
        let access: Access = 'none';
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} not found` });
                return;
            }
            access = accessOf(config as any, req.ctx);
            if (access === 'none') {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            const body =
                req.method === 'POST' && req.body !== undefined && req.body !== null
                    ? req.body
                    : config.defaultBody;
            const waves = await this.runKennel(config, queryData, body, this.toCapabilityCtx(req.ctx), undefined, { source: 'api-execute' });

            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                this.sendLeadMissing(res, dogIds[0], access);
                return;
            }
            this.sendResult(res, firstDog.result, req, waves);
        } catch (err) {
            console.error('[KennelRunHandler.handleExecute]', err);
            res.status(500).json({ error: KennelRunHandler.errorText(err, access) });
        }
    }

    /**
     * Der Lead lief nicht (fehlt, weil er in diesem Kennel nicht laufen darf, oder crashte vor
     * seinem Eintrag). Leser erfahren die id, RUN-Leser nur, dass der Lead fehlt.
     */
    private sendLeadMissing(res: any, leadRef: string, access: Access): void {
        res.status(404).json({ error: access === 'read' ? `Dog ${leadRef} not found in waves` : 'lead_failed' });
    }

    /**
     * Alt-Weiche: `/<name>?…` -> 308 `/k/<name>?…`. Kein DB-Lookup, keine Zaehlung — ein
     * Fremdpfad kostet zwei billige Antworten statt eines Lookups. Methode, Body und Query
     * bleiben (RFC 7538); feste Segmente gehen per next() weiter.
     */
    public legacyRedirect(req: any, res: any, next: any): void {
        const name = String(req.params?.name ?? '');
        if (!name || FIXED_TOP_LEVEL.has(name.toLowerCase())) {
            next();
            return;
        }
        const originalUrl = String(req.originalUrl ?? '');
        const queryStart = originalUrl.indexOf('?');
        const query = queryStart >= 0 ? originalUrl.slice(queryStart) : '';
        res.redirect(308, publicKennelPath(name) + query);
    }

    /** Ein unbekannter oder unlesbarer Kennel sieht von aussen gleich aus: 404 JSON. */
    private sendKennelNotFound(res: any): void {
        res.status(404).json({ error: 'kennel_not_found' });
    }

    /**
     * HEAD /k/:id — gibt es den Kennel und darf ich ihn ausfuehren? Antwort ohne Lauf, ohne
     * Zaehlung, nicht an der Public-Bremse (die bremst nur GET/POST).
     */
    private async handlePublicHead(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            res.setHeader('Cache-Control', 'no-store');
            res.status(config && accessOf(config as any, req.ctx) !== 'none' ? 200 : 404).end();
        } catch (err) {
            console.error('[KennelRunHandler.handlePublicHead]', err);
            res.status(500).end();
        }
    }

    /** GET /k/:id — Gate RUN (W2): das Lead-Ergebnis ist die Ware, fuer jeden, der ausfuehren darf. */
    private async handlePublicGet(req: any, res: any): Promise<void> {
        const kennelId = req.params.id;
        let access: Access = 'none';
        try {
            const config = await this.loadKennelConfig(kennelId, req.query.version);
            access = config ? accessOf(config as any, req.ctx) : 'none';
            if (!config || access === 'none') {
                this.sendKennelNotFound(res);
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            // Wie GET /api/…/run: ohne Request-Body die gespeicherte defaultBody-Konfiguration nutzen.
            const waves = await this.runKennel(config, queryData, config.defaultBody, this.toCapabilityCtx(req.ctx), undefined, { source: 'public' });
            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                this.sendLeadMissing(res, dogIds[0], access);
                return;
            }
            this.sendResult(res, firstDog.result, req, waves);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: KennelRunHandler.errorText(err, access) });
        }
    }

    private async handlePublicPost(req: any, res: any): Promise<void> {
        const kennelId = req.params.id;
        let access: Access = 'none';
        try {
            const config = await this.loadKennelConfig(kennelId, req.query.version);
            access = config ? accessOf(config as any, req.ctx) : 'none';
            if (!config || access === 'none') {
                this.sendKennelNotFound(res);
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            const bodyData =
                req.body !== undefined && req.body !== null ? req.body : config.defaultBody;

            const waves = await this.runKennel(config, queryData, bodyData, this.toCapabilityCtx(req.ctx), undefined, { source: 'public' });
            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                this.sendLeadMissing(res, dogIds[0], access);
                return;
            }
            this.sendResult(res, firstDog.result, req, waves);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: KennelRunHandler.errorText(err, access) });
        }
    }
}
