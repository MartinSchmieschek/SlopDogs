/**
 * =========================================================================
 *  WEBCAM RETRIEVER — sniffin' out the all-seeing eyes of the void
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates to find
 *  live webcams scattered across the mortal plane, summoning
 *  their feeds from the eldritch depths of Windy.
 *
 *  City cams, landscape views, traffic feeds — all manner of
 *  watching-eyes dredged from the surveillance void, each one
 *  a window into the world beyond the abyss.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { fetchNearbyWebcams } from "./webcamApiClient";
import type { WebcamResult } from "./interfaces/webcamTypes";
import { WebcamQueryPact, type WebcamQuery } from "./pacts";

/**
 * Arr, the WebcamRetriever — a spectral hound that sniffs out
 * live webcam feeds near given GPS coordinates!
 * City views, landscapes, traffic cams —
 * all plunder dredged from the Windy abyss.
 */
export class WebcamRetriever extends Dog<WebcamResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    constructor() {
        super();
        if (!process.env.WINDY_API_KEY?.trim()) {
            throw new Error('WebcamRetriever: WINDY_API_KEY not set. Get one at https://api.windy.com/keys');
        }
    }

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return WebcamRetriever.name;
    }

    get description(): string {
        return 'Fetches live webcams near given GPS coordinates from Windy. Requires API key: WINDY_API_KEY (free at api.windy.com).';
    }

    get icon(): string | undefined {
        return "\uD83D\uDCF7";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WebcamQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WebcamResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WebcamQueryPact, d));
        const query = (queryDog?.collected as WebcamQuery | undefined) ?? ({} as WebcamQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const radiusKm = parseInt(query['radius'] ?? '50', 10);
        const limit = parseInt(query['limit'] ?? '10', 10);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('WebcamRetriever: Missing required query params (lat, lng)');
        }

        const key = geoBucketKey("webcams", lat, lng, radiusKm * 1000, {
            extras: { limit },
        });

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 10 * 60_000, async () => {
                const webcams = await fetchNearbyWebcams(lat, lng, radiusKm, limit);
                return {
                    webcams,
                    totalFound: webcams.length,
                    searchLocation: { lat, lng },
                    radiusKm,
                };
            });
        }

        const webcams = await fetchNearbyWebcams(lat, lng, radiusKm, limit);
        return {
            webcams,
            totalFound: webcams.length,
            searchLocation: { lat, lng },
            radiusKm,
        };
    };
}
