/**
 * =========================================================================
 *  SPACE API CLIENT — reaching into the orbital void
 * =========================================================================
 *
 *  Arr, this module speaks with the Open Notify API for ISS tracking
 *  and Le Systeme Solaire for planetary data. Two free APIs,
 *  no keys required — the void provides freely.
 *
 *  Endpoints:
 *    - http://api.open-notify.org/iss-now.json
 *    - http://api.open-notify.org/astros.json
 *    - https://api.le-systeme-solaire.net/rest/bodies/BODY
 *    - https://api.le-systeme-solaire.net/rest/bodies?filter[]=isPlanet,eq,true&data=...
 * =========================================================================
 */

import type { IssData, PlanetSummary, BodyData, SpaceResult } from "./interfaces/spaceTypes";

const ISS_POSITION_URL = "http://api.open-notify.org/iss-now.json";
const ISS_PEOPLE_URL = "http://api.open-notify.org/astros.json";
const SOLAR_BODY_URL = "https://api.le-systeme-solaire.net/rest/bodies";

interface IssPositionResponse {
    iss_position: { latitude: string; longitude: string };
    timestamp: number;
}

interface AstrosResponse {
    number: number;
    people: Array<{ name: string; craft: string }>;
}

interface SolarBodyResponse {
    englishName: string;
    isPlanet: boolean;
    gravity: number;
    meanRadius: number;
    sideralOrbit: number;
    discoveredBy: string;
    moons: Array<unknown> | null;
    avgTemp: number;
}

interface SolarBodiesResponse {
    bodies: Array<{
        englishName: string;
        gravity: number;
        meanRadius: number;
        sideralOrbit: number;
        discoveredBy: string;
    }>;
}

/**
 * Fetch ISS position and crew data.
 * Returns null if both APIs are unreachable.
 */
async function fetchIss(): Promise<IssData | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const [posRes, crewRes] = await Promise.all([
            fetch(ISS_POSITION_URL, {
                headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
                signal: controller.signal,
            }),
            fetch(ISS_PEOPLE_URL, {
                headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
                signal: controller.signal,
            }),
        ]);

        if (!posRes.ok) {
            throw new Error(`ISS position API failed: ${posRes.status}`);
        }

        const posData = await posRes.json() as IssPositionResponse;
        let crew: Array<{ name: string; craft: string }> = [];
        let crewCount = 0;

        if (crewRes.ok) {
            const crewData = await crewRes.json() as AstrosResponse;
            crew = crewData.people;
            crewCount = crewData.number;
        }

        return {
            lat: parseFloat(posData.iss_position.latitude),
            lng: parseFloat(posData.iss_position.longitude),
            timestamp: posData.timestamp,
            crew,
            crewCount,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch a specific solar system body by name.
 */
async function fetchBody(bodyName: string): Promise<BodyData> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const url = `${SOLAR_BODY_URL}/${encodeURIComponent(bodyName.toLowerCase())}`;
        const res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Solar system body API failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
        }

        const data = await res.json() as SolarBodyResponse;

        return {
            name: data.englishName,
            isPlanet: data.isPlanet,
            gravity: data.gravity,
            radiusKm: data.meanRadius,
            orbitDays: data.sideralOrbit,
            discoveredBy: data.discoveredBy || "Unknown",
            moons: data.moons ? data.moons.length : 0,
            avgTemp: data.avgTemp,
        };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch an overview of all planets in the solar system.
 */
async function fetchPlanetsOverview(): Promise<{ planets: PlanetSummary[] }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
        const url = `${SOLAR_BODY_URL}?filter[]=isPlanet,eq,true&data=englishName,gravity,meanRadius,sideralOrbit,discoveredBy`;
        const res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`Solar system bodies API failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
        }

        const data = await res.json() as SolarBodiesResponse;

        const planets: PlanetSummary[] = data.bodies.map(b => ({
            name: b.englishName,
            gravity: b.gravity,
            radiusKm: b.meanRadius,
            orbitDays: b.sideralOrbit,
        }));

        return { planets };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Fetch space data: ISS position + crew, and either a specific body or planets overview.
 */
export async function getSpace(bodyName?: string): Promise<SpaceResult> {
    const result: SpaceResult = { iss: null };

    // Fetch ISS data — always attempt
    try {
        result.iss = await fetchIss();
    } catch {
        result.iss = null;
    }

    // Fetch solar system data based on body param
    if (bodyName) {
        try {
            result.body = await fetchBody(bodyName);
        } catch {
            // Solar system API is down — still return ISS data
        }
    } else {
        try {
            result.solarSystem = await fetchPlanetsOverview();
        } catch {
            // Solar system API is down — still return ISS data
        }
    }

    return result;
}
