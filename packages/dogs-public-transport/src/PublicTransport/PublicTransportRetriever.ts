/**
 * =========================================================================
 *  PUBLIC TRANSPORT RETRIEVER — sniffin' out stations from the transit abyss
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  gulfs of the public transit network, summoning nearby stations and
 *  their departures from the eldritch depths of MOTIS.
 *
 *  Each station reveals its departures — buses, trams, U-Bahnen, and
 *  iron serpents bound for distant destinations, each one a journey
 *  deeper into the void. Through endless rails and roads, a multitude unfolds.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@slopdogs/core";
import { fetchNearbyStations, fetchDepartures } from "./publicTransportApiClient";
import type { PublicTransportNearbyResult, TransitStationDepartures } from "./interfaces/publicTransportTypes";
import { PublicTransportQueryPact, type PublicTransportQuery } from "./pacts";

/**
 * Arr, the PublicTransportRetriever — a spectral hound that sniffs out
 * transit stations near given GPS coordinates and plunders their departure boards!
 * Buses, trams, U-Bahn, S-Bahn, regional, and long-distance trains —
 * all modes of transport dredged from the multimodal abyss.
 */
export class PublicTransportRetriever extends Dog<PublicTransportNearbyResult> {
    /** Arr, the name whispered by the void when it speaks of this hound */
    get name(): string {
        return PublicTransportRetriever.name;
    }

    get description(): string {
        return 'Finds nearby public transport stops and departures.';
    }

    /** The mark of our vessel — the transit sigil */
    get icon(): string | undefined {
        return "\uD83D\uDE8C";
    }

    /** The unholy pacts this hound be shackled to — GPS coordinates from the mortal plane */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PublicTransportQueryPact];
    }

    /** No optional anchors drag this vessel down */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /**
     * Arr, here we plunder the stations and departures from the transit abyss!
     * First we summon nearby stations, then for each we dredge the departure board
     * from the MOTIS void — revealing destinations across the cursed network.
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PublicTransportNearbyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PublicTransportQueryPact, d));
        const query = (queryDog?.collected as PublicTransportQuery | undefined) ?? ({} as PublicTransportQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const radius = parseInt(query['radius'] ?? '1000', 10);
        const results = parseInt(query['results'] ?? '8', 10);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('PublicTransportRetriever: Missing required query params (lat, lng)');
        }

        // Summon nearby stations from the transit abyss
        const stations = await fetchNearbyStations(lat, lng, radius, results);

        // For each station, dredge the departure board from the void
        const stationDepartures: TransitStationDepartures[] = await Promise.all(
            stations.map(async (station) => {
                try {
                    const departures = await fetchDepartures(station.id);
                    return { station, departures };
                } catch (err) {
                    console.warn(`[PublicTransportRetriever] Failed to fetch departures for ${station.name}: ${err}`);
                    return { station, departures: [] };
                }
            })
        );

        return {
            stations: stationDepartures,
            stationCount: stationDepartures.length,
            searchLocation: { lat, lng },
        };
    };
}
