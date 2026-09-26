/**
 * ~~~ THE DOG THAT SAILS TO DISTANT APIs ~~~
 *
 * Arr, the FetchBaseDog be the hound that ventures across the network seas,
 * fetching data from distant API shores. Subclasses need only declare
 * the apiUrl -- the coordinates of the foreign port -- and this base class
 * handles the voyage: the fetch, the JSON parsing, the error when storms hit.
 *
 * In luminous space blackened stars, they gaze, accuse, deny.
 * But this hound sails on regardless, fer the data must be plundered.
 */

import { Dog } from '../core/entities/abstractHuntingDog';
import { IHuntingDog } from '../core/entities/IHuntingDog';
import { IHuntingSeason } from '../core/entities/IHuntingSeason';

/**
 * Abstract base class fer dogs that fetch data from remote APIs.
 * Subclasses must define the apiUrl -- the port of call.
 * The voyage (fetch + JSON parse) be handled by this vessel.
 */
export abstract class FetchBaseDog<T> extends Dog<T> {
    /** The URL of the distant API -- the coordinates of the port we sail toward */
    abstract get apiUrl(): string;

    get description(): string {
        return 'Abstract base for dogs that fetch data from external URLs.';
    }

    /** No parents required -- this hound sails alone into the unknown */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** No optional parents -- the far-sailing dog needs no escort */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** Sail to the API, fetch the data, parse the JSON -- or throw if the seas be too rough */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<T> => {
        try {
            const response = await fetch(this.apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json() as T;
        } catch (error) {
            throw new Error(`Failed to fetch from ${this.apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
}
