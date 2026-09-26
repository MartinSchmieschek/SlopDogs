/**
 * =========================================================================
 *  SEASON TYPES — temporal data dredged from the calendar-void
 * =========================================================================
 */

/** Naechstes astronomisches Ereignis */
export interface SeasonEvent {
    /** Name des Ereignisses (z.B. "Summer Solstice") */
    name: string;
    /** Datum (YYYY-MM-DD) */
    date: string;
    /** Tage bis zum Ereignis */
    daysUntil: number;
}

/** Gesamtergebnis des Season Retrievers */
export interface SeasonResult {
    /** Astronomische Jahreszeit */
    season: string;
    /** Hemispaehre */
    hemisphere: 'northern' | 'southern';
    /** Datum (YYYY-MM-DD) */
    date: string;
    /** Tageslaenge in Stunden */
    dayLengthHours: number;
    /** Tageslichttrend */
    daylightTrend: 'increasing' | 'decreasing';
    /** Naechstes astronomisches Ereignis */
    nextEvent: SeasonEvent;
    /** Meteorologische Jahreszeit */
    meteorologicalSeason: string;
}
