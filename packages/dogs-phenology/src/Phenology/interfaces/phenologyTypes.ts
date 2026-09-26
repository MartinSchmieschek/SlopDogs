/**
 * =========================================================================
 *  PHENOLOGY TYPES — seasonal forms dredged from the botanical void
 * =========================================================================
 */

/** A phenological phase — one of the ten seasons the void reveals */
export interface PhenologicalPhase {
    /** German name (e.g. "Erstfruehling") */
    name: string;
    /** English name (e.g. "Early Spring") */
    nameEn: string;
    /** Indicator plants that mark the beginning of this phase */
    indicatorPlants: string[];
    /** What typically blooms or fruits during this phase */
    typicalBloom: string[];
    /** Animal activities typical for this phase */
    typicalFauna: string[];
}

/** The full yield of the PhenologyRetriever */
export interface PhenologyResult {
    /** The current phenological phase */
    currentPhase: PhenologicalPhase;
    /** The date used for calculation (ISO date) */
    date: string;
    /** Day of the year (1-366) */
    dayOfYear: number;
    /** Which hemisphere was used for the calculation */
    hemisphere: 'north' | 'south';
    /** Human-readable summary in German */
    seasonalInfo: string;
    /** The next phenological phase (null if at end of cycle) */
    upcomingPhase: PhenologicalPhase | null;
}
