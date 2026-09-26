/**
 * =========================================================================
 *  GEOCODING TYPES — coordinates and addresses dredged from the map-void
 * =========================================================================
 */

/** Adress-Details aus Nominatim */
export interface GeoAddress {
    /** Strasse mit Hausnummer */
    street: string | null;
    /** Stadtteil / Viertel */
    suburb: string | null;
    /** Stadt */
    city: string | null;
    /** Postleitzahl */
    postcode: string | null;
    /** Bundesland */
    state: string | null;
    /** Land */
    country: string | null;
    /** Laendercode (z.B. "de") */
    countryCode: string | null;
}

/** Ein einzelnes Geocoding-Ergebnis */
export interface GeoLocation {
    /** Breitengrad */
    lat: number;
    /** Laengengrad */
    lng: number;
    /** Vollstaendiger Anzeigename */
    displayName: string;
    /** Strukturierte Adresse */
    address: GeoAddress;
    /** OSM Typ (node, way, relation) */
    osmType: string | null;
    /** Wichtigkeit/Relevanz (0-1) */
    importance: number;
}

/** Gesamtergebnis des Geocoding Retrievers */
export interface GeocodingResult {
    /** Modus: "forward" (Adresse->GPS) oder "reverse" (GPS->Adresse) */
    mode: "forward" | "reverse";
    /** Suchanfrage (Adresse oder Koordinaten) */
    query: string;
    /** Gefundene Ergebnisse */
    results: GeoLocation[];
    /** Anzahl Ergebnisse */
    resultCount: number;
}
