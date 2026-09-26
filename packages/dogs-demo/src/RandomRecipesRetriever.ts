/**
 * ============================================================
 *  RANDOM RECIPES RETRIEVER -- PLUNDER FROM THE ABYSSAL GALLEY
 * ============================================================
 * Arr, this be the first hound to sail into the deep, matey.
 * It fetches a random recipe from the cursed DummyJSON seas --
 * a morsel of data dragged from beneath the waves where
 * corporeal laws are unwritten, as suns and love retreat.
 * Many a vessel in this fleet depends upon what this retriever
 * hauls back from the void.
 *
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * ============================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";

/**
 * Arr, the shape of the data plundered from the recipe abyss, matey.
 * Each field be a tentacle of the eldritch meal -- from calories
 * that burn like blackened stars, to instructions whispered
 * by carrion hordes in profane accord with eldritch plans.
 */
export interface MockData {

    /** The caloric fire per serving -- in luminous space these numbers gaze and accuse */
    caloriesPerServing: number,
    /** Minutes lost to the void while cookin' */
    cookTimeMinutes:number,
    /** The cursed nation from whence this dish crawled */
    cuisine: string,
    /** How deep into madness ye must go to prepare it */
    difficulty:string
    /** A vision of the dish, pulled from tangent planes */
    image:string
    /** The ingredients -- each one an offering to the nameless deep */
    ingredients:string[],
    /** Instructions -- eldritch steps that to cosmic madness laws submit */
    instructions :string[],
    /** When this abomination is meant to be consumed */
    mealType :string[],
    /** The true name of the dish, spoken it summons hunger from the abyss */
    name :string
    /** Minutes of preparation -- time unravels as suns retreat */
    prepTimeMinutes: number
    /** The crew's rating -- through endless faces, countless forms, a multitude unfolds */
    rating: number
    /** How many souls have gazed upon this dish and lived to tell */
    reviewCount: number
    /** How many of the crew it feeds before the void takes the rest */
    servings:number
    /** Tags -- sigils branded upon the dish by those who sailed before us */
    tags:string[]
}

/**
 * Arr, the RandomRecipesRetriever -- the first hound to sail into the abyss,
 * plunderin' a random recipe from the cursed DummyJSON seas. Many a vessel in
 * this damned fleet depends upon what this retriever hauls back from the void.
 * From brooding gulfs it drags forth eldritch MockData -- carrion hordes trill
 * their profane accord as the recipe surfaces from the deep.
 */
export class RandomRecipesRetriever extends Dog<MockData>{

    /** Arr, no required crew -- this hound sails first and alone into the abyss */
    get required(){
        return []
    }

    /** No optional souls chained to this voyage, matey */
    get optional(){
        return []
    }

    /**
     * Arr, the yield collector -- it anchors to the season and drags
     * forth the request from the roiling deep below.
     */
    protected yieldCollectorFactory: (season:IHuntingSeason) => Promise<MockData> = (season:IHuntingSeason) => {
        return this.request(season)
    }

    /**
     * Arr, we cast our net into the DummyJSON seas and plunder a random recipe!
     * The abyss returns all recipes, but we choose one at random --
     * for in madness there be no order, only the cruel dice of the void.
     * Roiling, moaning, this realm of ours, in madness lost shall die.
     * @param season - The hunting season, though this first hound needs no prior plunder from the deep
     * @returns A single MockData recipe dragged at random from the eldritch galley of the abyss
     */
    public async request(season: IHuntingSeason): Promise<MockData> {
      const response = await fetch("https://dummyjson.com/recipes");
      const all = await response.json() as { recipes: MockData[] };
      const random = all.recipes[Math.floor(Math.random() * all.recipes.length)];
      return random;
    }

    /** The name of this retriever -- from brooding gulfs are we beheld */
    get name(){
        return RandomRecipesRetriever.name
    }

    get description(): string {
        return 'Generates random mock recipe data for demo purposes.';
    }

    /** The icon -- a sigil to mark this hound, lest the crew forget which beast they summoned */
    get icon(): string | undefined {
        return "\uD83C\uDF73";
    }

}
