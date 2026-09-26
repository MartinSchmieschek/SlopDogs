/**
 * ============================================================
 *  COUNTRY FLAG BLACK LAB -- BANNER OF THE DROWNED NATIONS
 * ============================================================
 * Arr, this here vessel bears the flag of lands long swallowed
 * by the deep. Its heralds are the stars it fells, the sky and
 * Earth aflame. We plunder the cuisine of each cursed nation
 * and hoist its colours upon our mast, though the void watches
 * with a thousand lidless eyes.
 *
 * In luminous space blackened stars, they gaze, accuse, deny.
 * ============================================================
 */

import { Dog, IHuntingSeason } from "@slopdogs/core";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

/**
 * Arr, the CountryFlagBlackLab -- a cursed hound that plunders the banners
 * of drowned nations from brooding gulfs beneath the sea. Through endless faces,
 * countless forms, it fetches the flag image for whatever eldritch cuisine
 * the recipe retriever dragged up from the void. Corporeal laws unwritten,
 * this beast extends the Dog of the deep and yields a URL to the nation's colours.
 */
export class CountryFlagBlackLab extends Dog<string>{

    /** Arr, the crew this vessel demands before she sails -- the recipe retriever from the abyss */
    get required() {
        return [RandomRecipesRetriever]
    }

    /** No optional souls bound to this cursed voyage, matey */
    get optional() {
        return []
    }

    /** The true name of this eldritch hound, whispered in tongues no mortal should speak */
    get name(): string {
        return CountryFlagBlackLab.name
    }

    get description(): string {
        return 'Generates a placeholder image URL for the cuisine of a random recipe.';
    }

    /** The icon -- a sigil pulled from the deep, corporeal laws unwritten as suns retreat */
    get icon(): string | undefined {
        return "\uD83C\uDF0D";
    }

    /**
     * Arr, the yield collector -- it reaches into the exhausted remains of prior hunts,
     * plundering the cuisine like carrion hordes trilling their profane accord.
     * If the abyss yields nothing, we cast an error into the roiling madness.
     */
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<string> = (season:IHuntingSeason) => {
        let currentYield = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (currentYield && currentYield.collected && !(currentYield.collected instanceof Error))
            return this.fetchImages([currentYield.collected.cuisine])
        else
            throw new Error("No yield prequisites to build on.")
    }


    /**
     * Arr, we sail the digital seas to fetch images from the deep.
     * To cosmic forms from tangent planes, we end as we began --
     * a simple URL forged in the abyss, bearing the queries of the damned crew.
     * @param queries - Arr, the search terms plundered from the void, each a whisper from the eldritch deep
     * @returns A URL forged in the abyss, bearing the queries of the damned crew stitched together
     */
public async fetchImages(
    queries: string[],
  ): Promise<string> {

    return 'https://dummyjson.com/image/400x200/008080/ffffff?text=' + queries.join("+")

    }
}
