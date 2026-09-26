/**
 * =========================================================================
 *  BIRD RETRIEVER — sniffin' out feathered souls from the avian abyss
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  skies, summoning recent bird observations and rare sightings
 *  from the eldritch depths of eBird.
 *
 *  Each observation reveals a species — warblers, raptors, and
 *  songbirds bound to their territories, each one a whisper
 *  from the ornithological void.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { getBirds } from "./birdApiClient";
import type { BirdResult } from "./interfaces/birdTypes";
import { BirdQueryPact, type BirdQuery } from "./pacts";

/**
 * Arr, the BirdRetriever — a spectral hound that sniffs out
 * avian life near given GPS coordinates!
 * Recent sightings, rare visitors, species counts —
 * all plunder dredged from the eBird abyss.
 */
export class BirdRetriever extends Dog<BirdResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    constructor() {
        super();
        if (!process.env.EBIRD_API_KEY?.trim()) {
            throw new Error('BirdRetriever: EBIRD_API_KEY not set. Get a free key at https://ebird.org/api/keygen');
        }
    }

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return BirdRetriever.name;
    }

    get description(): string {
        return 'Fetches recent bird observations from eBird for given GPS coordinates. Requires API key: EBIRD_API_KEY (free at ebird.org/api/keygen).';
    }

    get icon(): string | undefined {
        return "\uD83E\uDD86";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BirdQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BirdResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BirdQueryPact, d));
        const query = (queryDog?.collected as BirdQuery | undefined) ?? ({} as BirdQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const radiusKm = parseInt(query['radius'] ?? '25', 10);
        const back = parseInt(query['back'] ?? '14', 10);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('BirdRetriever: Missing required query params (lat, lng)');
        }

        const key = geoBucketKey("birds", lat, lng, radiusKm * 1000, {
            extras: { back },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 15 * 60_000, () =>
                getBirds(lat, lng, radiusKm, back)
            );
        }
        return getBirds(lat, lng, radiusKm, back);
    };
}
