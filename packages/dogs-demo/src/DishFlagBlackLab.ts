/**
 * ============================================================
 *  DISH FLAG BLACK LAB -- THE TATTERED BANNER OF FORSAKEN MEALS
 * ============================================================
 * Arr, this accursed hound fetches the flag of each dish,
 * a grim standard flown from the crosstrees of our doomed vessel.
 * Roiling, moaning, this realm of ours, in madness lost shall die --
 * yet still we anchor our hopes to the tags plundered from recipes
 * dragged up from the deep.
 *
 * Corporeal laws are unwritten, as suns and love retreat.
 * ============================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

/**
 * Arr, the DishFlagBlackLab -- a tattered hound that hoists the banner of
 * forsaken meals from the abyss. It plunders the tags of each recipe dragged
 * from the deep by the RandomRecipesRetriever and forges them into a flag image,
 * a grim sigil from brooding gulfs. Through endless faces countless forms,
 * the void yields its eldritch dish visage unto the crew.
 */
export class DishFlagBlackLab extends Dog<string>{

    /** Arr, the required crew -- the recipe retriever must sail with us into the void */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [RandomRecipesRetriever]
    }

    /** No optional souls chained to this vessel's keel, matey */
    get optional(): (new (...args: any[]) => Dog<unknown>)[] {
        return []
    }

    /** The name of this eldritch hound, spoken aloud it summons dread from brooding gulfs */
    get name(): string {
        return DishFlagBlackLab.name
    }

    get description(): string {
        return 'Generates a placeholder image URL from the tags of a random recipe.';
    }

    /** The icon -- a cursed glyph, for in luminous space blackened stars gaze upon us */
    get icon(): string | undefined {
        return "\uD83C\uDF7D\uFE0F";
    }

    /**
     * Arr, the yield collector plunders the tags from the exhausted remains
     * of the recipe hunt. Through endless faces, countless forms, a multitude
     * unfolds -- and if the abyss returns naught, we hurl an error into the deep.
     */
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<string> = (season:IHuntingSeason) => {
        let currentYield = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (currentYield && currentYield.collected && !(currentYield.collected instanceof Error))
            return this.fetchImages(currentYield.collected.tags)
        else
            throw new Error("No yield prequisites to build on.")
    }


    /**
     * Arr, we forge an image URL from the queries, matey.
     * Its heralds are the stars it fells -- each query a fallen star
     * stitched into the URL that the crew may gaze upon the dish's visage.
     * @param queries - The tag-sigils dragged from the deep, each one branded upon the dish by eldritch hands
     * @returns A URL from brooding gulfs, bearing the dish's tattered banner for all to witness
     */
public async fetchImages(
    queries: string[],
  ): Promise<string> {

    return 'https://dummyjson.com/image/400x200/008080/ffffff?text=' + queries.join("+")

    }
}
