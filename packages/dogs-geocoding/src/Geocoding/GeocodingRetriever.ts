/**
 * =========================================================================
 *  GEOCODING RETRIEVER — translating names and coordinates from the map-void
 * =========================================================================
 *
 *  Arr, matey! This hound translates between the mortal tongue of
 *  addresses and the cosmic language of coordinates.
 *
 *  Pass `address` for forward geocoding (Adresse -> GPS).
 *  Pass `lat`+`lng` for reverse geocoding (GPS -> Adresse).
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, geoBucketKey } from "@slopdogs/core";
import { forwardGeocode, reverseGeocode } from "./geocodingApiClient";
import type { GeocodingResult } from "./interfaces/geocodingTypes";
import { GeocodingQueryPact, type GeocodingQuery } from "./pacts";

const GEOCODING_CACHE_TTL_MS = 24 * 60 * 60_000; // 24 h — Adressen aendern sich kaum

/**
 * Arr, the GeocodingRetriever — a spectral hound that translates
 * between addresses and GPS coordinates via Nominatim (OpenStreetMap).
 * Forward: "Hauptwache Frankfurt" -> lat/lng.
 * Reverse: lat/lng -> "Braubachstrasse 41, Frankfurt am Main".
 */
export class GeocodingRetriever extends Dog<GeocodingResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string { return GeocodingRetriever.name; }
    get description(): string { return 'Converts addresses to GPS coordinates (forward) or GPS coordinates to addresses (reverse) via Nominatim/OpenStreetMap.'; }
    get icon(): string | undefined { return "\uD83D\uDCCD"; }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [GeocodingQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GeocodingResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(GeocodingQueryPact, d));
        const query = (queryDog?.collected as GeocodingQuery | undefined) ?? ({} as GeocodingQuery);

        const address = query['address'];
        const lat = query['lat'] ? parseFloat(query['lat']) : NaN;
        const lng = query['lng'] ? parseFloat(query['lng']) : NaN;
        const limit = parseInt(query['limit'] ?? '5', 10);

        // Forward geocoding has priority
        if (address) {
            const key = `geocoding:fwd:${address.toLowerCase().trim()}:${limit}`;
            if (this.cacheHandler) {
                return this.cacheHandler.getOrFetch(key, GEOCODING_CACHE_TTL_MS, () => forwardGeocode(address, limit));
            }
            return forwardGeocode(address, limit);
        }

        // Reverse geocoding
        if (!isNaN(lat) && !isNaN(lng)) {
            const key = geoBucketKey("geocoding:rev", lat, lng, 100);
            if (this.cacheHandler) {
                return this.cacheHandler.getOrFetch(key, GEOCODING_CACHE_TTL_MS, () => reverseGeocode(lat, lng));
            }
            return reverseGeocode(lat, lng);
        }

        throw new Error('GeocodingRetriever: Missing query params — provide `address` or `lat`+`lng`');
    };
}
