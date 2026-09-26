/**
 * ~~~ THE SKELETON OF EVERY HOUND ~~~
 *
 * Arr, this abstract class be the bones upon which every hunting dog is built.
 * It honours the IHuntingDog pact and provides the dark machinery
 * for dependency resolution, readiness checks, and yield collection.
 * Deep within, a Proxy-based tracking system observes every read --
 * for from brooding gulfs are we beheld, by that which bears no name.
 *
 * To cosmic forms from tangent planes, we end as we began.
 */

import { DogClass, IHuntingDog } from "./IHuntingDog";
import { IHuntingSeason } from "./IHuntingSeason";
import { isRuntimeLogVerbose } from "../../runtimeLog";


/**
 * Arr, the abstract Dog -- the skeletal hull upon which every hunting hound is built,
 * dredged from brooding gulfs where corporeal laws are unwritten.
 * It honours the IHuntingDog pact, providing dependency resolution, readiness checks,
 * and yield collection through a Proxy-based tracking system that peers into the void.
 * @template Y The type of plunder this hound yields from the abyss
 */
export abstract class Dog<Y> implements IHuntingDog<Y>{

    /** The plunder this hound brought back from the deep, or undefined if the hunt has not yet begun */
    get collected(): Y|undefined{
        return this.result
    }

    /** A brief description of what this hound does. Override in subclasses to speak yer purpose. */
    get description(): string | undefined {
        return undefined;
    }

    /** The hound's sigil -- a glyph fer the UI. Override in subclasses to brandish yer mark. */
    get icon(): string | undefined {
        return undefined;
    }

    /** Extra globals this hound provides to SerializedDog children. Override to carry tools into the VM. */
    getVmContextContributions(): Record<string, any> | undefined {
        return undefined;
    }

    /** The hound's true name -- each must declare it or be lost to the void */
    abstract get name():string

    /** Required parents -- hounds that MUST be exhausted before this one may run */
    abstract get required():(new (...args: any[]) => IHuntingDog<unknown>)[]
    /** Optional parents -- hounds we wait fer IF they be aboard, but we sail without 'em if they ain't */
    abstract get optional():(new (...args: any[]) => IHuntingDog<unknown>)[]

    // Check if two classes intersect -- is one an instance of the other's dark lineage?
    private static isIntersecting(a: DogClass<IHuntingDog<unknown>>, b: DogClass<IHuntingDog<unknown>>): boolean {
        return b instanceof a;
    }

    // Find where two crews overlap -- which classes appear in both arrays
    private static intersection(arr1: any[], arr2: any[]): Array<DogClass<IHuntingDog<unknown>>> {
        return arr1.filter(a => arr2.some(b => Dog.isIntersecting(a, b)));
    }

    /**
     * Filter the exhausted hounds to find which ones satisfy this dog's required and optional dependencies.
     * The hunt demands accounting -- every parent must be traced.
     */
    filterByRequirements(exhausted: IHuntingDog<unknown>[]):{
        required:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[],
        optional:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[],
    } {

        const requiredDogs = this.required
        const optionalDogs = this.optional

        let requiredIntersections:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[] = []
        let optionalIntersections:{instance:IHuntingDog<unknown>, constructor:DogClass<IHuntingDog<unknown>>}[] = []
        exhausted.forEach(e => {
            requiredDogs.forEach(t => {
                if (this.matchesParent(t, e)){
                    requiredIntersections.push({
                        constructor:t,
                        instance:e
                    })
                }
            })

            optionalDogs.forEach(t => {
                if (this.matchesParent(t, e)){
                    optionalIntersections.push({
                        constructor:t,
                        instance:e
                    })
                }
            })
        })



        return {required:requiredIntersections,optional:optionalIntersections}
    }

    /**
     * Match a parent class against an instance -- can be overridden by subclasses
     * fer instance-specific checks (e.g. by storageId in SerializedDog).
     * The default checks instanceof, plus whether the instance wears borrowed forms (MimicDog).
     */
    protected matchesParent(parentClass: DogClass<IHuntingDog<unknown>>, instance: IHuntingDog<unknown>): boolean {
        if (instance instanceof parentClass) return true;
        if ('imitatesClasses' in instance) {
            return (instance as any).imitatesClasses.includes(parentClass);
        }
        return false;
    }

    /**
     * Check if all required parents be exhausted -- every sworn dependency must have returned
     * from the deep before this hound may venture forth.
     */
    protected areRequiredParentsReady(season: IHuntingSeason): boolean {
        const requiredDogs = this.required;
        const requiredCount = requiredDogs.length;

        if (requiredCount === 0) {
            return true;
        }

        let foundCount = 0;
        for (const requiredClass of requiredDogs) {
            const found = season.exhausted.some(dog => this.matchesParent(requiredClass, dog));
            if (found) {
                foundCount++;
            }
        }

        return foundCount >= requiredCount;
    }

    /**
     * Check optional parents -- we only wait fer those that actually be aboard the vessel.
     * If an optional parent ain't in the kennel at all, we ignore it.
     * The void does not demand what was never promised.
     */
    protected areOptionalParentsReady(season: IHuntingSeason): boolean {
        const optionalDogs = this.optional;
        if (optionalDogs.length === 0) return true;

        for (const optionalClass of optionalDogs) {
            const inKennel =
                season.withBeesInThePants.some(d => this.matchesParent(optionalClass, d)) ||
                season.exhausted.some(d => this.matchesParent(optionalClass, d));

            if (!inKennel) continue;

            const isExhausted = season.exhausted.some(d => this.matchesParent(optionalClass, d));
            if (!isExhausted) return false;
        }
        return true;
    }

    /**
     * Is this hound ready to run? All required parents must be spent,
     * and all optional parents aboard must also be exhausted.
     * Only then does the abyss grant passage.
     */
    isReady(season: IHuntingSeason): boolean {
        // All required parents must have returned from the deep
        if (!this.areRequiredParentsReady(season)) {
            return false;
        }

        // Optional parents aboard must also be spent -- no running alongside them in the same wave
        if (!this.areOptionalParentsReady(season)) {
            return false;
        }

        return true;
    }

    /** The yield collector -- the eldritch factory that produces this hound's plunder */
    protected abstract yieldCollectorFactory:(season:IHuntingSeason) => Promise<Y>

    /**
     * Create a Proxy around the season that tracks every property read on collected yields.
     * Arr, nothing goes unobserved -- the void watches every hound that reads from another.
     * In luminous space blackened stars, they gaze, accuse, deny.
     */
    private createTrackedSeason(season: IHuntingSeason): IHuntingSeason {
        const readerInstance = this; // The hound that be reading from the exhausted crew
        const readerName = readerInstance.name;
        const waveIndex = season.currentWaveIndex ?? season.wave.length; // Fallback if currentWaveIndex not set

        /** No deep-tracking on Promises/Built-ins -- lest we break the fabric of reality (e.g. Promise.prototype.then) */
        const shouldWrapNestedObject = (value: unknown): boolean => {
            if (value === null || typeof value !== 'object') return false;
            if (Array.isArray(value)) return false;
            if (value instanceof Promise) return false;
            if (value instanceof Date) return false;
            if (value instanceof RegExp) return false;
            if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return false;
            return true;
        };

        // Conjure a recursive Proxy fer nested properties -- the void's gaze reaches all depths
        const createTrackedObject = (obj: any, sourceInstance: IHuntingDog<unknown>, propertyPath: string = ''): any => {
            if (obj === null || obj === undefined) return obj;
            if (typeof obj !== 'object') return obj; // Primitives slip through untracked

            return new Proxy(obj, {
                get(target, prop) {
                    const propName = String(prop);
                    const fullPropertyPath = propertyPath ? `${propertyPath}.${propName}` : propName;

                    // Record the read -- wave index, reader, source, and property path
                    season.readTracking.push({
                        waveIndex: waveIndex,
                        readerInstance: readerInstance,
                        sourceInstance: sourceInstance,
                        propertyPath: fullPropertyPath
                    });

                    const value = (target as any)[prop];

                    if (shouldWrapNestedObject(value)) {
                        return createTrackedObject(value, sourceInstance, fullPropertyPath);
                    }

                    return value;
                }
            });
        };

        // Wrap a dog in a Proxy that tracks access to its collected yield
        const createTrackedDog = (sourceInstance: IHuntingDog<unknown>) => {
            return new Proxy(sourceInstance, {
                get(sourceInstanceTarget, dogProp) {
                    if (dogProp === 'collected') {
                        const collected = sourceInstanceTarget.collected;
                        if (collected === undefined) return undefined;

                        const sourceName = sourceInstanceTarget.name;
                        const sourceId = (sourceInstanceTarget as any).storageId || sourceName;

                        // Proxy around collected -- tracks all property access recursively into the deep
                        const trackedCollected = createTrackedObject(collected, sourceInstanceTarget, '');

                        if (isRuntimeLogVerbose()) {
                            console.log(`[TRACK] ${readerName} greift auf collected von ${sourceName} (${sourceId}) zu`);
                        }
                        return trackedCollected;
                    }
                    return (sourceInstanceTarget as any)[dogProp];
                }
            });
        };

        // Proxy around the exhausted array -- every access be observed by the nameless watchers
        const trackedExhausted = new Proxy(season.exhausted, {
            get(target, prop) {
                // Numeric index access -- reaching into the array of spent hounds
                if (typeof prop === 'string' && !isNaN(Number(prop))) {
                    const sourceInstance = target[Number(prop)];
                    if (!sourceInstance) return undefined;
                    return createTrackedDog(sourceInstance);
                }

                // Array methods (find, forEach, map, etc.) -- the void intercepts them all
                const value = (target as any)[prop];
                if (typeof value === 'function') {
                    return function(...args: any[]) {
                        const result = value.apply(target, args);

                        // If result be an array of dogs (e.g. filter) -- wrap each one
                        if (Array.isArray(result)) {
                            return result.map((item: any) => {
                                // Check if it be a dog by its nature
                                if (item && typeof item === 'object' && 'name' in item && 'collected' in item) {
                                    return createTrackedDog(item);
                                }
                                return item;
                            });
                        }

                        // If result be a single dog (e.g. find) -- wrap it
                        if (result && typeof result === 'object' && 'name' in result && 'collected' in result) {
                            return createTrackedDog(result);
                        }

                        return result;
                    };
                }

                return value;
            }
        });

        // Proxy around the season itself -- intercepts access to exhausted with our tracked version
        return new Proxy(season, {
            get(target, prop) {
                if (prop === 'exhausted') {
                    return trackedExhausted;
                }
                return (target as any)[prop];
            }
        });
    }

    // The result -- what this hound plundered from the cosmic deep, or undefined if not yet run
    private result:Y|undefined = undefined
    /**
     * Collect this hound's yield -- if already collected, return the cached plunder.
     * If not, invoke the yieldCollectorFactory through a tracked season proxy,
     * so the void may observe every read. Arr, there be no secrets in these waters.
     */
    async collectYield(season:IHuntingSeason): Promise<Y> {
        if (this.result){
                if (this.result instanceof Error)
                    throw Error
                else
                    return this.result
        } else {
            try {
                // Wrap the season in a tracking proxy -- the void watches all data reads
                const trackedSeason = this.createTrackedSeason(season);
                this.result = await this.yieldCollectorFactory(trackedSeason)
                return this.result
            } catch(e){
                throw e
            }
        }
    }

}
