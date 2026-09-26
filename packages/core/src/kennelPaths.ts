/**
 * Kennel-Pfade und die Namensregel fuer Kennel-IDs (lineageId).
 *
 * Ein Kennel lebt immer und nur als zweites Segment hinter `/k/` — damit kollidiert sein Name
 * mit keinem festen Pfad mehr, und es braucht keine Blockliste reservierter Slugs. Statt der
 * Liste gilt eine Segment-Regel: ein URL-sicheres Segment ohne Kodierung.
 *
 * UI-Spiegel (Bundler): ui-app/src/app/config/public-paths.ts — bei Aenderung mitpflegen.
 */

/** Praefix der oeffentlichen Kennel-Seiten ("Ware"). */
export const KENNEL_PUBLIC_PREFIX = '/k';

/** Ein Segment, 1..64 Zeichen, beginnt mit Buchstabe oder Ziffer; kein `/`, kein Leerzeichen, kein `?`, `#`, `%`. */
export const KENNEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** Oeffentlicher Lauf eines Kennels: `/k/<id>`. */
export function publicKennelPath(id: string): string {
    return `${KENNEL_PUBLIC_PREFIX}/${encodeURIComponent(id)}`;
}

/** Swagger-UI eines Kennels: `/k/<id>/docs`. */
export function publicKennelDocsPath(id: string): string {
    return `${publicKennelPath(id)}/docs`;
}

/** OpenAPI-Spec eines Kennels: `/k/<id>/openapi.json`. */
export function publicKennelOpenApiPath(id: string): string {
    return `${publicKennelPath(id)}/openapi.json`;
}

/**
 * null = erlaubt; sonst der Grund (fuer UI und API gleich).
 * Lehnt leer, laenger als 64, `.`, `..` und alles ausserhalb von KENNEL_ID_PATTERN ab.
 */
export function kennelIdBlockedReason(id: string): string | null {
    const s = typeof id === 'string' ? id : '';
    if (!s) return 'Kennel-ID fehlt';
    if (s === '.' || s === '..') return `Kennel-ID ist kein gueltiges Pfadsegment: ${s}`;
    if (s.length > 64) return `Kennel-ID ist zu lang (${s.length} Zeichen, hoechstens 64)`;
    if (!KENNEL_ID_PATTERN.test(s)) {
        return `Kennel-ID "${s}" ungueltig: Buchstaben, Ziffern, Punkt, Bindestrich, Unterstrich, 1-64 Zeichen, beginnt mit Buchstabe oder Ziffer`;
    }
    return null;
}
