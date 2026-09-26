/**
 * =========================================================================
 *  SPECIES RETRIEVER — sniffin' out life-forms from the naturalist abyss
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  wilds, summoning species observations from the eldritch depths
 *  of iNaturalist.
 *
 *  Mammals, birds, insects, plants, fungi — all manner of life
 *  dredged from the taxonomic void, each one a thread in the
 *  web of biodiversity that the mortals so cherish.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { getSpecies } from "./biodiversityApiClient";
import type { BiodiversityResult } from "./interfaces/biodiversityTypes";
import { BiodiversityQueryPact, type BiodiversityQuery } from "./pacts";

/**
 * Arr, the SpeciesRetriever — a spectral hound that sniffs out
 * living creatures and flora near given GPS coordinates!
 * Mammals, birds, insects, plants, fungi —
 * all plunder dredged from the iNaturalist abyss.
 */
export class SpeciesRetriever extends Dog<BiodiversityResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return SpeciesRetriever.name;
    }

    get description(): string {
        return 'Fetches species observations from iNaturalist for given GPS coordinates. No API key required.';
    }

    get icon(): string | undefined {
        return "\uD83E\uDD8E";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BiodiversityQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BiodiversityResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BiodiversityQueryPact, d));
        const query = (queryDog?.collected as BiodiversityQuery | undefined) ?? ({} as BiodiversityQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const radiusKm = parseInt(query['radius'] ?? '10', 10);
        const taxon = query['taxon'] || undefined;
        const months = query['months'] || undefined;

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('SpeciesRetriever: Missing required query params (lat, lng)');
        }

        const key = geoBucketKey("species", lat, lng, radiusKm * 1000, {
            extras: { taxon: taxon ?? 'all', months: months ?? 'all' },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, () =>
                getSpecies(lat, lng, radiusKm, taxon, months)
            );
        }
        return getSpecies(lat, lng, radiusKm, taxon, months);
    };
}
