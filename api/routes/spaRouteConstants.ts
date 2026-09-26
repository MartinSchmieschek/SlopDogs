/**
 * Abstimmung Express ↔ Angular (SPA):
 * - Oeffentliche Kennels leben unter `/k/:id` — der Name ist Segment 2, es gibt keine Blockliste mehr.
 * - `FIXED_TOP_LEVEL` dient nur der Alt-Weiche (`/:name` -> 308 `/k/:name`): feste Segmente gehen per next() weiter.
 *
 * SPA-Fallback (index.html) darf keine Backend-Pfade überschreiben (Präfixe unten).
 */

/** Erste Pfadsegmente, die die Alt-Weiche nicht umleitet (lowercase). Kennel-Namen werden NICHT dagegen geprueft. */
export const FIXED_TOP_LEVEL: ReadonlySet<string> = new Set([
    'api',
    'auth',
    '.well-known',
    'static',
    'mcp',
    'actions',
    'save',
    'k',
    'kennels',
    'kennel',
    'dogs',
    'account',
    'login',
    'robots.txt',
]);

export const SPA_FALLBACK_SKIP_PREFIXES = ['/api', '/static', '/auth', '/mcp', '/actions', '/.well-known', '/k'] as const;
