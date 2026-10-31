/**
 * `@martinschmieschek/slopdogs-core/runtime` — die Laufzeit (PLAN-DOG-PAKETE P2.3). Nur der Server
 * importiert diesen Einstieg; Dog-Pakete sehen nur den Vertrag (`./index.ts`, ESLint-Regel
 * `no-restricted-imports` fuer `packages/*` ausser core).
 *
 * Hier entstehen die Singletons: `DogWorkerGate.shared` (Slot-Deckel, Speicher-Waechter) und die
 * Capability-Registry (`registerVmGlobalCapability` fuer `jsonStore`/`keys`) in `dogs/SerializedDog.ts`.
 * Beide Einstiege zeigen auf dieselben Dateien unter `dist/`; Node laedt jede Datei einmal, also gibt es
 * jede Klasse (auch `Dog`) und jedes Singleton genau einmal. Einige Namen kommen aus Vertragsdateien
 * (Wellen-Eintraege, Tile-Ergebnisse, Log-Schalter) — sie gehoeren zum Server, nicht zum Vertrag, und
 * stehen deshalb hier und nicht im Haupteinstieg.
 */

// The captain and the hunt -- orchestration of the abyss
export {
    KennelRun,
    IKennelConfig,
    BASE_DOG_PREFIX,
    type IKennelNodeAnnotation,
    type IKennelEdgeAnnotation,
    type MimicAdopter,
} from './KennelRun';
export type { IWaveEntry, IReadTrackingEntry } from './core/entities/IHuntingSeason';
export { isRuntimeLogVerbose, envFirst } from './runtimeLog';
export {
    KENNEL_PUBLIC_PREFIX,
    publicKennelPath,
    publicKennelDocsPath,
    publicKennelOpenApiPath,
    kennelIdBlockedReason,
} from './kennelPaths';
export {
    suggestKennelImportTarget,
    isKennelIdTakenInList,
    isKennelNameTakenInList,
    type KennelIdNameListEntry,
} from './kennelImportTarget';

// The watcher at the kennel gate (P4b) -- the marker the memory guard writes into a dog's error
export { DOG_MEMPRESSURE_MARKER } from './core/entities/IDogRunObserver';

// Spirits trapped in code, running in sandboxed voids -- and the capability registry (jsonStore, keys)
export {
    SerializedDog,
    ISerializedDogConfig,
    type VmGlobalCapabilityContext,
    setVmConsoleSink,
    isPrivateNetworkAddress,
    registerVmGlobalCapability,
    listVmGlobalCapabilities,
    checkSerializedDogCode,
} from './dogs/SerializedDog';

// Slot-Deckel und Speicher-Waechter der Dog-Isolate (Gegendruck statt Sofort-Abweisung)
export { DogWorkerGate, type MemoryProbe } from './dogs/DogWorkerGate';

// Annotations upon a spirit's scroll — line-level docs over a dog's code
export { type ILineDoc, sanitizeLineDocs, selectLineDocs, sliceDogCodeLines } from './dogs/lineDocs';

// Through endless faces, countless forms -- the shapeshifter
export { MimicDog, IMimicDogConfig } from './dogs/MimicDog';

// Tile-Cache: was der Server-Cache (PrismaTileFeatureCache) liefert und abdeckt
export { tilesIntersectingBBox, type TileCoverageResult, type TileFetchResult } from './cache/tiling';

// The map-reader and the cargo-bearer
export { QueryRetriever } from './platform/QueryRetriever';
export { BodyRetriever } from './platform/BodyRetriever';

// WebSocket lobbies: one channel id opens a room; peers share a dedicated shared object
export { WebSocketChannelRetriever } from './socket/WebSocketChannelRetriever';
export { ChannelLiveSnippetRetriever } from './socket/ChannelLiveSnippetRetriever';
export type { ChannelPeer, ChannelState, IChannelHub, IChannelTicketIssuer } from './socket/IChannelHub';
