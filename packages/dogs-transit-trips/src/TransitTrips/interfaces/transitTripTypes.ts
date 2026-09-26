/**
 * =========================================================================
 *  TRANSIT TRIP TYPES — journey-forms dredged from the railway void
 * =========================================================================
 */

/** A single stop along a transit trip */
export interface TripStop {
    /** Name of the station */
    name: string;
    /** Station identifier */
    stopId: string;
    /** Latitude */
    lat: number;
    /** Longitude */
    lng: number;
    /** Arrival time (ISO datetime, null for first stop) */
    arrival: string | null;
    /** Departure time (ISO datetime, null for last stop) */
    departure: string | null;
    /** Scheduled arrival (ISO datetime) */
    scheduledArrival: string | null;
    /** Scheduled departure (ISO datetime) */
    scheduledDeparture: string | null;
}

/** A complete transit trip — the full route from origin to destination */
export interface TransitTrip {
    /** MOTIS trip identifier */
    tripId: string;
    /** Line name (e.g. "U4", "S1", "N4", "Bus 36") */
    lineName: string;
    /** Direction / headsign (final destination) */
    headsign: string;
    /** Transport mode (e.g. "BUS", "TRAM", "SUBWAY", "RAIL") */
    mode: string;
    /** Operator / agency name */
    agencyName: string | null;
    /** ALL stops along the route, ordered from origin to destination */
    stops: TripStop[];
    /** Name of the first stop */
    origin: string;
    /** Name of the last stop */
    destination: string;
    /** Total number of stops */
    stopCount: number;
}

/** The full yield of the TransitTripRetriever */
export interface TransitTripResult {
    /** Complete trips from all nearby stations, deduplicated by line+direction */
    trips: TransitTrip[];
    /** Total number of unique trips/routes found */
    totalTrips: number;
    /** Total number of unique stops across all trips */
    totalStops: number;
    /** GPS center of the search */
    searchLocation: { lat: number; lng: number };
    /** Line filter applied (null if none) */
    searchLine: string | null;
}
