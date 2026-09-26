export interface AirportRecord {
    icao: string;
    iata?: string;
    name: string;
    city?: string;
    state?: string;
    country?: string;
    elevation?: number;
    lat?: number;
    lon?: number;
    tz?: string;
}

export interface AirportResult {
    queryType: "iata" | "icao";
    query: string;
    airport: AirportRecord;
}
