import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketCenter } from "@slopdogs/core";
import { ElevationQueryPact, type ElevationQuery, type ElevationResult, type ElevationPoint } from "./pacts";

export type { ElevationResult, ElevationPoint };

export class ElevationRetriever extends Dog<ElevationResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ElevationRetriever.name;
    }

    get description(): string {
        return "Fetches elevation (meters above sea level) for one or many GPS coordinates via the Open-Meteo Elevation API. Pass comma-separated lat/lng for multiple points.";
    }

    get icon(): string | undefined {
        return "\u26F0\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ElevationQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ElevationResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ElevationQueryPact, d));
        const query = (queryDog?.collected as ElevationQuery | undefined) ?? ({} as ElevationQuery);

        const lats = query.lat.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        const lngs = query.lng.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

        if (lats.length === 0 || lngs.length === 0 || lats.length !== lngs.length) {
            throw new Error("ElevationRetriever: lat and lng must have the same number of comma-separated values");
        }

        // Snap each point to a 100 m grid so GPS jitter shares cache entries.
        const snapped = lats.map((lat, i) => geoBucketCenter(lat, lngs[i], 100, 100));
        const key = `elevation:${snapped
            .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
            .join(';')}`;

        const fetchElevations = async (): Promise<ElevationResult> => {
            const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`ElevationRetriever: Open-Meteo HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as { elevation?: number[] };
            const elevations = data.elevation ?? [];

            const points: ElevationPoint[] = lats.map((lat, i) => ({
                lat,
                lng: lngs[i],
                elevation: elevations[i] ?? 0,
            }));

            return { points };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 24 * 60 * 60_000, fetchElevations);
        }
        return fetchElevations();
    };
}
