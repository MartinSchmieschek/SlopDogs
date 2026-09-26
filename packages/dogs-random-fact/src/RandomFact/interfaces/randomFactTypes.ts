/**
 * =========================================================================
 *  RANDOM FACT TYPES — trivia dredged from the knowledge-void
 * =========================================================================
 */

/** Rohantwort der uselessfacts API */
export interface RandomFactApiResponse {
    id: string;
    text: string;
    source: string;
    source_url: string;
    language: string;
    permalink: string;
}

/** Gesamtergebnis des RandomFact Retrievers */
export interface RandomFactResult {
    /** Der Fun Fact */
    fact: string;
    /** Quelle */
    source: string;
    /** URL der Quelle */
    sourceUrl: string;
    /** Sprache (en/de) */
    language: string;
    /** Permanenter Link */
    permalink: string;
}
