import type { AirportRecord, AirportResult } from "./interfaces/airportTypes";

/**
 * Freier JSON-Snapshot aller Airports (indexiert nach ICAO).
 * Liegt auf GitHub — wir fetchen einmal und lassen den Handler cachen.
 */
const AIRPORTS_JSON_URL = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

export type AirportIndex = Record<string, {
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
}>;

export async function fetchAirportIndex(): Promise<AirportIndex> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let res: Response;
    try {
        res = await fetch(AIRPORTS_JSON_URL, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`airport index fetch failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<AirportIndex>;
}

export function lookupAirportByIata(index: AirportIndex, iata: string): AirportRecord | undefined {
    const upper = iata.toUpperCase();
    for (const key of Object.keys(index)) {
        const rec = index[key];
        if ((rec.iata ?? "").toUpperCase() === upper) return rec;
    }
    return undefined;
}

export function lookupAirportByIcao(index: AirportIndex, icao: string): AirportRecord | undefined {
    const upper = icao.toUpperCase();
    return index[upper];
}

export function resolveAirport(index: AirportIndex, iata?: string, icao?: string): AirportResult {
    if (icao && icao.trim()) {
        const rec = lookupAirportByIcao(index, icao.trim());
        if (!rec) throw new Error(`AirportRetriever: ICAO "${icao}" not found`);
        return { queryType: "icao", query: icao.trim().toUpperCase(), airport: rec };
    }
    if (iata && iata.trim()) {
        const rec = lookupAirportByIata(index, iata.trim());
        if (!rec) throw new Error(`AirportRetriever: IATA "${iata}" not found`);
        return { queryType: "iata", query: iata.trim().toUpperCase(), airport: rec };
    }
    throw new Error("AirportRetriever: either 'iata' or 'icao' is required");
}
