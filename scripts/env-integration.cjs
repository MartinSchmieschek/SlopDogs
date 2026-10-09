/**
 * Preload fuer den direkten Start ohne npm/cross-env (`start:integration:node`, Render-Startbefehl):
 *
 *   node --expose-gc --max-old-space-size=320 -r ./scripts/env-integration.cjs -r ./scripts/load-env.cjs dist/main.js
 *
 * Setzt NODE_ENV=integration, BEVOR load-env.cjs die .env-Schichten waehlt. Ohne diese Zeile fiele
 * load-env auf "development" zurueck, wenn das Dashboard kein NODE_ENV setzt — und development heisst:
 * volle Registry, Waechter aus, Selbsttests gegen die echte Datenbank.
 *
 * Die malloc-Schalter (MALLOC_ARENA_MAX=2, MALLOC_MMAP_THRESHOLD_=131072, MALLOC_TRIM_THRESHOLD_=131072)
 * koennen hier NICHT gesetzt werden: glibc liest sie beim Prozessstart, vor jedem JS. Sie gehoeren als
 * Umgebungsvariablen ins Render-Dashboard.
 */
process.env.NODE_ENV = 'integration';
