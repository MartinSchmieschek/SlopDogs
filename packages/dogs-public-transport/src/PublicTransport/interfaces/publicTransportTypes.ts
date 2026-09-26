/**
 * =========================================================================
 *  PUBLIC TRANSPORT TYPES — forms dredged from the transit abyss
 * =========================================================================
 */

/** Eine Haltestelle / Station in der Naehe */
export interface TransitStation {
    /** ID der Haltestelle (DELFI-ID) */
    id: string;
    /** Name der Haltestelle */
    name: string;
    /** Entfernung in Metern vom Suchpunkt */
    distance: number;
    /** Breitengrad */
    lat: number;
    /** Laengengrad */
    lng: number;
    /** Verfuegbare Verkehrsmittel (z.B. ["BUS", "TRAM", "SUBURBAN"]) */
    modes: string[];
}

/** Eine einzelne Abfahrt von einer Haltestelle */
export interface TransitDeparture {
    /** Linienname (z.B. "RE 1", "S3", "Bus 36", "U5") */
    line: string;
    /** Verkehrsmittel-Typ (z.B. "BUS", "TRAM", "SUBURBAN", "SUBWAY", "HIGHSPEED") */
    mode: string;
    /** Richtung / Zielort */
    direction: string;
    /** Geplante Abfahrtszeit (ISO string) */
    plannedWhen: string | null;
    /** Tatsaechliche Abfahrtszeit (ISO string) */
    when: string | null;
    /** Verspaetung in Minuten */
    delay: number | null;
    /** Gleis / Plattform */
    platform: string | null;
}

/** Ergebnis fuer eine Haltestelle mit ihren Abfahrten */
export interface TransitStationDepartures {
    /** Die Haltestelle selbst */
    station: TransitStation;
    /** Naechste Abfahrten von dieser Haltestelle */
    departures: TransitDeparture[];
}

/** Gesamtergebnis des PublicTransport Retrievers */
export interface PublicTransportNearbyResult {
    /** Liste nahegelegener Haltestellen mit Abfahrten */
    stations: TransitStationDepartures[];
    /** Anzahl gefundener Stationen */
    stationCount: number;
    /** Suchkoordinaten */
    searchLocation: { lat: number; lng: number };
}
