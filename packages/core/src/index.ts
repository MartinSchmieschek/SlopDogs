/**
 * ~~~ THE MANIFEST OF ALL SOULS ABOARD ~~~
 *
 * Arr, here be the ledger of every cursed spirit bound to this vessel.
 * From brooding gulfs are we beheld, by that which bears no name --
 * and yet we name them all the same, catalogued in ink that
 * bleeds through dimensions. Each export be a soul plundered
 * from the deep, pressed into service aboard this accursed ship.
 *
 * To cosmic forms from tangent planes, we end as we began.
 */

// The pacts every hound must honour, and the skeleton they wear
export { IHuntingDog, DogClass } from './core/entities/IHuntingDog';
export { Dog } from './core/entities/abstractHuntingDog';
export { IHuntingSeason, IWaveEntry, IReadTrackingEntry } from './core/entities/IHuntingSeason';

// The captain and the hunt -- orchestration of the abyss
export {
    KennelRun,
    IKennelConfig,
    BASE_DOG_PREFIX,
    type IKennelNodeAnnotation,
    type IKennelEdgeAnnotation,
    type MimicAdopter,
} from './KennelRun';
export { isRuntimeLogVerbose, envFirst } from './runtimeLog';
export {
    KENNEL_PUBLIC_PREFIX,
    KENNEL_ID_PATTERN,
    publicKennelPath,
    publicKennelDocsPath,
    publicKennelOpenApiPath,
    kennelIdBlockedReason,
} from './kennelPaths';
export {
    suggestKennelImportTarget,
    kennelImportNeedsUserChoice,
    isKennelIdTakenInList,
    isKennelNameTakenInList,
    kennelListRef,
    type KennelIdNameListEntry,
} from './kennelImportTarget';
export { SeasonRunner } from './harverster';

// The watcher at the kennel gate (P4b) -- one report per hound run, markers instead of prose
export {
    type DogRunOutcome,
    type DogRunReport,
    type IDogRunObserver,
    DOG_TIMEOUT_MARKER,
    DOG_OOM_MARKER,
    classifyDogError,
} from './core/entities/IDogRunObserver';

// Spirits trapped in code, running in sandboxed voids
export {
    SerializedDog,
    ISerializedDogConfig,
    IUpdateInput,
    type SerializedDogVmGlobalsSupplier,
    type VmGlobalCapabilityContext,
    type VmGlobalCapabilityFactory,
    type VmConsoleLevel,
    type VmConsoleSink,
    setVmConsoleSink,
    isPrivateNetworkAddress,
    registerVmGlobalCapability,
    unregisterVmGlobalCapability,
    listVmGlobalCapabilities,
    checkSerializedDogCode,
    describeTranspileError,
    buildVmGlobalCapabilities,
} from './dogs/SerializedDog';

// Annotations upon a spirit's scroll — line-level docs over a dog's code
export {
    type ILineDoc,
    sanitizeLineDocs,
    selectLineDocs,
    sliceDogCodeLines,
} from './dogs/lineDocs';

// Eldritch contracts between hounds
export { createPact, type CreatePactFromSourceOptions } from './dogs/createPact';

// Through endless faces, countless forms -- the shapeshifter
export { MimicDog, IMimicDogConfig } from './dogs/MimicDog';

// The cache pacts -- memory across voyages, dedup of in-flight hunts, tile-based geo caching
export { ICacheHandler } from './cache/ICacheHandler';
export { ICacheable, isCacheable } from './cache/ICacheable';
export { withDogCacheStats, dogCacheStatsOf, type DogCacheStats } from './cache/withDogCacheStats';
export { geoBucketKey, geoBucketCenter, defaultGeoBucketM, type GeoBucketOptions } from './cache/geoBucket';
export { GEO_CACHE_TTL_OSM_MS, GEO_CACHE_TTL_WEATHER_MS, GEO_CACHE_TTL_AIR_QUALITY_MS } from './cache/geoCacheTtl';
export {
    pickZoomForRadius,
    lonLatToTile,
    tileBBox,
    circleBBox,
    tilesIntersectingBBox,
    tilesTouching,
    tileKeyString,
    bboxIntersects,
    bboxIntersectsCircle,
    haversineDistanceM,
    featureInRadius,
    isTileCacheable,
    type TileBBox,
    type TileKey,
    type GeomFeatureLike,
    type ITileFeatureCache,
    type ITileCacheable,
    type StoredGeoFeature,
    type TileCoverageResult,
    type FeatureUpsert,
    type TileFetchResult,
} from './cache/tiling';

// The map-reader, the cargo-bearer, the far-sailing dog, and the sigils they wear
export { QueryRetriever } from './platform/QueryRetriever';
export { BodyRetriever } from './platform/BodyRetriever';
export { FetchBaseDog } from './platform/FetchBaseDog';

// WebSocket lobbies: one channel id opens a room; peers share a dedicated shared object
export { WebSocketChannelRetriever } from './socket/WebSocketChannelRetriever';
export { ChannelLiveSnippetRetriever, type LobbyLeadYield } from './socket/ChannelLiveSnippetRetriever';
export type { ChannelPeer, ChannelState, IChannelHub } from './socket/IChannelHub';

// JSON-Ablage — eigene SQLite-Truhe.
// Welle 8: `JsonStorageRetriever` ist entfernt. `jsonStore` ist ausschliesslich
// VM-Global-Capability (siehe `registerVmGlobalCapability('jsonStore', ...)` in
// main.ts) und fuer jeden SerializedDog automatisch verfuegbar -- kein Parent,
// kein BaseDog mehr.
export type { IJsonStorage } from './storage/IJsonStorage';
