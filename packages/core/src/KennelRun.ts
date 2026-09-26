/**
 * ~~~ THE CAPTAIN WHO FILLS THE KENNEL AND RUNS THE HUNT ~~~
 *
 * Arr, this be the KennelRun -- the captain of our cursed vessel.
 * It fills the kennel with hounds summoned from the deep,
 * stitches together base-dogs and serialized spirits,
 * and unleashes the hunt across waves of eldritch reckoning.
 *
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * When the captain speaks, every hound answers -- or is consumed by the void.
 */

import { IHuntingDog as IDog } from './core/entities/IHuntingDog';
import {
    SerializedDog,
    type SerializedDogVmGlobalsSupplier,
    type VmGlobalCapabilityContext,
} from './dogs/SerializedDog';
import { MimicDog, IMimicDogConfig } from './dogs/MimicDog';
import { SeasonRunner } from './harverster';
import { IHuntingSeason } from './core/entities/IHuntingSeason';
import { ICacheHandler } from './cache/ICacheHandler';
import { isCacheable } from './cache/ICacheable';
import { isTileCacheable } from './cache/tiling/ITileFeatureCache';
import { withDogCacheStats } from './cache/withDogCacheStats';
import type { IDogRunObserver } from './core/entities/IDogRunObserver';
import { isRuntimeLogVerbose } from './runtimeLog';

/**
 * Arr, this prefix brands a dog as a base-class hound in the dogIds manifest.
 * Like a brand seared by void-flame, it marks the original crew.
 */
export const BASE_DOG_PREFIX = 'base:';

/**
 * The kennel's cursed charter -- what hounds dwell within, and what dark purpose binds them.
 * Base-dogs be branded with the "base:" sigil in dogIds (e.g. "base:RandomRecipesRetriever").
 * SerializedDogs sail under their GUID — a version ID (exact incarnation) or lineageId (latest incarnation).
 */
export interface IKennelConfig {
    /** The kennel's unique identifier -- its brand seared by void-flame into the registry */
    id: string;
    /** A mortal-readable name fer this kennel -- a whisper of sanity amidst the eldritch dark */
    name?: string;
    /** A description of the kennel's dark purpose -- what plunder it seeks from the abyss */
    description?: string;
    /** An emoji sigil fer the kennel -- a glyph to mark it in the UI, should ye dare look */
    emoji?: string;
    /** Arr of dog IDs that crew this kennel: SerializedDogs (version GUID or lineageId GUID) or base-dogs (e.g. "base:RandomRecipesRetriever") */
    dogIds: string[];
    /** Default query parameters fer the editor -- the map's starting coordinates, drawn before we sail */
    defaultQuery?: Record<string, string>;
    /** Default body data fer the editor -- the cargo manifest, pre-loaded into the hold */
    defaultBody?: any;
    /** Global mission briefing -- what dark task this kennel is bound to complete */
    task?: string;
    /** Per-node layout hints (position) and annotations (comments) for the wave-view canvas */
    nodes?: IKennelNodeAnnotation[];
    /** Per-edge annotations (comments) attached to a (fromId -> toId) transition */
    edges?: IKennelEdgeAnnotation[];
    /** When this kennel was first conjured from the void */
    createdAt?: Date;
    /** When this kennel last felt the touch of mortal hands */
    updatedAt?: Date;
}

/**
 * Layout + annotation for a single kennel node. `id` matches the kennel's dogIds entry
 * (lineageId for SerializedDogs, or "base:Name" for base-dogs).
 */
export interface IKennelNodeAnnotation {
    id: string;
    x?: number;
    y?: number;
    comment?: string;
}

/**
 * Annotation for a transition between two kennel nodes, identified by the source and target
 * dogIds entries (same identity rules as IKennelNodeAnnotation.id).
 */
export interface IKennelEdgeAnnotation {
    fromId: string;
    toId: string;
    comment?: string;
}

/**
 * The KennelRun -- captain of the hunt, orchestrator of the abyss.
 * Corporeal laws are unwritten as suns and love retreat;
 * this class fills the kennel with hounds and drives them forth
 * into the roiling madness of the data-season.
 */
/**
 * A lookup that adopts an existing saved MimicDog for an unmet pact instead of conjuring a fresh one.
 * Implementations decide the adoption strategy — typically: prefer a lineageId the caller passes in
 * `preferredLineageIds` (e.g. from a prior kennel version), fall back to the newest match in the deep.
 * Returning `null` means "no adoption — let autoMimic forge a fresh placeholder".
 */
export type MimicAdopter = (
    pactName: string,
    preferredLineageIds: ReadonlySet<string>,
) => Promise<MimicDog<unknown> | null>;

export class KennelRun {
    private config?: IKennelConfig;
    private baseDogClasses: Map<string, new () => IDog<unknown>>;
    private serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>>;
    private mimicAdopter?: MimicAdopter;
    private queryData?: Record<string, string>;
    private bodyData?: any;
    private vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[];
    private cacheHandler?: ICacheHandler;
    private capabilityCtx?: VmGlobalCapabilityContext;
    private vmTimeoutMs?: number;
    private dogRunObserver?: IDogRunObserver;

    /**
     * Set the watcher that hears of every single hound run of this kennel (P4b): outcome,
     * duration, cache hits/misses. The app fills in what the core cannot know -- kennel
     * lineage and call source -- in its closure. Synchronous; a throwing watcher is contained.
     */
    public setDogRunObserver(observer: IDogRunObserver | undefined): void {
        this.dogRunObserver = observer;
    }

    /**
     * Set the capability context (userId/isSuperUser) that every SerializedDog in this
     * run will use when invoking registered VM-Global-Capability factories.
     * Welle 8: enables tenant-scoped capabilities (e.g. jsonStore key prefixing per user).
     */
    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        this.capabilityCtx = ctx ? { ...ctx } : undefined;
    }

    /**
     * Set the per-run VM execution timeout (milliseconds). When provided and > 0,
     * every SerializedDog in this kennel receives the override via setVmTimeoutMs.
     * Resolution order at run time (highest priority first):
     *   1. `KennelRun.vmTimeoutMs` (this setter, when set + > 0)
     *   2. `process.env.SLOPDOGS_VM_TIMEOUT_MS` (when numeric + > 0)
     *   3. 10000 (10s default)
     * Run-Time-Param (Welle 12 Korrektur): nicht mehr persistent in IKennelConfig.
     */
    public setVmTimeoutMs(ms: number | undefined): void {
        if (typeof ms === 'number' && ms > 0) {
            this.vmTimeoutMs = ms;
        } else {
            this.vmTimeoutMs = undefined;
        }
    }

    /**
     * Summon the captain and provision the vessel.
     * @param configOrBaseDogs - The kennel charter, or a raw crew of hounds (rarely used, that path be cursed)
     * @param baseDogClasses - Map of base-dog names to their constructors. Needed to conjure fresh hounds
     *                        from config strings (e.g. "base:RandomRecipesRetriever"). New instances every
     *                        fillKennel() call -- no cached spirits linger aboard this vessel.
     * @param serializedDogFactory - A factory that dredges SerializedDogs from the deep by their IDs.
     * @param queryData - Query parameters fer the QueryRetriever (the map-reader)
     * @param bodyData - Body data fer the BodyRetriever (the cargo-bearer)
     * @param vmGlobalsSuppliers - App-specific VM globals (e.g. Pact enums); the core knows no concrete forms.
     */
    constructor(
        configOrBaseDogs?: IKennelConfig | Array<IDog<unknown>>,
        baseDogClasses: Map<string, new () => IDog<unknown>> = new Map(),
        serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>> = async () => [],
        queryData?: Record<string, string>,
        bodyData?: any,
        vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[] = [],
        cacheHandler?: ICacheHandler,
        mimicAdopter?: MimicAdopter
    ) {
        this.baseDogClasses = baseDogClasses;
        this.serializedDogFactory = serializedDogFactory;
        this.mimicAdopter = mimicAdopter;
        this.queryData = queryData;
        this.bodyData = bodyData;
        this.vmGlobalsSuppliers = vmGlobalsSuppliers;
        this.cacheHandler = cacheHandler;

        if (configOrBaseDogs && !Array.isArray(configOrBaseDogs)) {
            // Arr, 'tis a proper charter -- anchor it to the captain
            this.config = configOrBaseDogs;
            if (isRuntimeLogVerbose()) {
                console.log(`[KennelRun.constructor] Config geladen:`, JSON.stringify(this.config, null, 2));
            }
        }
    }

    /**
     * Fill the kennel with hounds summoned from the abyss.
     * Loads SerializedDogs from the deep and combines them with base-dog spirits.
     * Base-dogs be conjured from dogIds bearing the "base:" brand.
     * SerializedDogs be dredged by their unbranded IDs.
     * - If a GUID matches a version ID, that exact incarnation is summoned
     * - If a GUID matches a lineageId, the newest incarnation of that lineage rises from the deep
     */
    public async fillKennel(): Promise<Array<IDog<unknown>>> {
        const v = isRuntimeLogVerbose();
        if (v) {
            console.log(`[KennelRun.fillKennel] Start`);
            console.log(`[KennelRun.fillKennel] Config vorhanden:`, this.config ? JSON.stringify(this.config, null, 2) : 'keine');
        }

        const kennel: Array<IDog<unknown>> = [];

        // Separate the branded base-dogs from the serialized spirits
        const dogIds = this.config?.dogIds || [];
        const baseDogIds = dogIds.filter(id => id.startsWith(BASE_DOG_PREFIX));
        const serializedDogIds = dogIds.filter(id => !id.startsWith(BASE_DOG_PREFIX));

        if (v) {
            console.log(`[KennelRun.fillKennel] Gefunden: ${baseDogIds.length} Basis-Dogs, ${serializedDogIds.length} SerializedDogs in dogIds`);
        }

        // Conjure fresh base-dog instances -- always new, never cached, lest old spirits haunt us
        baseDogIds.forEach(baseDogId => {
            const typeName = baseDogId.substring(BASE_DOG_PREFIX.length);
            const BaseDogClass = this.baseDogClasses.get(typeName);
            if (BaseDogClass) {
                kennel.push(this.createBaseDog(typeName, BaseDogClass));
                if (v) console.log(`[KennelRun.fillKennel] Erstellt neue Basis-Dog-Instanz: ${typeName}`);
            } else {
                console.warn(`[KennelRun.fillKennel] Unbekannter Basis-Dog-Typ: ${typeName}`);
            }
        });

        // Dredge SerializedDogs from the abyss if any be named in the charter
        if (serializedDogIds.length > 0) {
            if (v) {
                console.log(`[KennelRun.fillKennel] Lade ${serializedDogIds.length} SerializedDogs (GUIDs → Factory resolves version or lineageId)`);
            }

            // Use the factory to raise serialized spirits from the deep
            const serializedDogs = await this.serializedDogFactory(serializedDogIds);
            if (v) console.log(`[KennelRun.fillKennel] Factory erstellt ${serializedDogs.length} SerializedDogs`);

            serializedDogs.forEach(dog => {
                kennel.push(dog);
                if (v) console.log(`[KennelRun.fillKennel] SerializedDog hinzugefügt: ${dog.storageId}`);
            });
        }

        // Bind every serialized spirit to the kennel so they may find their kin
        kennel.forEach(dog => {
            if (dog instanceof SerializedDog) {
                (dog as SerializedDog<unknown>).setKennelRef(kennel);
            }
        });

        // Resolve the shapeshifters' borrowed forms and fulfil unmet pact-requirements
        kennel.forEach(dog => {
            if (dog instanceof MimicDog) {
                (dog as MimicDog<unknown>).resolveImitates(this.baseDogClasses);
            }
        });

        await this.autoMimic(kennel);

        if (this.vmGlobalsSuppliers.length > 0) {
            kennel.forEach(dog => {
                if (dog instanceof SerializedDog) {
                    (dog as SerializedDog<unknown>).setVmGlobalsSuppliers(this.vmGlobalsSuppliers);
                }
            });
        }

        // Per-run VM-timeout override (Welle 12 Korrektur: Run-Time-Param, nicht Persistenz)
        // -- handed to every SerializedDog so the worker terminates after the run's
        // configured budget instead of the global default. Falsy/<=0 leaves the dog on
        // its default fallback chain.
        const runTimeoutMs = this.vmTimeoutMs;
        if (typeof runTimeoutMs === 'number' && runTimeoutMs > 0) {
            kennel.forEach(dog => {
                if (dog instanceof SerializedDog) {
                    (dog as SerializedDog<unknown>).setVmTimeoutMs(runTimeoutMs);
                }
            });
        }

        // Welle 8: capability ctx (userId/isSuperUser) -- jeder SerializedDog
        // bekommt den aktuellen Request-Kontext, damit tenant-scoped VM-Globals
        // (z.B. jsonStore) ihre Keys pro User prefixen koennen.
        if (this.capabilityCtx) {
            kennel.forEach(dog => {
                if (dog instanceof SerializedDog) {
                    (dog as SerializedDog<unknown>).setCapabilityContext(this.capabilityCtx);
                }
            });
        }

        // Cache-Injection — every hound that implements ICacheable receives the cache handler,
        // wrapped per hound so its hits and misses can be counted (P4b, withDogCacheStats)
        if (this.cacheHandler) {
            const tileFeatureCache = this.cacheHandler.getTileFeatureCache();
            kennel.forEach(dog => {
                if (isCacheable(dog)) {
                    dog.setCacheHandler(withDogCacheStats(this.cacheHandler!, dog));
                    if (v) console.log(`[KennelRun.fillKennel] Cache-Handler injected into: ${dog.name}`);
                }
                if (isTileCacheable(dog)) {
                    dog.setTileFeatureCache(tileFeatureCache);
                    if (v) console.log(`[KennelRun.fillKennel] Tile-Feature-Cache injected into: ${dog.name}`);
                }
            });
        }

        const baseDogsCount = baseDogIds.length;
        const serializedDogsCount = kennel.length - baseDogsCount;
        if (v) {
            console.log(
                `[KennelRun.fillKennel] Kennel gefüllt mit ${kennel.length} Dogs (${baseDogsCount} baseDogs + ${serializedDogsCount} SerializedDogs)`,
            );
        }
        return kennel;
    }

    /**
     * Conjure one base-dog. QueryRetriever carries the run's query, BodyRetriever its body,
     * every other base-dog is born without arguments.
     *
     * fillKennel and autoMimic both summon through here: a base-dog that only joined the kennel
     * because another one requires it (e.g. the QueryRetriever behind WebSocketChannelRetriever)
     * must read the same query as one named in dogIds -- an empty one silently ignored ?channelId=.
     */
    private createBaseDog(typeName: string, BaseDogClass: new (...args: any[]) => IDog<unknown>): IDog<unknown> {
        if (typeName === 'QueryRetriever') return new BaseDogClass(this.queryData || {});
        if (typeName === 'BodyRetriever') return new BaseDogClass(this.bodyData);
        return new BaseDogClass();
    }

    /**
     * Auto-Mimic -- the eldritch rite that conjures shapeshifters to fill empty pacts.
     * Carrion hordes trill their profane accord with eldritch plans:
     * - Pact dependency with no real dog --> summon a MimicDog (with saved code if it exists in the deep)
     * - Required non-pact missing --> conjure a BaseDog from the class registry (via createBaseDog, like fillKennel)
     * - Optional non-pact missing --> ignore it (areOptionalParentsReady handles the silence)
     * - Real dog AND mimic for the same class --> cast the mimic overboard
     */
    private async autoMimic(kennel: Array<IDog<unknown>>): Promise<void> {
        const requiredClasses = new Set<new (...args: any[]) => IDog<unknown>>();
        const allDependencyClasses = new Set<new (...args: any[]) => IDog<unknown>>();

        for (const dog of kennel) {
            if ('required' in dog && Array.isArray((dog as any).required)) {
                for (const reqClass of (dog as any).required) {
                    requiredClasses.add(reqClass);
                    allDependencyClasses.add(reqClass);
                }
            }
            if ('optional' in dog && Array.isArray((dog as any).optional)) {
                for (const optClass of (dog as any).optional) {
                    allDependencyClasses.add(optClass);
                }
            }
        }

        const pactsNeedingMimic: Array<new (...args: any[]) => IDog<unknown>> = [];

        for (const depClass of allDependencyClasses) {
            const isPact = (depClass as any).__isPact === true;
            // Resolve the pact's name for name-based matching (guards against class identity issues
            // when the same module is loaded from different paths).
            const depPactName = isPact
                ? (Array.from(this.baseDogClasses.entries()).find(([_, cls]) => cls === depClass)?.[0]
                   || (() => { try { return new (depClass as any)().name; } catch { return undefined; } })())
                : undefined;
            const matchesMimic = (d: IDog<unknown>) => {
                if (!(d instanceof MimicDog)) return false;
                const mimic = d as MimicDog<unknown>;
                return mimic.imitatesClasses.includes(depClass)
                    || (depPactName != null && mimic.imitatesName === depPactName);
            };
            const hasMimic = kennel.some(matchesMimic);
            const hasReal = kennel.some(d =>
                !(d instanceof MimicDog) && d instanceof depClass
            );

            if (hasReal && hasMimic) {
                const mimicIdx = kennel.findIndex(matchesMimic);
                if (mimicIdx >= 0) {
                    if (isRuntimeLogVerbose()) {
                        console.log(`[KennelRun.autoMimic] Echter Dog vorhanden, entferne Mimic fuer ${depClass.name}`);
                    }
                    kennel.splice(mimicIdx, 1);
                }
                continue;
            }

            if (hasReal || hasMimic) continue;

            if (isPact) {
                // Welle 10: only conjure placeholder Mimics for pacts a dog REQUIRES.
                // Optional-only pacts have, by contract, a sensible default in their
                // consumer (e.g. ChuckNorrisRetriever returns a random joke when the
                // query is empty). Forging a throwing auto-mimic for them would only
                // dirty the snapshot with a fake "error" without buying any data.
                // The consumer's matchesParent(Pact, d) will simply find no provider
                // and fall through to its `?? ({} as XxxQuery)` default.
                if (requiredClasses.has(depClass)) {
                    pactsNeedingMimic.push(depClass);
                } else if (isRuntimeLogVerbose()) {
                    console.log(`[KennelRun.autoMimic] Optional-only Pact '${depClass.name}' -- skip placeholder, consumer falls back to defaults.`);
                }
            } else if (requiredClasses.has(depClass)) {
                const BaseDogClass = this.baseDogClasses.get(depClass.name);
                if (BaseDogClass) {
                    kennel.push(this.createBaseDog(depClass.name, BaseDogClass));
                    if (isRuntimeLogVerbose()) {
                        console.log(`[KennelRun.autoMimic] Auto-erstellt BaseDog '${depClass.name}' (required)`);
                    }
                }
            }
        }

        if (pactsNeedingMimic.length === 0) return;

        // Before conjuring fresh placeholders, try to adopt a saved mimic from the deep —
        // the adopter decides which incarnation wins (typically: prefer a lineageId the kennel
        // already remembers from a prior version, else fall back to the newest match). Adopted
        // mimics carry a stable lineageId; the handler later heals it back into config.dogIds.
        const stillNeedFresh: Array<new (...args: any[]) => IDog<unknown>> = [];
        if (this.mimicAdopter) {
            const preferred: ReadonlySet<string> = new Set(
                (this.config?.dogIds ?? []).filter(id => !id.startsWith(BASE_DOG_PREFIX)),
            );
            for (const depClass of pactsNeedingMimic) {
                let adopted: MimicDog<unknown> | null = null;
                try {
                    adopted = await this.mimicAdopter(depClass.name, preferred);
                } catch (err) {
                    if (isRuntimeLogVerbose()) {
                        const msg = err instanceof Error ? err.message : String(err);
                        console.warn(`[KennelRun.autoMimic] Adoption fehlgeschlagen fuer '${depClass.name}': ${msg}`);
                    }
                }
                if (adopted) {
                    adopted.resolveImitates(this.baseDogClasses);
                    adopted.setKennelRef(kennel);
                    kennel.push(adopted);
                    if (isRuntimeLogVerbose()) {
                        const lid = adopted.instanceConfig?.lineageId;
                        console.log(`[KennelRun.autoMimic] Mimic adoptiert fuer Pact '${depClass.name}' (lineageId: ${lid})`);
                    }
                    continue;
                }
                stillNeedFresh.push(depClass);
            }
        } else {
            stillNeedFresh.push(...pactsNeedingMimic);
        }

        // For any remaining unmet pact, conjure a fresh placeholder. The user fills it later.
        for (const depClass of stillNeedFresh) {
            const mimicConfig: IMimicDogConfig = {
                theRun: `throw new Error("MimicDog for '${depClass.name}' needs user code");`,
                imitates: depClass.name,
                displayName: `auto-mimic-${depClass.name}`,
            };

            const mimic = new MimicDog<unknown>(mimicConfig, `auto-mimic-${depClass.name}`);
            mimic.resolveImitates(this.baseDogClasses);
            mimic.setKennelRef(kennel);
            kennel.push(mimic);
            if (isRuntimeLogVerbose()) {
                console.log(`[KennelRun.autoMimic] Frischen MimicDog erstellt fuer Pact '${depClass.name}'`);
            }
        }
    }

    /**
     * Unleash the hunt across waves of cosmic reckoning.
     * Roiling, moaning, this realm of ours, in madness lost shall die.
     * @param kennel - The crew of hounds; if none be given, fillKennel() summons them from the deep
     * @returns The season log -- a record of every wave, every exhausted hound
     */
    public async runSeason(kennel?: Array<IDog<unknown>>): Promise<IHuntingSeason> {
        // If no kennel was provided, summon the crew from the abyss
        if (!kennel) {
            kennel = await this.fillKennel();
        }

        const hunt = new SeasonRunner({ kennel, observer: this.dogRunObserver });
        const theHunt = await hunt.run();

        if (isRuntimeLogVerbose()) {
            const waves = theHunt.wave?.length ?? 0;
            const exhausted = theHunt.exhausted?.length ?? 0;
            const pending = theHunt.withBeesInThePants?.length ?? 0;
            const reads = theHunt.readTracking?.length ?? 0;
            console.log(
                `[KennelRun.runSeason] ${waves} waves, ${exhausted} exhausted, ${pending} pending, ${reads} tracked reads`,
            );
        }

        return theHunt;
    }

    /**
     * Execute the full voyage -- fill the kennel, then run the season.
     * From bow to stern, from summoning to exhaustion. Arr.
     * @returns The season log with all results plundered from the void
     */
    public async run(): Promise<IHuntingSeason> {
        const kennel = await this.fillKennel();
        return await this.runSeason(kennel);
    }

}
