/**
 * =========================================================================
 *  HISTORICAL WEATHER TYPES — echoes from the past void
 * =========================================================================
 */

/** Single day of historical weather data */
export interface HistoricalDayEntry {
    /** Date (ISO date string) */
    date: string;
    /** Maximum temperature in Celsius */
    tempMax: number;
    /** Minimum temperature in Celsius */
    tempMin: number;
    /** Mean temperature in Celsius */
    tempMean: number;
    /** Total precipitation in mm */
    precipitation: number;
    /** Total rain in mm */
    rain: number;
    /** Total snowfall in cm */
    snowfall: number;
    /** Maximum wind speed in km/h */
    windMax: number;
    /** Maximum wind gusts in km/h */
    gustMax: number;
    /** Sunshine duration in hours */
    sunshineHours: number;
}

/** Summary statistics across the period */
export interface HistoricalSummary {
    /** Average temperature across all days */
    avgTemp: number;
    /** Total precipitation across all days in mm */
    totalPrecipitation: number;
    /** Total sunshine hours across all days */
    totalSunshineHours: number;
    /** Date of the hottest day */
    hottestDay: string;
    /** Date of the coldest day */
    coldestDay: string;
}

/** Full historical weather result */
export interface HistoricalWeatherResult {
    /** Time period covered */
    period: {
        startDate: string;
        endDate: string;
    };
    /** Daily weather data */
    daily: HistoricalDayEntry[];
    /** Summary statistics */
    summary: HistoricalSummary;
}
