/**
 * =========================================================================
 *  HISTORICAL WEATHER PACTS — accords with the archive void
 * =========================================================================
 */

import { createPact } from "@slopdogs/core";

/** GPS coordinates and optional date range for historical weather query */
export interface HistoricalWeatherQuery {
    /** Latitude */
    lat: string;
    /** Longitude */
    lng: string;
    /** Start date (ISO format YYYY-MM-DD), defaults to 7 days before end_date */
    start_date?: string;
    /** End date (ISO format YYYY-MM-DD), defaults to yesterday */
    end_date?: string;
}

/** The Pact for HistoricalWeather queries */
export const HistoricalWeatherQueryPact = createPact<HistoricalWeatherQuery>(
    "HistoricalWeatherQueryProvider",
    { fromSourceType: "HistoricalWeatherQuery" }
);
