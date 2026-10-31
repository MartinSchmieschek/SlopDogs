import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { TypeDefExtractor, type TypeDefsPayload } from './TypeDefExtractor';
import { createCachingHost, parseTsconfig, readManifest, slopdogsSourcePredicate } from './packages';
import { computeSurface, type PackageSurface } from './surface';

export const DEFAULT_TYPE_DEFS = 'dist/type-defs.json';
export const DEFAULT_SURFACE = 'dist/surface.json';
export const DEFAULT_SURFACE_ENTRY = 'src/index.ts';

export interface PackageBuildResult {
    name: string;
    dir: string;
    typeDefsFile: string;
    surfaceFile: string;
    pacts: number;
    classes: number;
    ms: number;
}

function samePath(a: string, b: string): boolean {
    const norm = (p: string) => {
        const r = path.resolve(p);
        return process.platform === 'win32' ? r.toLowerCase() : r;
    };
    return norm(a) === norm(b);
}

export function isInside(file: string, dir: string): boolean {
    const rel = path.relative(path.resolve(dir), path.resolve(file));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/**
 * Typen eines Pakets: ein ts.Program aus seiner `tsconfig.json`, gescannt werden nur seine eigenen Quelldateien.
 * Abhaengigkeiten (core, geo-pact, dogs-demo) kommen als `.d.ts` und zaehlen fuer Interface-Suchen mit
 * (`slopdogsSourcePredicate`). Schreibt `type-defs.json` und `surface.json` (Pfade aus `slopdogs` in der
 * package.json, sonst `dist/...`).
 */
export function buildPackageTypeDefs(packageDir: string, cache: Map<string, ts.SourceFile> = new Map()): PackageBuildResult {
    const started = Date.now();
    const dir = fs.realpathSync(path.resolve(packageDir));
    const manifest = readManifest(dir);
    const parsed = parseTsconfig(path.join(dir, 'tsconfig.json'));
    const program = ts.createProgram({
        rootNames: parsed.fileNames,
        options: parsed.options,
        host: createCachingHost(parsed.options, cache),
    });
    const own = program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && isInside(sf.fileName, dir));
    const payload: TypeDefsPayload = new TypeDefExtractor(program, slopdogsSourcePredicate(program)).compute(own);

    const entryRel = manifest.slopdogs?.surfaceEntry ?? DEFAULT_SURFACE_ENTRY;
    const entryFile = own.find((sf) => samePath(sf.fileName, path.join(dir, entryRel)))?.fileName;
    if (!entryFile) throw new Error(`[slopdogs-typedefs] ${manifest.name}: Einstieg ${entryRel} fehlt im Programm.`);
    const surface: PackageSurface = computeSurface(
        program,
        entryFile,
        { name: manifest.name, version: manifest.version, entry: entryRel },
        payload,
    );

    const typeDefsFile = path.join(dir, manifest.slopdogs?.typeDefs ?? DEFAULT_TYPE_DEFS);
    const surfaceFile = path.join(dir, manifest.slopdogs?.surface ?? DEFAULT_SURFACE);
    fs.mkdirSync(path.dirname(typeDefsFile), { recursive: true });
    fs.mkdirSync(path.dirname(surfaceFile), { recursive: true });
    fs.writeFileSync(typeDefsFile, JSON.stringify(payload));
    fs.writeFileSync(surfaceFile, JSON.stringify(surface, null, 2) + '\n');
    return {
        name: manifest.name,
        dir,
        typeDefsFile,
        surfaceFile,
        pacts: Object.keys(payload.pactReturnTypes).length,
        classes: Object.keys(payload.classTypes).length,
        ms: Date.now() - started,
    };
}
