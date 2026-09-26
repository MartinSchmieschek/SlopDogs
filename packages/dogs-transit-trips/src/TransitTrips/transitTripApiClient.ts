/**
 * =========================================================================
 *  TRANSIT TRIP API CLIENT — charting full voyages through the MOTIS abyss
 * =========================================================================
 *
 *  Arr, this module dredges COMPLETE trip routes from MOTIS:
 *
 *  1. /api/v1/map/stops  — find nearby stations by bounding box
 *  2. /api/v1/stoptimes  — departures from each station (includes tripId)
 *  3. /api/v1/trip       — full route with ALL intermediate stops
 *
 *  The hound searches all nearby stations, collects departures,
 *  deduplicates by line+direction across all stations, then fetches
 *  every unique trip's complete route. A full local transit picture
 *  emerges from the void.
 * =========================================================================
 */

import type { TransitTrip, TripStop, TransitTripResult } from "./interfaces/transitTripTypes";

const MOTIS_BASE = process.env.MOTIS_API_URL ?? 'https://europe.motis-project.de';

/** Fetch JSON from MOTIS with timeout */
async function motisFetch(path: string): Promise<any> {
    const url = `${MOTIS_BASE}${path}`;
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
        const text = await res.text().catch(() => "");
        throw new Error(`MOTIS ${path} failed: ${res.status} ${text.slice(0, 200)}`);
    }
    return res.json();
}

/** Convert meters to rough lat/lng offset for bounding box */
function metersToDeg(meters: number, lat: number): { dLat: number; dLng: number } {
    const dLat = meters / 111320;
    const dLng = meters / (111320 * Math.cos(lat * Math.PI / 180));
    return { dLat, dLng };
}

/** Parse a MOTIS stop object into our TripStop */
function parseStop(s: any): TripStop {
    return {
        name: s.name ?? 'Unknown',
        stopId: s.stopId ?? '',
        lat: s.lat ?? 0,
        lng: s.lon ?? s.lng ?? 0,
        arrival: s.arrival ?? null,
        departure: s.departure ?? null,
        scheduledArrival: s.scheduledArrival ?? null,
        scheduledDeparture: s.scheduledDeparture ?? null,
    };
}

/**
 * Fetch the full trip route for a given tripId.
 * Returns all stops from origin to destination.
 */
async function fetchFullTrip(tripId: string): Promise<TripStop[]> {
    const data = await motisFetch(`/api/v1/trip?tripId=${encodeURIComponent(tripId)}`);

    const leg = data.legs?.[0];
    if (!leg) return [];

    const stops: TripStop[] = [];

    if (leg.from) stops.push(parseStop(leg.from));
    for (const s of leg.intermediateStops ?? []) stops.push(parseStop(s));
    if (leg.to) stops.push(parseStop(leg.to));

    return stops;
}

/** Find nearby stations via MOTIS map/stops, deduplicated by name */
async function findNearbyStations(
    lat: number,
    lng: number,
    distanceM: number,
    maxStations: number
): Promise<{ stopId: string; name: string }[]> {
    const { dLat, dLng } = metersToDeg(distanceM, lat);
    const min = `${lat - dLat},${lng - dLng}`;
    const max = `${lat + dLat},${lng + dLng}`;
    const data: any[] = await motisFetch(`/api/v1/map/stops?min=${min}&max=${max}&zoom=14`);

    // Deduplicate by name, prefer parentId
    const byName = new Map<string, { stopId: string; name: string; dist: number }>();
    for (const stop of data) {
        if (!stop.lat || !stop.lon) continue;
        const modes: string[] = stop.modes ?? [];
        if (modes.length === 0 || (modes.length === 1 && modes[0] === 'RIDE_SHARING')) continue;

        const name: string = stop.name ?? 'unknown';
        const stopId = stop.parentId ?? stop.stopId;
        const dist = Math.abs(stop.lat - lat) + Math.abs(stop.lon - lng); // rough distance
        const existing = byName.get(name);
        if (!existing || dist < existing.dist) {
            byName.set(name, { stopId, name, dist });
        }
    }

    return Array.from(byName.values())
        .sort((a, b) => a.dist - b.dist)
        .slice(0, maxStations);
}

/**
 * Full pipeline: find stations → get departures → deduplicate lines → fetch routes.
 */
export async function fetchLocalTransitNetwork(
    lat: number,
    lng: number,
    distanceM: number = 1000,
    maxStations: number = 5,
    lineFilter: string | undefined,
    limitPerStation: number = 10
): Promise<TransitTripResult> {
    // Step 1: find nearby stations
    const stations = await findNearbyStations(lat, lng, distanceM, maxStations);

    if (stations.length === 0) {
        return {
            trips: [], totalTrips: 0, totalStops: 0,
            searchLocation: { lat, lng }, searchLine: lineFilter ?? null,
        };
    }

    // Step 2: fetch departures from all stations in parallel
    const allDepartures: { tripId: string; lineName: string; headsign: string; mode: string; agencyName: string | null }[] = [];

    await Promise.all(stations.map(async (station) => {
        try {
            const data = await motisFetch(
                `/api/v1/stoptimes?stopId=${encodeURIComponent(station.stopId)}&n=${limitPerStation}&arriveBy=false`
            );
            for (const st of data.stopTimes ?? []) {
                const lineName = st.routeShortName ?? st.displayName ?? '';
                if (!lineName || !st.tripId) continue;

                // Apply line filter
                if (lineFilter && !lineName.toLowerCase().includes(lineFilter.toLowerCase())) continue;

                allDepartures.push({
                    tripId: st.tripId,
                    lineName,
                    headsign: st.headsign ?? 'Unknown',
                    mode: st.mode ?? 'RAIL',
                    agencyName: st.agencyName ?? null,
                });
            }
        } catch (err) {
            console.warn(`[TransitTripRetriever] Stoptimes for ${station.name} failed: ${err}`);
        }
    }));

    // Step 3: deduplicate by line + headsign (one trip per direction)
    const seen = new Set<string>();
    const uniqueDeps: typeof allDepartures = [];
    for (const dep of allDepartures) {
        const key = `${dep.lineName}::${dep.headsign}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueDeps.push(dep);
        }
    }

    // Step 4: fetch full route for each unique trip (parallel, max ~15)
    const trips: TransitTrip[] = [];
    const batchSize = 5;
    for (let i = 0; i < uniqueDeps.length; i += batchSize) {
        const batch = uniqueDeps.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(async (dep) => {
            const stops = await fetchFullTrip(dep.tripId);
            if (stops.length === 0) return null;
            return {
                tripId: dep.tripId,
                lineName: dep.lineName,
                headsign: dep.headsign,
                mode: dep.mode,
                agencyName: dep.agencyName,
                stops,
                origin: stops[0].name,
                destination: stops[stops.length - 1].name,
                stopCount: stops.length,
            } as TransitTrip;
        }));
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) trips.push(r.value);
        }
    }

    // Sort: most stops first
    trips.sort((a, b) => b.stopCount - a.stopCount);

    // Count total unique stops across all trips
    const allStopIds = new Set<string>();
    for (const trip of trips) {
        for (const s of trip.stops) allStopIds.add(s.stopId || s.name);
    }

    return {
        trips,
        totalTrips: trips.length,
        totalStops: allStopIds.size,
        searchLocation: { lat, lng },
        searchLine: lineFilter ?? null,
    };
}
