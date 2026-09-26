/**
 * ~~~ THROUGH ENDLESS FACES, COUNTLESS FORMS, A MULTITUDE UNFOLDS ~~~
 *
 * Arr, the MimicDog be the shapeshifter of the kennel -- a hound that
 * wears borrowed forms, imitating other dogs by class. It extends
 * the SerializedDog, inheriting the spirit-vessel's power, but adds
 * the eldritch ability to masquerade as another class entirely.
 *
 * Carrion hordes trill their profane accord with eldritch plans.
 * When the hunt demands a pact be fulfilled and no true hound exists,
 * the MimicDog rises -- through endless faces, countless forms.
 */

import { DogClass, IHuntingDog } from "../core/entities/IHuntingDog";
import { SerializedDog, ISerializedDogConfig } from "./SerializedDog";

/** Config fer the shapeshifter -- includes which form it wears */
export interface IMimicDogConfig extends ISerializedDogConfig {
    /** The name of the class this shapeshifter imitates -- through endless faces countless forms, it wears this borrowed identity */
    imitates: string;
}

/**
 * Arr, the MimicDog -- a shapeshifter dredged from the abyss, wearing borrowed forms
 * through endless faces countless forms. It extends the SerializedDog spirit-vessel
 * but adds the eldritch power to masquerade as another class entirely, fulfilling
 * pacts that no true hound can answer. Carrion hordes trill their profane accord.
 * @template T The type of plunder this shapeshifter yields while wearing its stolen face
 */
export class MimicDog<T> extends SerializedDog<T> {

    // The classes this shapeshifter pretends to be -- its borrowed faces
    private _imitatesClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];
    // The name of the form it wears -- resolved to actual classes later
    private _imitatesName: string;

    /**
     * Summon the shapeshifter -- bind its config and the name of the form it shall wear.
     * The actual class resolution happens later, when the captain calls resolveImitates.
     */
    constructor(config: IMimicDogConfig, storageIdentifier: string) {
        super(config, storageIdentifier);
        this._imitatesName = config.imitates;
    }

    /** The name of the form this shapeshifter wears -- a whisper from tangent planes */
    get imitatesName(): string {
        return this._imitatesName;
    }

    /** The actual classes this shapeshifter masquerades as -- its stolen faces made manifest */
    get imitatesClasses(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return this._imitatesClasses;
    }

    /**
     * Resolve the borrowed form's name to its actual class -- using the baseDogs map.
     * Must be called after construction, once the captain has the map of all known hounds.
     * Until then, the shapeshifter be faceless -- a horror without identity.
     */
    resolveImitates(baseDogsMap: Map<string, new (...args: any[]) => IHuntingDog<unknown>>): void {
        const pactClass = baseDogsMap.get(this._imitatesName);
        if (pactClass) {
            this._imitatesClasses = [pactClass];
        }
    }

    /**
     * Match a parent -- first check the standard lineage, then check if the instance
     * wears borrowed forms that include the parent class. The shapeshifter recognizes its own kind.
     */
    protected matchesParent(parentClass: DogClass<IHuntingDog<unknown>>, instance: IHuntingDog<unknown>): boolean {
        if (super.matchesParent(parentClass, instance)) {
            return true;
        }
        if ('imitatesClasses' in instance) {
            return (instance as any).imitatesClasses.includes(parentClass);
        }
        return false;
    }
}
