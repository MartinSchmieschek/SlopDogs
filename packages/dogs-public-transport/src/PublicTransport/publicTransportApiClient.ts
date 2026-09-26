/**
 * =========================================================================
 *  PUBLIC TRANSPORT API CLIENT — summoning transit from the multimodal abyss
 * =========================================================================
 *
 *  Arr, this module speaks the tongue of the MOTIS transit oracle
 *  (europe.motis-project.de) — a public multimodal routing platform
 *  that knows every bus, tram, U-Bahn, S-Bahn, and train across
 *  the cursed lands of Deutschland.
 *
 *  Two endpoints plundered from the deep:
 *  - /api/v1/map/stops: nearby stations by bounding box
 *  - /api/v1/stoptimes: departures from a station
 * =========================================================================
 */

import type { TransitStation, TransitDeparture } from "./interfaces/publicTransportTypes";

const MOTIS_BASE = "https://europe.motis-project.de/api/v1";

/**
 * Haversine distance in meters between two GPS points.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Convert a distance in meters to a rough lat/lng offset for bounding box.
 * ~111,320m per degree latitude; longitude depends on latitude.
 */
function metersToDeg(meters: number, lat: number): { dLat: number; dLng: number } {
    const dLat = meters / 111320;
    const dLng = meters / (111320 * Math.cos(lat * Math.PI / 180));
    return { dLat, dLng };
}

/**
 * Fetch nearby stops from MOTIS map/stops endpoint.
 * Returns all transit modes: BUS, TRAM, SUBWAY, SUBURBAN, REGIONAL_RAIL, etc.
 * Deduplicates by station name so each station appears once.
 */
export async function fetchNearbyStations(
    lat: number,
    lng: number,
    distance: number = 1000,
    results: number = 8
): Promise<TransitStation[]> {
    const { dLat, dLng } = metersToDeg(distance, lat);
    const min = `${lat - dLat},${lng - dLng}`;
    const max = `${lat + dLat},${lng + dLng}`;
    const url = `${MOTIS_BASE}/map/stops?min=${min}&max=${max}&zoom=14`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`MOTIS map/stops failed: ${res.status} ${res.statusText} ${text.slice(0, 200)}`);
    }

    const stops = await res.json() as any[];

    // Deduplicate by station name — keep the entry with a parentId (preferred for stoptimes)
    // and the closest distance. Multiple Steige of the same station share the same name.
    const byName = new Map<string, TransitStation>();

    for (const stop of stops) {
        const stopLat = stop.lat;
        const stopLng = stop.lon;
        if (stopLat == null || stopLng == null) continue;

        const name: string = stop.name ?? "unknown";

        // Filter out RIDE_SHARING-only stops
        const modes: string[] = stop.modes ?? [];
        const transitModes = modes.filter((m: string) => m !== "RIDE_SHARING");
        if (transitModes.length === 0) continue;

        const dist = Math.round(haversineMeters(lat, lng, stopLat, stopLng));
        // Prefer parentId as stopId for stoptimes queries (returns all Steige)
        const id = stop.parentId ?? stop.stopId;
        const existing = byName.get(name);

        if (!existing || dist < existing.distance) {
            byName.set(name, {
                id,
                name,
                distance: dist,
                lat: stopLat,
                lng: stopLng,
                modes: existing ? [...new Set([...existing.modes, ...transitModes])] : transitModes,
            });
        } else {
            // Merge modes from other child stops
            for (const m of transitModes) {
                if (!existing.modes.includes(m)) {
                    existing.modes.push(m);
                }
            }
        }
    }

    const stations = Array.from(byName.values());
    stations.sort((a, b) => a.distance - b.distance);
    return stations.slice(0, results);
}

/**
 * Fetch departures for a given MOTIS stop ID via stoptimes endpoint.
 * Returns all transport modes: bus, tram, U-Bahn, S-Bahn, regional, ICE, etc.
 */
export async function fetchDepartures(
    stopId: string,
    maxDepartures: number = 15
): Promise<TransitDeparture[]> {
    const url = `${MOTIS_BASE}/stoptimes?stopId=${encodeURIComponent(stopId)}&n=${maxDepartures}&arriveBy=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: { "Accept": "application/json", "User-Agent": "SlopDogs/0.2 (+https://github.com/MartinSchmieschek/SlopDogs)" },
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        throw new Error(`MOTIS stoptimes failed for "${stopId}": ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    const stopTimes: any[] = data.stopTimes ?? [];

    return stopTimes.map((st: any) => {
        const place = st.place ?? {};
        const scheduledDep = place.scheduledDeparture ?? null;
        const actualDep = place.departure ?? null;

        // Calculate delay in minutes from scheduled vs actual
        let delay: number | null = null;
        if (scheduledDep && actualDep) {
            const diffMs = new Date(actualDep).getTime() - new Date(scheduledDep).getTime();
            delay = Math.round(diffMs / 60000);
        }

        return {
            line: st.routeShortName ?? st.displayName ?? "unknown",
            mode: st.mode ?? "unknown",
            direction: st.headsign ?? st.tripTo?.name ?? "unknown",
            plannedWhen: scheduledDep,
            when: actualDep,
            delay: delay !== 0 ? delay : null,
            platform: place.track ?? place.scheduledTrack ?? null,
        };
    });
}
