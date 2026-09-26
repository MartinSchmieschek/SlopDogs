/**
 * =========================================================================
 *  BLOODHOUND ROUTE RETRIEVER — chartin' a course through the void
 * =========================================================================
 *
 *  Geo-Pakt: Inputs als Objekt (start/end/+waypoints), Outputs als
 *  GeoPoint mit lat/lng (niemals als [lat,lng]-Tuple).
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketCenter, GEO_CACHE_TTL_OSM_MS } from "@slopdogs/core";
import type { GeoPoint } from "@slopdogs/geo-pact";
import { calculateRoute, processRouteResponse } from "./routeCalculator";
import type { BloodhoundRouteResult, RouteSegment } from "./interfaces/bloodhoundTypes";
import { BloodhoundRouteQueryPact, BloodhoundProfile, DEFAULT_BLOODHOUND_PROFILE, type BloodhoundRouteQuery, type BloodhoundPoint } from "./pacts";

/**
 * Arr, the BloodhoundRouteRetriever — verlangt einen Routen-Pakt mit
 * `start`, `end` und optionalen `waypoints` und liefert eine Route mit
 * GeoPoint-basierten Wegpunkten.
 */
export class BloodhoundRouteRetriever extends Dog<BloodhoundRouteResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    constructor() {
        super();
        if (!process.env.ORS_API_KEYS?.trim()) {
            throw new Error('BloodhoundRouteRetriever: ORS_API_KEYS not set. Get a free key at https://openrouteservice.org/dev/#/signup');
        }
    }

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return BloodhoundRouteRetriever.name;
    }

    get description(): string {
        return 'Calculates a walking/driving route between two coordinates via OpenRouteService.';
    }

    get icon(): string | undefined {
        return "\uD83D\uDDFA\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BloodhoundRouteQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    getVmContextContributions(): Record<string, any> {
        return {
            BloodhoundProfile,
            DEFAULT_BLOODHOUND_PROFILE,
        };
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundRouteResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BloodhoundRouteQueryPact, d));
        const query = (queryDog?.collected as BloodhoundRouteQuery | undefined);

        if (!query?.start || !query?.end) {
            throw new Error('BloodhoundRouteRetriever: Missing start or end in route pact');
        }

        const start = parsePoint(query.start, 'start');
        const end = parsePoint(query.end, 'end');
        const waypoints: GeoPoint[] = (query.waypoints ?? []).map((wp, i) => parsePoint(wp, `waypoints[${i}]`));
        const profile = query.profile || DEFAULT_BLOODHOUND_PROFILE;

        // Beide Endpunkte auf ein feines Grid (~100 m) snappen, damit GPS-Jitter nicht
        // jede Anfrage als Miss behandelt.
        const startBucket = geoBucketCenter(start.lat, start.lng, 100);
        const endBucket = geoBucketCenter(end.lat, end.lng, 100);
        const wpKey = waypoints
            .map(wp => {
                const b = geoBucketCenter(wp.lat, wp.lng, 100);
                return `${b.lat.toFixed(6)},${b.lng.toFixed(6)}`;
            })
            .join('|');
        const key = `route:${profile}:${startBucket.lat.toFixed(6)}:${startBucket.lng.toFixed(6)}:${endBucket.lat.toFixed(6)}:${endBucket.lng.toFixed(6)}${wpKey ? ':wp:' + wpKey : ''}`;

        const fetchRoute = async (): Promise<BloodhoundRouteResult> => {
            const points: GeoPoint[] = [start, ...waypoints, end];
            const response = await calculateRoute(points, profile);
            const rawCoords = response.features[0].geometry.coordinates;
            const coordinates: GeoPoint[] = rawCoords.map(c => ({ lat: c[1], lng: c[0] }));
            const travelSteps = processRouteResponse(response);

            let cumulativeKm = 0;
            let cumulativeMinutes = 0;
            const segments: RouteSegment[] = travelSteps.map(step => {
                cumulativeKm += step.lengthInKm;
                cumulativeMinutes += step.travelDurationInMinutes;
                return {
                    traveldKm: cumulativeKm,
                    time: cumulativeMinutes,
                    points: [step.startPoint, step.endPoint]
                };
            });

            return { coordinates, segments, travelSteps };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchRoute);
        }
        return fetchRoute();
    };
}

function parsePoint(p: BloodhoundPoint, label: string): GeoPoint {
    const lat = parseFloat(p.lat);
    const lng = parseFloat(p.lng);
    if (!isFinite(lat) || !isFinite(lng)) {
        throw new Error(`BloodhoundRouteRetriever: ${label} hat ungueltige lat/lng (got: ${JSON.stringify(p)})`);
    }
    return { lat, lng };
}
