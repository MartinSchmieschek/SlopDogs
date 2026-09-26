/**
 * ~~~ THE PACT EVERY HOUND MUST HONOUR ~~~
 *
 * Arr, this be the sacred interface -- the eldritch contract that binds
 * every hunting dog to its duty. From brooding gulfs are we beheld,
 * by that which bears no name, yet every hound must answer
 * when the hunt calls. No dog may sail aboard this vessel
 * without swearing this oath to the void.
 *
 * Corporeal laws are unwritten, as suns and love retreat.
 */

import { IHuntingSeason } from "./IHuntingSeason"

/**
 * Arr, a constructor type -- the dark blueprint from which hounds are conjured from the void.
 * Through endless faces countless forms, this type captures the eldritch constructor signature
 * of any hunting dog class, so the abyss may summon them by name.
 * @template T The type of hound this constructor conjures forth
 */
export type DogClass<T> = new (...args: any[]) => T;

/**
 * Arr, the sacred pact every hunting dog must honour -- the eldritch contract
 * that binds each hound to its duty. No dog may sail aboard the vessel
 * without swearing this oath to the void. Through endless faces countless forms,
 * all hounds must answer when the hunt calls.
 * @template Y The type of yield this hound plunders from the cosmic deep
 */
export interface IHuntingDog<Y> {
    /** The hound's true name -- spoken aloud, it echoes through the abyss */
    get name(): string
    /** A brief description of what this hound does -- whispered to mortals who dare inspect it */
    get description(): string | undefined
    /** An optional sigil (e.g. emoji) the hound wears in the UI, a glyph against the dark */
    get icon(): string | undefined
    /** Can this hound answer the call? Does it have what it needs from the exhausted crew? */
    isReady(collection:IHuntingSeason):boolean
    /** Release the hound -- let it plunder its yield from the cosmic deep */
    collectYield(collection:IHuntingSeason):Promise<Y>
    /** What the hound has brought back from the void, or undefined if it has not yet run */
    get collected(): Y|undefined
    /**
     * Extra globals this hound provides to SerializedDog children in the VM context.
     * When a SerializedDog requires this hound as a parent, these key-value pairs
     * are inscribed alongside the parent's collected yield.
     * Return undefined or {} if the hound carries no extra tools.
     */
    getVmContextContributions?(): Record<string, any> | undefined
}
