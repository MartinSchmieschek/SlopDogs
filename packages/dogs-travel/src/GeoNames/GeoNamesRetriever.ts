import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { GeoPointPact, type GeoPoint } from "@slopdogs/geo-pact";
import { getNearbyPlaces } from "./geoNamesApiClient";
import type { GeoNamesResult } from "./interfaces/geoNamesTypes";

const GEONAMES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class GeoNamesRetriever extends Dog<GeoNamesResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return GeoNamesRetriever.name;
    }

    get description(): string {
        return "GeoNames findNearby: Orte, Bevoelkerung, Admin-Namen zu Lat/Lng (benoetigt GEONAMES_USERNAME, sonst 'demo').";
    }

    get icon(): string | undefined {
        return "\uD83C\uDFD9\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [GeoPointPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GeoNamesResult> => {
        const pointDog = season.exhausted.find(d => this.matchesParent(GeoPointPact, d));
        const point = pointDog?.collected as GeoPoint | undefined;
        if (!point || typeof point.lat !== "number" || typeof point.lng !== "number") {
            throw new Error("GeoNamesRetriever: GeoPoint with valid lat/lng required");
        }
        const radiusKm = 10;
        const key = geoBucketKey("geonames", point.lat, point.lng, 2000, { extras: { radiusKm: String(radiusKm) } });
        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GEONAMES_CACHE_TTL_MS, () =>
                getNearbyPlaces(point.lat, point.lng, radiusKm),
            );
        }
        return getNearbyPlaces(point.lat, point.lng, radiusKm);
    };
}
