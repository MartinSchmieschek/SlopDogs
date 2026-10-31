/**
 * @martinschmieschek/slopdogs-typedefs — Typ-Werkzeug der SlopDogs-Pakete (PLAN-DOG-PAKETE P2.1, P2.6).
 * Dieselbe Extraktion fuer den Server (`services/CompilerCache.ts`) und den Paket-Build (`slopdogs-typedefs build`).
 */
export {
    TypeDefExtractor,
    nonDeclarationFiles,
    type IClassTypeResult,
    type TypeDefsPayload,
    type SourceFilePredicate,
} from './TypeDefExtractor';
export {
    SLOPDOGS_PACKAGE_PREFIX,
    shortPackageName,
    packageRootOf,
    slopdogsSourcePredicate,
    createCachingHost,
    parseTsconfig,
    readManifest,
    installedSlopdogsPackages,
    readPackageTypeDefs,
    mergeTypeDefs,
    type InstalledPackage,
    type MergeConflict,
    type SlopdogsPackageManifest,
} from './packages';
export { buildPackageTypeDefs, isInside, DEFAULT_TYPE_DEFS, DEFAULT_SURFACE, type PackageBuildResult } from './build';
export { computeSurface, surfaceBreaks, isBreakingBump, type PackageSurface } from './surface';
