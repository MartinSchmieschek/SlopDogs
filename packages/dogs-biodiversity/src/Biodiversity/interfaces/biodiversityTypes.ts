/**
 * =========================================================================
 *  BIODIVERSITY TYPES — life-forms dredged from the naturalist void
 * =========================================================================
 */

/** A single species observation from iNaturalist */
export interface SpeciesObservation {
    /** iNaturalist observation ID */
    id: number;
    /** Common name of the species */
    speciesName: string;
    /** Scientific (Latin) name */
    scientificName: string;
    /** Iconic taxon group (e.g. "Mammalia", "Aves", "Plantae", "Insecta", "Fungi") */
    iconicTaxon: string;
    /** URL to an observation photo (null if none) */
    photoUrl: string | null;
    /** Date the observation was made (ISO string) */
    observedOn: string;
    /** GPS location of the observation */
    location: { lat: number; lng: number };
    /** Human-readable place guess */
    placeGuess: string | null;
    /** Quality grade: "research", "needs_id", or "casual" */
    qualityGrade: string;
}

/** The full yield of the SpeciesRetriever */
export interface BiodiversityResult {
    /** Observations found in the area */
    observations: SpeciesObservation[];
    /** Total number of results returned by iNaturalist */
    totalResults: number;
    /** GPS center of the search */
    searchLocation: { lat: number; lng: number };
    /** Search radius in km */
    radiusKm: number;
    /** Taxon filter applied (null if none) */
    taxonFilter: string | null;
}
