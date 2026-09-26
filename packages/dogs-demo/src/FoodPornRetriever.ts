/**
 * ============================================================
 *  FOOD PORN RETRIEVER -- VISIONS FROM THE ELDRITCH GALLEY
 * ============================================================
 * Arr, this cursed retriever scours the depths of YouTube's abyss
 * for movin' pictures of grub, matey. Carrion hordes trill their
 * profane accord with eldritch plans -- and so too does this hound
 * trill its queries into the void, hopin' the deep answers back
 * with somethin' other than madness.
 *
 * To cosmic madness laws submit, though stalwart minds entreat.
 * ============================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { RandomRecipesRetriever } from "./RandomRecipesRetriever";

/**
 * Arr, the FoodPornRetriever -- this eldritch hound scours the YouTube abyss
 * for movin' pictures of grub, matey. Carrion hordes trill their profane accord
 * as it plunders video search results from the deep. From brooding gulfs it calls
 * upon the YouTube API, forging queries from recipe names dragged out of the void.
 * Corporeal laws unwritten, the response it yields defies mortal comprehension.
 */
export class FoodPornRetriever extends Dog<unknown>{

    /** Arr, no required crew -- this vessel sails alone into the nameless dark */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return []
    }

    /** No optional hands on deck neither, matey -- the void needs no witnesses */
    get optional(): (new (...args: any[]) => Dog<unknown>)[] {
        return []
    }

    /** The name of this abyssal hound, from brooding gulfs are we beheld */
    get name(): string {
        return FoodPornRetriever.name
    }

    get description(): string {
        return 'Searches YouTube for cooking videos based on a recipe name from RandomRecipesRetriever.';
    }

    /**
     * Arr, the yield collector -- a thin anchor line cast into the season's exhausted depths.
     * It returns whatever horrors the request dredges up from the deep.
     */
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<unknown> = (season:IHuntingSeason) => {

            return this.request(season)

    }

    /**
     * Arr, we plunder the YouTube seas for visions of the dish, matey.
     * First we scavenge the recipe name from the exhausted remains of prior hunts,
     * then forge a search query and cast it into the roiling digital ocean.
     * If the abyss yields no dish, we throw an error --
     * for in luminous space blackened stars, they gaze, accuse, deny.
     * @param season - The hunting season, carryin' the exhausted remains of prior voyages into the void
     * @returns The eldritch YouTube search results hauled from the deep, their form unknowable
     */
    public async request(season:IHuntingSeason): Promise<unknown> {

        let theDish = season.exhausted.find(item => item instanceof RandomRecipesRetriever)
        if (theDish && theDish.collected && !(theDish.collected instanceof Error)){

            // Arr, assemble the search text -- the dish name and "fast", whispered like a void incantation
            let searchText = [theDish.collected.name, "fast"]

            // Forge the query string, matey -- corporeal laws are unwritten as we shape the URL
            let searchString = "q=" + searchText.join(" ")

            // Cast our net into the YouTube abyss -- may the eldritch API answer our call
            // The key comes from the environment (YOUTUBE_API_KEY), never from the code.
            const apiKey = process.env.YOUTUBE_API_KEY?.trim();
            if (!apiKey) throw new Error('FoodPornRetriever: YOUTUBE_API_KEY not set. Create a YouTube Data API v3 key in the Google Cloud Console.');
            let url = 'https://youtube.googleapis.com/youtube/v3/search?part=snippet&'+searchString+'&key='+encodeURIComponent(apiKey)
            const reciepResponse = await fetch(url)

            // Parse the response hauled from the deep -- to cosmic forms from tangent planes
            let result = await reciepResponse.json()
            return result;
        }

        // Arr, if no dish was found, the void swallows us whole
        else
            throw new Error("No yield prequisites to build on.")



    }

}
