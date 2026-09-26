/**
 * =========================================================================
 *  WIKIPEDIA TYPES — knowledge dredged from the encyclopaedic void
 * =========================================================================
 */

/** Ein Wikipedia-Artikel in der Naehe */
export interface WikiArticle {
    /** Wikipedia Page-ID */
    pageId: number;
    /** Artikeltitel */
    title: string;
    /** Breitengrad */
    lat: number;
    /** Laengengrad */
    lng: number;
    /** Entfernung in Metern vom Suchpunkt */
    distance: number;
    /** Einleitungstext (erste 2 Saetze) */
    extract: string;
    /** Thumbnail-URL (falls vorhanden) */
    thumbnailUrl: string | null;
    /** Voller Artikel-Link */
    articleUrl: string;
}

/** Gesamtergebnis des Wikipedia Nearby Retrievers */
export interface WikiNearbyResult {
    /** Gefundene Artikel */
    articles: WikiArticle[];
    /** Anzahl Ergebnisse */
    articleCount: number;
    /** Suchkoordinaten */
    searchLocation: { lat: number; lng: number };
    /** Suchradius in Metern */
    radius: number;
    /** Wikipedia-Sprache (z.B. "de") */
    language: string;
}
