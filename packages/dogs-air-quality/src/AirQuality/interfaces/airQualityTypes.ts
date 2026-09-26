/**
 * =========================================================================
 *  AIR QUALITY TYPES — particles dredged from the breathing void
 * =========================================================================
 */

/** Aktuelle Luftqualitaet */
export interface CurrentAirQuality {
    /** European Air Quality Index (1=gut, 5=extrem schlecht) */
    europeanAqi: number;
    /** Menschenlesbare Bewertung */
    aqiDescription: string;
    /** PM2.5 Feinstaub in ug/m3 */
    pm25: number;
    /** PM10 Feinstaub in ug/m3 */
    pm10: number;
    /** Ozon (O3) in ug/m3 */
    ozone: number;
    /** Stickstoffdioxid (NO2) in ug/m3 */
    nitrogenDioxide: number;
    /** Schwefeldioxid (SO2) in ug/m3 */
    sulphurDioxide: number;
    /** Kohlenmonoxid (CO) in ug/m3 */
    carbonMonoxide: number;
    /** Zeitpunkt der Messung (ISO string) */
    time: string;
}

/** Pollenflug-Daten */
export interface PollenData {
    /** Zeitpunkt (ISO string) */
    time: string;
    /** Birke Pollen (Grains/m3) */
    birch: number;
    /** Graeser Pollen (Grains/m3) */
    grass: number;
    /** Erle Pollen (Grains/m3) */
    alder: number;
    /** Ambrosia Pollen (Grains/m3) */
    ragweed: number;
    /** Beifuss Pollen (Grains/m3) */
    mugwort: number;
    /** Olive Pollen (Grains/m3) */
    olive: number;
}

/** Stuendliche Luftqualitaets-Vorhersage */
export interface HourlyAirQuality {
    /** Zeitpunkt (ISO string) */
    time: string;
    /** European AQI */
    europeanAqi: number;
    /** Menschenlesbare Bewertung */
    aqiDescription: string;
    /** PM2.5 in ug/m3 */
    pm25: number;
    /** PM10 in ug/m3 */
    pm10: number;
    /** Ozon in ug/m3 */
    ozone: number;
}

/** Gesamtergebnis des AirQuality Retrievers */
export interface AirQualityResult {
    /** Aktuelle Luftqualitaet */
    current: CurrentAirQuality;
    /** Pollenflug aktuell (naechste Stunde) */
    pollen: PollenData | null;
    /** Stuendliche Vorhersage (naechste 24h) */
    hourly: HourlyAirQuality[];
    /** Standort */
    location: {
        lat: number;
        lng: number;
        timezone: string;
    };
}
