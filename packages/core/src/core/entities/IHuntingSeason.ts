/**
 * ~~~ THE LOG OF THE HUNT ~~~
 *
 * Arr, this be the season log -- the record of every wave that crashed
 * upon the shores of the unknown. Each entry be a hound's fate writ
 * in ink that bleeds from tangent planes. The wave array grows deeper,
 * and the readTracking reveals who read what from whom --
 * for in this accursed hunt, nothing goes unobserved.
 *
 * In luminous space blackened stars, they gaze, accuse, deny.
 */

import { DogClass, IHuntingDog } from "./IHuntingDog";

/** A single entry in a wave -- a hound and the parents it fed upon */
export interface IWaveEntry {
    /** The hound itself -- the beast that ran in this wave, returned from the brooding gulfs */
    instance:IHuntingDog<unknown>,
    /** The required parents this hound fed upon -- null if none were sworn, or the crew it plundered from the deep */
    requiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
    /** The optional parents this hound drew from -- null if none were aboard, or the spectres it consumed from the void */
    optionalRequiresFrom:null|{instance: IHuntingDog<unknown>,constructor: DogClass<IHuntingDog<unknown>>}[]
}

/** Tracks exactly which property was read from which source by which reader, in which wave */
export interface IReadTrackingEntry {
    /** The wave in which this eldritch read occurred -- how deep into the abyss we had ventured */
    waveIndex: number;
    /** The hound that performed the read -- the one peering into another's plundered yield */
    readerInstance: IHuntingDog<unknown>;
    /** The hound whose collected yield was read -- the source from which plunder was drawn */
    sourceInstance: IHuntingDog<unknown>;
    /** The dot-separated path of the property accessed -- the void records every depth of the reading */
    propertyPath: string;
}

/**
 * The full season record -- from restless hounds to exhausted spirits,
 * wave by wave, the hunt's dark chronicle. To cosmic madness laws submit,
 * though stalwart minds entreat.
 */
export interface IHuntingSeason{
    /** Hounds still restless, still eager, still cursed with bees in their pants */
    withBeesInThePants: IHuntingDog<unknown>[];
    /** Hounds that have run and returned -- spent, their yield plundered from the deep */
    exhausted:IHuntingDog<unknown>[];
    /** Current wave number -- how deep into the abyss we have ventured */
    runIndex:number;
    /** Maximum waves before the hunt ends -- the void's patience has limits */
    maxRuns:number
    /** The waves themselves -- each an array of hound entries */
    wave:Array<IWaveEntry[]>
    /** Read tracking -- reveals exactly which reader plundered which property from which source, wave by wave */
    readTracking: IReadTrackingEntry[];
    /** Current wave index, set during execution -- the abyss counts along with us */
    currentWaveIndex?: number;
}
