/**
 * =========================================================================
 *  BIRD TYPES — avian forms dredged from the ornithological void
 * =========================================================================
 */

/** A single bird observation from the field */
export interface BirdObservation {
    /** eBird species code */
    speciesCode: string;
    /** Common name of the species */
    commonName: string;
    /** Scientific (Latin) name */
    scientificName: string;
    /** Number of individuals observed (null if not counted) */
    count: number | null;
    /** Name of the observation location */
    location: string;
    /** Date of observation (ISO string) */
    observationDate: string;
    /** Latitude of the observation */
    lat: number;
    /** Longitude of the observation */
    lng: number;
    /** Whether this is a notable/rare sighting */
    isNotable: boolean;
}

/** The full yield of the BirdRetriever */
export interface BirdResult {
    /** Recent bird observations in the area */
    recentObservations: BirdObservation[];
    /** Notable (rare) observations in the area */
    notableObservations: BirdObservation[];
    /** Total unique species found */
    totalSpecies: number;
    /** GPS center of the search */
    searchLocation: { lat: number; lng: number };
    /** Search radius in km */
    radiusKm: number;
}
