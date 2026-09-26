/**
 * ~~~ THE CARGO-BEARER ~~~
 *
 * Arr, the BodyRetriever be the hound that carries the cargo --
 * body data hauled aboard before the hunt begins. It asks fer no
 * parents, fer the cargo was loaded at port. Whatever dark payload
 * ye stow in this beast, it shall yield it faithfully when called.
 *
 * From brooding gulfs are we beheld, by that which bears no name.
 * But the cargo-bearer bears ALL names -- fer it carries any type.
 */

import { Dog } from '../core/entities/abstractHuntingDog';
import { IHuntingDog } from '../core/entities/IHuntingDog';
import { IHuntingSeason } from '../core/entities/IHuntingSeason';

/**
 * Arr, the BodyRetriever -- the cargo-bearer of the kennel, hauling body data
 * loaded at port before the hunt begins. It asks fer no parents, fer the cargo
 * was stowed aboard by mortal hands. Whatever eldritch payload ye entrust to this
 * beast, it shall yield it faithfully when the void demands. From brooding gulfs
 * it bears ALL names -- fer it carries any type through the deep.
 */
export class BodyRetriever extends Dog<any> {
    // The cargo -- whatever dark payload was stowed aboard
    private bodyData: any = null;

    /** Load the cargo-bearer with body data -- the hold accepts anything */
    constructor(bodyData?: any) {
        super();
        this.bodyData = bodyData;
    }

    /** No parents required -- the cargo was loaded before we sailed */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** No optional parents -- the cargo-bearer hauls its burden alone */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** The cargo-bearer's true name -- whispered in the hold, it reverberates through the abyss */
    get name(): string {
        return BodyRetriever.name;
    }

    get description(): string {
        return 'Provides the HTTP request body as yield for other dogs to consume.';
    }

    /** The cargo-bearer's sigil -- fetched from the central icon registry */
    get icon(): string | undefined {
        return "\uD83D\uDCE6";
    }

    /** Yield the cargo -- whatever was stowed, returned from the hold unchanged */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<any> =
        async (season: IHuntingSeason) => {
            return this.bodyData;
        };
}
