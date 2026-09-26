/**
 * =========================================================================
 *  ROUTE CALCULATOR — navigatin' the eldritch seas of OpenRouteService
 * =========================================================================
 */

import type { OpenRouteServiceResponse, IsochroneResponse } from "./interfaces/openRouteServiceResponse";
import type { TravelStepJson } from "./interfaces/bloodhoundTypes";
import type { GeoPoint } from "@slopdogs/geo-pact";

const apiKeys: string[] = process.env.ORS_API_KEYS?.split(',') || [];
let currentApiKeyIndex = 0;

function getApiKey(): string {
    const apiKey = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
    return apiKey;
}

/**
 * Chart a route across n Wegpunkte (mind. start + end). Optionale Zwischenpunkte
 * werden als ORS-coordinates uebergeben (lng/lat im Body — die ORS-Konvention,
 * intern aber immer als GeoPoint mit lat/lng modelliert).
 */
export async function calculateRoute(
    points: GeoPoint[],
    profile: string,
    retry?: boolean
): Promise<OpenRouteServiceResponse> {
    if (points.length < 2) {
        throw new Error("calculateRoute: needs at least start + end (>= 2 points)");
    }
    const apiKey = getApiKey();

    const body = {
        coordinates: points.map(p => [p.lng, p.lat]),
    };

    try {
        const response = await fetch(
            `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
            {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as OpenRouteServiceResponse;
    } catch (error) {
        if (!retry) {
            console.log("Too many requests for Route, using different API key.");
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            return calculateRoute(points, profile, true);
        }
        throw error;
    }
}

/**
 * Summon an isochrone from the roiling depths — POST in den Abyss.
 */
export async function calculateIsochrone(
    lat: number, lng: number,
    profile: string,
    range: number,
    retry?: boolean
): Promise<IsochroneResponse> {
    const apiKey = getApiKey();

    try {
        const response = await fetch(
            `https://api.openrouteservice.org/v2/isochrones/${profile}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    locations: [[lng, lat]],
                    range: [range]
                })
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as IsochroneResponse;
    } catch (error) {
        if (!retry) {
            console.log("Too many requests for Isochrone, using different API key.");
            return calculateIsochrone(lat, lng, profile, range, true);
        }
        throw error;
    }
}

/**
 * Verarbeite die rohe ORS-Antwort zu einer flachen TravelStep-Liste.
 * Tauscht das ORS-eigene [lng,lat] gegen unsere GeoPoint-Form mit lat/lng.
 */
export function processRouteResponse(response: OpenRouteServiceResponse): TravelStepJson[] {
    const travelSteps: TravelStepJson[] = [];
    const coords = response.features[0].geometry.coordinates;
    const segments = response.features[0].properties.segments;

    segments.forEach(segment => {
        for (const step of segment.steps) {
            const startCoord = coords[step.way_points[0]];
            const endCoord = coords[step.way_points[step.way_points.length - 1]];
            travelSteps.push({
                startPoint: { lat: startCoord[1], lng: startCoord[0] },
                endPoint: { lat: endCoord[1], lng: endCoord[0] },
                lengthInKm: step.distance / 1000,
                travelDurationInMinutes: step.duration / 60,
                instruction: step.instruction,
            });
        }
    });

    return travelSteps;
}
