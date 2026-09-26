/**
 * =========================================================================
 *  IP GEO TYPES — location data dredged from the network-void
 * =========================================================================
 */

/** Rohantwort der ip-api.com API */
export interface IPGeoApiResponse {
    status: string;
    message?: string;
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    query: string;
}

/** Gesamtergebnis des IPGeo Retrievers */
export interface IPGeoResult {
    /** Die abgefragte IP-Adresse */
    ip: string;
    /** Land */
    country: string;
    /** Laendercode (z.B. "DE") */
    countryCode: string;
    /** Region-Code */
    region: string;
    /** Regionsname */
    regionName: string;
    /** Stadt */
    city: string;
    /** Postleitzahl */
    zip: string;
    /** Breitengrad */
    lat: number;
    /** Laengengrad */
    lng: number;
    /** Zeitzone */
    timezone: string;
    /** Internet Service Provider */
    isp: string;
    /** Organisation */
    org: string;
}
