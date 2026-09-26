/**
 * ============================================================
 *  RANDOM EVERYTHING RETRIEVER -- THE MAD PLUNDERER OF ALL SEAS
 * ============================================================
 * Arr, this vessel sails every cursed ocean at once, matey!
 * From the frozen waters of Ice and Fire to the kennel of
 * random dogs -- roiling, moaning, this realm of ours, in madness
 * lost shall die. We anchor at each API port and plunder what
 * we can before the nameless things in the deep drag us under.
 *
 * From brooding gulfs are we beheld, by that which bears no name.
 * ============================================================
 */

import { Dog, IHuntingSeason } from "@slopdogs/core";

/**
 * Arr, the RandomEveryThingRetriever -- a mad vessel that sails every cursed
 * ocean at once, plunderin' from multiple API endpoints in a single eldritch voyage.
 * From brooding gulfs are we beheld as this hound drags back characters from
 * Ice and Fire and random dog images from the void. Through endless faces countless
 * forms, it stuffs all plundered data into one accursed cargo hold for the crew.
 */
export class RandomEveryThingRetriever extends Dog<any> {

    /** Arr, no required crew -- this mad vessel needs no escort into the abyss */
    get required(){
        return []
    }

    /** No optional hands on deck, matey -- the void cares not for company */
    get optional() {
        return []
    }

    /**
     * Arr, the yield collector -- a simple anchor cast into the season's depths.
     * To cosmic madness laws submit, though stalwart minds entreat.
     */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<any> = (season: IHuntingSeason) => {
        return this.request(season)
    }

    /**
     * Arr, here we plunder multiple APIs in one fell voyage, matey!
     * We chart a map of cursed endpoints -- each one a portal to
     * tangent planes where eldritch data writhes and waits.
     * Through endless faces, countless forms, a multitude unfolds
     * as we iterate the map and harvest from the deep.
     * @param season - The hunting season, though this mad vessel needs naught from prior voyages into the abyss
     * @returns A cargo hold of plundered data from the void, its shape as formless as the eldritch deep itself
     */
    public async request(season: IHuntingSeason): Promise<any> {

        // Arr, the cargo hold for all plundered data from the void
        let all: any = {};

        // Chart the map of cursed API endpoints, matey
        let apis: Map<string, { url: string }> = new Map();

        // The Ice and Fire API -- characters from a realm where suns and love retreat
        apis.set("characters", {
            url: "https://anapioficeandfire.com/api/characters/" + Math.floor(Math.random() * 501)
        })

        // Random dog images -- even the hounds of the deep answer our call
        apis.set("woof", {
            url: "https://random.dog/woof.json"
        })

        // Arr, sail to each port and plunder what the abyss offers
        for await (const api of apis) {
            try {
                const reciepResponse = await fetch(api[1].url);
                const json = await reciepResponse.json()
                all[api[0]] = json

            } catch (e) {
                // Arr, the void swallowed our request -- log the horror but sail on, matey
                console.warn(e)
            }
        }

        return all;
    }

    /** The name of this eldritch retriever, whispered by carrion hordes in the deep */
    get name() {
        return RandomEveryThingRetriever.name
    }

    get description(): string {
        return 'Fetches random Ice and Fire characters and random dog images for demo purposes.';
    }

    /** The icon -- its heralds are the stars it fells, the sky and Earth aflame */
    get icon(): string | undefined {
        return "\uD83C\uDFB2";
    }

}
