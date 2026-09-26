/**
 * =========================================================================
 *  SPACE TYPES — orbital echoes drifting through the void
 * =========================================================================
 */

/** ISS position and crew data */
export interface IssData {
    /** Latitude of the ISS */
    lat: number;
    /** Longitude of the ISS */
    lng: number;
    /** Unix timestamp of the position reading */
    timestamp: number;
    /** Crew members currently aboard any craft */
    crew: Array<{ name: string; craft: string }>;
    /** Total number of people in space */
    crewCount: number;
}

/** Summary of a planet */
export interface PlanetSummary {
    /** English name of the planet */
    name: string;
    /** Surface gravity in m/s^2 */
    gravity: number;
    /** Mean radius in km */
    radiusKm: number;
    /** Sidereal orbital period in days */
    orbitDays: number;
}

/** Detailed data about a single solar system body */
export interface BodyData {
    /** English name */
    name: string;
    /** Whether it is classified as a planet */
    isPlanet: boolean;
    /** Surface gravity in m/s^2 */
    gravity: number;
    /** Mean radius in km */
    radiusKm: number;
    /** Sidereal orbital period in days */
    orbitDays: number;
    /** Who discovered this body */
    discoveredBy: string;
    /** Number of known moons */
    moons: number;
    /** Average temperature in Kelvin */
    avgTemp: number;
}

/** Full space result */
export interface SpaceResult {
    /** ISS data, null if ISS APIs are unreachable */
    iss: IssData | null;
    /** Planets overview (when no body param specified) */
    solarSystem?: { planets: PlanetSummary[] };
    /** Specific body data (when body param specified) */
    body?: BodyData;
}
