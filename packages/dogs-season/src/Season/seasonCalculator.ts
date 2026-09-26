/**
 * =========================================================================
 *  SEASON CALCULATOR — pure computation from the temporal void
 * =========================================================================
 *
 *  Arr, no API calls here — this module reads the calendar and the
 *  latitude to divine the season, daylight hours, and the next
 *  celestial turning point. Pure mathematics, matey.
 * =========================================================================
 */

import type { SeasonResult, SeasonEvent } from "./interfaces/seasonTypes";

/** Astronomische Wendepunkte (Nordhemisphaere, Naeherungswerte) */
const EVENTS_NORTHERN = [
    { name: "Vernal Equinox",   month: 3,  day: 20 },
    { name: "Summer Solstice",  month: 6,  day: 21 },
    { name: "Autumnal Equinox", month: 9,  day: 22 },
    { name: "Winter Solstice",  month: 12, day: 21 },
];

const EVENTS_SOUTHERN = [
    { name: "Autumnal Equinox", month: 3,  day: 20 },
    { name: "Winter Solstice",  month: 6,  day: 21 },
    { name: "Vernal Equinox",   month: 9,  day: 22 },
    { name: "Summer Solstice",  month: 12, day: 21 },
];

/** Astronomische Jahreszeiten (Nordhemisphaere) */
function getAstronomicalSeasonNorthern(month: number, day: number): string {
    if ((month === 3 && day >= 20) || month === 4 || month === 5 || (month === 6 && day <= 20)) return "Spring";
    if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day <= 21)) return "Summer";
    if ((month === 9 && day >= 22) || month === 10 || month === 11 || (month === 12 && day <= 20)) return "Autumn";
    return "Winter";
}

/** Meteorologische Jahreszeiten */
function getMeteorologicalSeason(month: number): string {
    if (month >= 3 && month <= 5) return "Spring";
    if (month >= 6 && month <= 8) return "Summer";
    if (month >= 9 && month <= 11) return "Autumn";
    return "Winter";
}

/** Reversed season names for southern hemisphere */
function reverseSeason(season: string): string {
    switch (season) {
        case "Spring": return "Autumn";
        case "Summer": return "Winter";
        case "Autumn": return "Spring";
        case "Winter": return "Summer";
        default: return season;
    }
}

/** Tag des Jahres (1-366) */
function dayOfYear(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Tage zwischen zwei Daten */
function daysBetween(a: Date, b: Date): number {
    const diff = b.getTime() - a.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Vereinfachte Tageslichtberechnung.
 * daylight = 12 + 2.4 * sin((2 * PI / 365) * (dayOfYear - 80)) * sin(lat * PI / 180) / sin(23.44 * PI / 180)
 * Ergebnis auf 0-24 begrenzt.
 */
function calculateDaylight(doy: number, lat: number): number {
    const PI = Math.PI;
    const sinDoy = Math.sin((2 * PI / 365) * (doy - 80));
    const sinLat = Math.sin(lat * PI / 180);
    const sinTilt = Math.sin(23.44 * PI / 180);
    const hours = 12 + 2.4 * sinDoy * sinLat / sinTilt;
    return Math.round(Math.max(0, Math.min(24, hours)) * 100) / 100;
}

/** Naechstes astronomisches Ereignis berechnen */
function getNextEvent(date: Date, isNorthern: boolean): SeasonEvent {
    const events = isNorthern ? EVENTS_NORTHERN : EVENTS_SOUTHERN;
    const year = date.getFullYear();

    for (const ev of events) {
        const evDate = new Date(year, ev.month - 1, ev.day);
        const diff = daysBetween(date, evDate);
        if (diff > 0) {
            return {
                name: ev.name,
                date: formatDate(evDate),
                daysUntil: diff,
            };
        }
    }

    // Wrap to first event of next year
    const first = events[0];
    const evDate = new Date(year + 1, first.month - 1, first.day);
    return {
        name: first.name,
        date: formatDate(evDate),
        daysUntil: daysBetween(date, evDate),
    };
}

/** Tageslichttrend: zunehmend zwischen Winter- und Sommersonnenwende */
function getDaylightTrend(doy: number, isNorthern: boolean): 'increasing' | 'decreasing' {
    // Nordhemisphaere: Wintersonnenwende ~Dez 21 (doy ~355), Sommersonnenwende ~Jun 21 (doy ~172)
    // Zunehmend: doy < 172 oder doy > 355 (also Dez 21 bis Jun 21)
    // Suedhemisphaere: invertiert
    const winterSolsticeDoy = 355;
    const summerSolsticeDoy = 172;

    let increasing: boolean;
    if (doy <= summerSolsticeDoy || doy > winterSolsticeDoy) {
        increasing = true;
    } else {
        increasing = false;
    }

    // Suedhemisphaere: invertieren
    if (!isNorthern) increasing = !increasing;

    return increasing ? 'increasing' : 'decreasing';
}

/** Datum als YYYY-MM-DD */
function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Berechne alle Jahreszeitendaten.
 */
export function calculateSeason(lat: number, dateStr?: string): SeasonResult {
    const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
    const isNorthern = lat >= 0;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const doy = dayOfYear(date);

    const northernSeason = getAstronomicalSeasonNorthern(month, day);
    const season = isNorthern ? northernSeason : reverseSeason(northernSeason);

    const northernMeteo = getMeteorologicalSeason(month);
    const meteorologicalSeason = isNorthern ? northernMeteo : reverseSeason(northernMeteo);

    const dayLengthHours = calculateDaylight(doy, lat);
    const daylightTrend = getDaylightTrend(doy, isNorthern);
    const nextEvent = getNextEvent(date, isNorthern);

    return {
        season,
        hemisphere: isNorthern ? 'northern' : 'southern',
        date: formatDate(date),
        dayLengthHours,
        daylightTrend,
        nextEvent,
        meteorologicalSeason,
    };
}
