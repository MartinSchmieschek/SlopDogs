/**
 * ~~~ THE MANIFEST OF ALL SOULS ABOARD ~~~
 *
 * Der Haupteinstieg von `@martinschmieschek/slopdogs-core` ist der **Vertrag** der Dog-Pakete
 * (PLAN-DOG-PAKETE P2.3): die 22 Exporte, die Dog-Pakete importieren, aus 14 Dateien ohne
 * Node-Builtins, dazu der Typ DogEnvVar (P2.7, Env-Metadaten der Pakete). Was nur der Server braucht — Sandbox, Gate, Kennel-Lauf, Plattform-Dogs, Lobby —
 * steht im zweiten Einstieg `@martinschmieschek/slopdogs-core/runtime` (`./runtime.ts`).
 *
 * Regel: Diese Datei laedt keine Laufzeit-Datei, auch nicht indirekt. Die Laufzeit-Singletons
 * (`DogWorkerGate.shared`, die Capability-Registry in `dogs/SerializedDog.ts`) entstehen damit nur
 * im runtime-Einstieg; beide Einstiege teilen dieselben Moduldateien unter `dist/`, also dieselbe
 * Klasse `Dog` (Parent-Matching per `instanceof`, F1). Was hier steht, prueft `dist/surface.json`
 * (P2.6): entfernen, umbenennen oder einen Pact-Typ aendern heisst Major-Sprung.
 *
 * To cosmic forms from tangent planes, we end as we began.
 */

// The pacts every hound must honour, and the skeleton they wear
export { IHuntingDog } from './core/entities/IHuntingDog';
export { Dog } from './core/entities/abstractHuntingDog';
export { IHuntingSeason } from './core/entities/IHuntingSeason';

// Eldritch contracts between hounds
export { createPact } from './dogs/createPact';

// Env-Variablen als Metadaten: Dog-Pakete liefern sie unter <paket>/env (P2.7)
export type { DogEnvVar } from './envVars';

// The far-sailing dog
export { FetchBaseDog } from './platform/FetchBaseDog';

// The cache pacts -- memory across voyages, tile-based geo caching
export { ICacheHandler } from './cache/ICacheHandler';
export { ICacheable } from './cache/ICacheable';
export { geoBucketKey, geoBucketCenter } from './cache/geoBucket';
export { GEO_CACHE_TTL_OSM_MS, GEO_CACHE_TTL_WEATHER_MS, GEO_CACHE_TTL_AIR_QUALITY_MS } from './cache/geoCacheTtl';
export {
    pickZoomForRadius,
    tileBBox,
    tilesTouching,
    tileKeyString,
    featureInRadius,
    type TileKey,
    type ITileFeatureCache,
    type ITileCacheable,
    type StoredGeoFeature,
    type FeatureUpsert,
} from './cache/tiling';
