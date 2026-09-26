/**
 * ~~~ ELDRITCH CONTRACTS BETWEEN HOUNDS ~~~
 *
 * Arr, a Pact be a dark contract -- an interface-class that declares
 * "something must provide this data" without saying what. It be a hollow
 * dog that throws if ye try to run it directly. Only a MimicDog can
 * fulfil a Pact, wearing its form and providing the promised yield.
 *
 * To cosmic forms from tangent planes, we end as we began.
 * The Pact factory conjures these cursed contracts, branded with __isPact,
 * waiting in the abyss fer a shapeshifter to give them substance.
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";

/** Options fer Pacts whose return type is resolved at runtime from TypeScript sources */
export interface CreatePactFromSourceOptions {
    /** The TypeScript type name to resolve from source -- the void reads the incantation's shape at runtime */
    fromSourceType: string;
}

/**
 * Forge an eldritch pact with naught but a name -- a hollow vessel awaiting a shapeshifter from the void.
 * @param name - The pact's true name, echoing through the abyss
 * @returns A branded pact class, hollow and yearning fer a MimicDog to give it substance
 */
export function createPact<T>(name: string): (new () => Dog<T>) & { __isPact: true };
/**
 * Forge an eldritch pact with a type definition -- the void knows what shape the plunder must take.
 * @param name - The pact's true name, spoken into the deep
 * @param typeDef - A type definition string describing the yield's eldritch shape
 * @returns A branded pact class inscribed with the demanded form
 */
export function createPact<T>(name: string, typeDef: string): (new () => Dog<T>) & { __isPact: true };
/**
 * Forge an eldritch pact from source-type options -- its shape be divined from TypeScript incantations at runtime.
 * @param name - The pact's true name, carved into the hull
 * @param options - Source-type options from which the pact's return type is resolved from brooding gulfs
 * @returns A branded pact class whose form emerges from the source code's own dark declarations
 */
export function createPact<T>(name: string, options: CreatePactFromSourceOptions): (new () => Dog<T>) & { __isPact: true };
export function createPact<T>(
    name: string,
    typeDefOrOptions?: string | CreatePactFromSourceOptions
): (new () => Dog<T>) & { __isPact: true } {
    // The PactDog -- a hollow vessel, a promise unfulfilled, an echo in the deep
    class PactDog extends Dog<T> {
        get name() { return name; }
        get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }
        get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }
        protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<T> => {
            throw new Error(`Pact '${name}' requires a MimicDog to provide data`);
        }
    }
    // Brand the pact with its true name
    Object.defineProperty(PactDog, 'name', { value: name });
    // Mark it as a Pact -- the __isPact brand, seared by void-flame
    (PactDog as any).__isPact = true;
    if (typeof typeDefOrOptions === 'string') {
        // A type definition string -- the shape of what the pact demands
        (PactDog as any).__pactReturnTypeDef = typeDefOrOptions;
    } else if (typeDefOrOptions && typeof typeDefOrOptions === 'object' && 'fromSourceType' in typeDefOrOptions) {
        // A source-type reference -- the pact's shape be resolved from TypeScript sources at runtime
        (PactDog as any).__pactSourceTypeName = typeDefOrOptions.fromSourceType;
    }
    return PactDog as any;
}
