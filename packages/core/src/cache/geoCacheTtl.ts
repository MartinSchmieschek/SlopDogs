/**
 * Einheitliche TTL-Werte fuer den Geo-Cache. Der Area-Cache wie auch
 * `cacheHandler.getOrFetch` nutzen diese Konstanten, damit alle geo-basierten
 * Dogs dieselbe Aufbewahrungsfrist haben.
 *
 * OSM-POIs aendern sich selten — 5 Tage ist der bewusst grosszuegige Default,
 * der die Overpass-Last signifikant senkt ohne nennenswerten Qualitaetsverlust.
 * Wetter und Luftqualitaet kommen mit viel kuerzeren TTLs.
 */

export const GEO_CACHE_TTL_OSM_MS = 5 * 24 * 60 * 60 * 1000; // 5 Tage
export const GEO_CACHE_TTL_WEATHER_MS = 15 * 60 * 1000;       // 15 Minuten
export const GEO_CACHE_TTL_AIR_QUALITY_MS = 30 * 60 * 1000;   // 30 Minuten
