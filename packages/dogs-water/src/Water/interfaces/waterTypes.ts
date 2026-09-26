/**
 * =========================================================================
 *  WATER TYPES — marine echoes dredged from the coastal void
 * =========================================================================
 */

/** Current marine conditions */
export interface WaterCurrent {
    /** Wave height in meters */
    waveHeight: number;
    /** Wave direction in degrees */
    waveDirection: number;
    /** Wave period in seconds */
    wavePeriod: number;
    /** Ocean current velocity in m/s */
    currentVelocity: number;
    /** Ocean current direction in degrees */
    currentDirection: number;
}

/** Hourly marine forecast entry */
export interface WaterHourlyEntry {
    /** Time (ISO string) */
    time: string;
    /** Wave height in meters */
    waveHeight: number;
    /** Wave direction in degrees */
    waveDirection: number;
    /** Wave period in seconds */
    wavePeriod: number;
    /** Ocean current velocity in m/s */
    currentVelocity: number;
    /** Ocean current direction in degrees */
    currentDirection: number;
    /** Sea water temperature in Celsius */
    waterTemperature: number;
}

/** Full water/marine result */
export interface WaterResult {
    /** Current conditions (null if inland location) */
    current: WaterCurrent | null;
    /** Hourly forecast */
    hourly: WaterHourlyEntry[];
    /** Error message if location has no marine data */
    error?: string;
}
