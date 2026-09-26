/**
 * =========================================================================
 *  WEBCAM TYPES — watching-eyes dredged from the surveillance void
 * =========================================================================
 */

/** A single webcam found near the search location */
export interface Webcam {
    /** Unique webcam identifier */
    id: string;
    /** Human-readable title of the webcam */
    title: string;
    /** Location details */
    location: { lat: number; lng: number; city: string; country: string };
    /** URL to the current/latest thumbnail image */
    imageUrl: string;
    /** URL to the live stream player page */
    playerUrl: string;
    /** When the webcam image was last updated (ISO datetime) */
    lastUpdated: string;
    /** Status of the webcam: "active" or "inactive" */
    status: string;
    /** Category tags (e.g. "landscape", "city", "traffic") */
    category: string[];
}

/** The full yield of the WebcamRetriever */
export interface WebcamResult {
    /** Webcams found near the search location */
    webcams: Webcam[];
    /** Total number of webcams found */
    totalFound: number;
    /** GPS center of the search */
    searchLocation: { lat: number; lng: number };
    /** Search radius in km */
    radiusKm: number;
}
