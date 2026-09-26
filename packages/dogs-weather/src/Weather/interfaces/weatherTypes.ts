/**
 * =========================================================================
 *  WEATHER TYPES — atmospheric forms dredged from the sky-void
 * =========================================================================
 */

/** Aktuelles Wetter an einem Ort */
export interface CurrentWeather {
    /** Temperatur in Grad Celsius */
    temperature: number;
    /** Gefuehlte Temperatur in Grad Celsius */
    apparentTemperature: number;
    /** Relative Luftfeuchtigkeit in Prozent */
    humidity: number;
    /** Windgeschwindigkeit in km/h */
    windSpeed: number;
    /** Windrichtung in Grad (0 = Nord, 90 = Ost) */
    windDirection: number;
    /** WMO Wettercode */
    weatherCode: number;
    /** Menschenlesbare Wetterbeschreibung */
    weatherDescription: string;
    /** Zeitpunkt der Messung (ISO string) */
    time: string;
}

/** Eine Stunde in der Vorhersage */
export interface HourlyForecast {
    /** Zeitpunkt (ISO string) */
    time: string;
    /** Temperatur in Grad Celsius */
    temperature: number;
    /** Gefuehlte Temperatur in Grad Celsius */
    apparentTemperature: number;
    /** Relative Luftfeuchtigkeit in Prozent */
    humidity: number;
    /** Windgeschwindigkeit in km/h */
    windSpeed: number;
    /** WMO Wettercode */
    weatherCode: number;
    /** Menschenlesbare Wetterbeschreibung */
    weatherDescription: string;
    /** Niederschlagswahrscheinlichkeit in Prozent */
    precipitationProbability: number;
}

/** Gesamtergebnis des Weather Retrievers */
export interface WeatherResult {
    /** Aktuelles Wetter */
    current: CurrentWeather;
    /** Stuendliche Vorhersage (gefiltert auf angefragte Zeit, falls angegeben) */
    hourly: HourlyForecast[];
    /** Standort-Infos */
    location: {
        lat: number;
        lng: number;
        elevation: number;
        timezone: string;
    };
    /** Angefragte Uhrzeit (falls gesetzt), sonst null */
    requestedTime: string | null;
}
