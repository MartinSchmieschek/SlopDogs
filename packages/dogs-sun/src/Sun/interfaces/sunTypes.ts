/**
 * =========================================================================
 *  SUN TYPES — celestial data dredged from the sky-void
 * =========================================================================
 */

/** Sonnendaten fuer einen einzelnen Tag */
export interface SunDay {
    /** Datum (YYYY-MM-DD) */
    date: string;
    /** Sonnenaufgang (ISO string, lokale Zeit) */
    sunrise: string;
    /** Sonnenuntergang (ISO string, lokale Zeit) */
    sunset: string;
    /** Tageslichtdauer in Stunden */
    daylightHours: number;
    /** Sonnenscheindauer in Stunden */
    sunshineHours: number;
    /** Maximaler UV-Index */
    uvIndexMax: number;
    /** UV-Risiko-Bewertung */
    uvRisk: string;
}

/** Gesamtergebnis des Sun Retrievers */
export interface SunResult {
    /** Heutiger Tag */
    today: SunDay;
    /** Vorhersage fuer die naechsten Tage */
    forecast: SunDay[];
    /** Standort */
    location: {
        lat: number;
        lng: number;
        timezone: string;
    };
}
