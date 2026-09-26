/**
 * =========================================================================
 *  SPACE RETRIEVER — gazing into the orbital void
 * =========================================================================
 *
 *  Arr, matey! This hound tracks the ISS across the sky and charts
 *  the planets of the solar system — position, crew, gravity, orbits —
 *  all plucked from the cosmic void.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@slopdogs/core";
import { getSpace } from "./spaceApiClient";
import type { SpaceResult } from "./interfaces/spaceTypes";
import { SpaceQueryPact, type SpaceQuery } from "./pacts";

/**
 * Arr, the SpaceRetriever — a spectral hound that tracks the ISS
 * and charts the solar system from the cosmic void!
 */
export class SpaceRetriever extends Dog<SpaceResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return SpaceRetriever.name;
    }

    get description(): string {
        return 'Fetches ISS position and crew data, plus solar system body or planets overview.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDE80";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [SpaceQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<SpaceResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(SpaceQueryPact, d));
        const query = (queryDog?.collected as SpaceQuery | undefined) ?? ({} as SpaceQuery);

        const bodyName = query['body'];
        const key = `space:${(bodyName ?? 'overview').toLowerCase().trim()}`;

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60_000, () =>
                getSpace(bodyName)
            );
        }
        return getSpace(bodyName);
    };
}
