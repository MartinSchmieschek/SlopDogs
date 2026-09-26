/**
 * =========================================================================
 *  SEASON RETRIEVER — divining the temporal void's turning wheel
 * =========================================================================
 *
 *  Arr, matey! This hound reads latitude and date to divine the
 *  current season, daylight trend, and distance to the next
 *  solstice or equinox. No API calls — pure celestial calculation.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketCenter } from "@slopdogs/core";
import { calculateSeason } from "./seasonCalculator";
import type { SeasonResult } from "./interfaces/seasonTypes";
import { SeasonQueryPact, type SeasonQuery } from "./pacts";

/**
 * Arr, the SeasonRetriever — a spectral hound that divines the
 * current season, daylight hours, and celestial turning points
 * from latitude and date alone. No API required, matey.
 */
export class SeasonRetriever extends Dog<SeasonResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return SeasonRetriever.name;
    }

    get description(): string {
        return 'Calculates current season, daylight hours, and next solstice/equinox from latitude and date.';
    }

    get icon(): string | undefined {
        return "\uD83C\uDF43";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [SeasonQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<SeasonResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(SeasonQueryPact, d));
        const query = (queryDog?.collected as SeasonQuery | undefined) ?? ({} as SeasonQuery);

        const lat = parseFloat(query['lat']);

        if (isNaN(lat)) {
            throw new Error('SeasonRetriever: Missing required query param (lat)');
        }

        // Saison aendert sich erst auf grossen Breitenskalen — 100 km bucket reicht.
        const snapped = geoBucketCenter(lat, 0, 100_000, 100_000);
        const key = `season:${snapped.lat.toFixed(4)}:${query['date'] ?? 'today'}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, () =>
                Promise.resolve(calculateSeason(lat, query['date']))
            );
        }
        return calculateSeason(lat, query['date']);
    };
}
