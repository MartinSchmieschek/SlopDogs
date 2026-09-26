export interface WikivoyageResult {
    place: string;
    lang: string;
    title?: string;
    /** Plaintext-Extract (gekuerzt) */
    extract?: string;
    pageUrl?: string;
    /** Raw-Response der MediaWiki-API — fuer fortgeschrittene Nutzer */
    raw?: unknown;
}
