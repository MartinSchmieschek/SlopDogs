import { createPact } from "@slopdogs/core";

export interface AirportQuery {
    /** IATA-Code (3 Buchstaben, z.B. "FRA", "JFK") */
    iata?: string;
    /** ICAO-Code (4 Buchstaben, z.B. "EDDF", "KJFK") */
    icao?: string;
}

export const AirportQueryPact = createPact<AirportQuery>(
    "AirportQueryProvider",
    { fromSourceType: "AirportQuery" }
);
