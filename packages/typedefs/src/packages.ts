import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { nonDeclarationFiles, type SourceFilePredicate, type TypeDefsPayload } from './TypeDefExtractor';

/** Paketnamen der SlopDogs-Pakete beginnen so (PLAN-DOG-PAKETE E5). */
export const SLOPDOGS_PACKAGE_PREFIX = '@martinschmieschek/slopdogs-';

/** Was ein Paket in seiner package.json unter `slopdogs` ankuendigt (relativ zum Paketordner). */
export interface SlopdogsPackageManifest {
    name: string;
    version: string;
    slopdogs?: { typeDefs?: string; surface?: string; surfaceEntry?: string };
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

export interface InstalledPackage {
    name: string;
    version: string;
    /** Realer Ordner des Pakets (Symlinks aufgeloest). */
    dir: string;
    manifest: SlopdogsPackageManifest;
}

export function readManifest(dir: string): SlopdogsPackageManifest {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as SlopdogsPackageManifest;
}

/** Kurzname eines Pakets ohne Scope-Praefix: `@martinschmieschek/slopdogs-dogs-weather` -> `dogs-weather`. */
export function shortPackageName(name: string): string {
    return name.startsWith(SLOPDOGS_PACKAGE_PREFIX) ? name.slice(SLOPDOGS_PACKAGE_PREFIX.length) : name;
}

const packageRootCache = new Map<string, string | null>();

/** Der Ordner der naechsten package.json oberhalb von `fileName` (inklusive), oder null. */
export function packageRootOf(fileName: string): string | null {
    let dir = path.dirname(path.resolve(fileName));
    const visited: string[] = [];
    for (;;) {
        const cached = packageRootCache.get(dir);
        if (cached !== undefined) {
            for (const v of visited) packageRootCache.set(v, cached);
            return cached;
        }
        visited.push(dir);
        if (fs.existsSync(path.join(dir, 'package.json'))) {
            for (const v of visited) packageRootCache.set(v, dir);
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            for (const v of visited) packageRootCache.set(v, null);
            return null;
        }
        dir = parent;
    }
}

function isSlopdogsPackageDir(dir: string): boolean {
    try {
        return readManifest(dir).name.startsWith(SLOPDOGS_PACKAGE_PREFIX);
    } catch {
        return false;
    }
}

/**
 * Welche Dateien eines Programms als Quelle zaehlen: alles ausser Deklarationsdateien wie bisher, dazu die
 * `.d.ts` von SlopDogs-Paketen, deren Quelltext NICHT im Programm liegt (ein installiertes core, geo-pact,
 * dogs-demo als Abhaengigkeit eines Pakets). Nur so landen die core-Interfaces, auf die eine Dog-Klasse
 * verweist (`IHuntingSeason`, ...), auch im `type-defs.json` des Dog-Pakets — so wie im alten Gesamt-Programm,
 * in dem core als Quelltext dabei war. Liegt der Quelltext eines Pakets im Programm (Server in dev ueber die
 * tsconfig-paths), bleiben seine `.d.ts` draussen; das Ergebnis ist dann dasselbe wie vor P2.1.
 */
export function slopdogsSourcePredicate(program: ts.Program): SourceFilePredicate {
    const withSource = new Set<string>();
    const declarationOnly = new Set<string>();
    for (const sf of program.getSourceFiles()) {
        const root = packageRootOf(sf.fileName);
        if (!root || !isSlopdogsPackageDir(root)) continue;
        (sf.isDeclarationFile ? declarationOnly : withSource).add(root);
    }
    for (const root of withSource) declarationOnly.delete(root);
    if (!declarationOnly.size) return nonDeclarationFiles;
    return (sf) => {
        if (!sf.isDeclarationFile) return true;
        const root = packageRootOf(sf.fileName);
        return root !== null && declarationOnly.has(root);
    };
}

/**
 * Ein CompilerHost, der geparste Dateien ueber mehrere Programme behaelt (lib.d.ts, @types/node, core-Deklarationen
 * werden beim Bau aller Pakete einmal statt je Paket geparst).
 */
export function createCachingHost(options: ts.CompilerOptions, cache: Map<string, ts.SourceFile>): ts.CompilerHost {
    const host = ts.createCompilerHost(options, true);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
        const key = `${typeof languageVersionOrOptions === 'object' ? languageVersionOrOptions.languageVersion : languageVersionOrOptions}|${fileName}`;
        const hit = cache.get(key);
        if (hit) return hit;
        const sf = original(fileName, languageVersionOrOptions, onError, shouldCreate);
        if (sf) cache.set(key, sf);
        return sf;
    };
    return host;
}

/** Liest eine tsconfig wie tsc selbst (inklusive `extends` ueber Pakete). */
export function parseTsconfig(configPath: string): ts.ParsedCommandLine {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath), undefined, configPath);
    if (parsed.errors.length) throw new Error(parsed.errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
    return parsed;
}

/**
 * Die SlopDogs-Pakete, die ein Projekt installiert hat: jede Abhaengigkeit mit dem Scope-Praefix aus seiner
 * package.json, aufgeloest ueber `require.resolve(<name>/package.json)` von `rootDir` aus — so, wie Node sie
 * zur Laufzeit findet (Workspace-Symlink, `node_modules`, Tarball), nicht ueber einen Ordner `packages/`.
 */
export function installedSlopdogsPackages(rootDir: string): InstalledPackage[] {
    const manifest = readManifest(rootDir);
    const names = Object.keys({ ...manifest.dependencies }).filter((n) => n.startsWith(SLOPDOGS_PACKAGE_PREFIX));
    return names.map((name) => {
        const pj = require.resolve(`${name}/package.json`, { paths: [rootDir] });
        const dir = fs.realpathSync(path.dirname(pj));
        const m = readManifest(dir);
        return { name: m.name, version: m.version, dir, manifest: m };
    });
}

/** Ein Schluessel, den zwei Quellen mit verschiedenem Inhalt liefern — der erste gewinnt, der Konflikt wird gemeldet. */
export interface MergeConflict {
    kind: 'pact' | 'class';
    key: string;
    kept: string;
    dropped: string;
}

/**
 * Mischt mehrere `type-defs.json`-Inhalte. Reihenfolge = Vorrang: der erste Lieferant eines Schluessels gewinnt
 * (wie die erste Fundstelle im alten Gesamt-Programm). Gleicher Inhalt unter gleichem Schluessel ist kein Konflikt.
 */
export function mergeTypeDefs(sources: Array<{ label: string; payload: TypeDefsPayload }>): {
    payload: TypeDefsPayload;
    conflicts: MergeConflict[];
} {
    const payload: TypeDefsPayload = { pactReturnTypes: {}, classTypes: {} };
    const pactFrom: Record<string, string> = {};
    const classFrom: Record<string, string> = {};
    const conflicts: MergeConflict[] = [];
    for (const { label, payload: p } of sources) {
        for (const [key, value] of Object.entries(p.pactReturnTypes ?? {})) {
            if (!(key in payload.pactReturnTypes)) {
                payload.pactReturnTypes[key] = value;
                pactFrom[key] = label;
            } else if (payload.pactReturnTypes[key] !== value) conflicts.push({ kind: 'pact', key, kept: pactFrom[key], dropped: label });
        }
        for (const [key, value] of Object.entries(p.classTypes ?? {})) {
            if (!(key in payload.classTypes)) {
                payload.classTypes[key] = value;
                classFrom[key] = label;
            } else if (JSON.stringify(payload.classTypes[key]) !== JSON.stringify(value))
                conflicts.push({ kind: 'class', key, kept: classFrom[key], dropped: label });
        }
    }
    return { payload, conflicts };
}

/** Liest das `type-defs.json` eines installierten Pakets (Pfad aus `slopdogs.typeDefs`), oder null ohne Ankuendigung. */
export function readPackageTypeDefs(pkg: InstalledPackage): TypeDefsPayload | null {
    const rel = pkg.manifest.slopdogs?.typeDefs;
    if (!rel) return null;
    const file = path.join(pkg.dir, rel);
    if (!fs.existsSync(file)) throw new Error(`[slopdogs-typedefs] ${pkg.name}: ${rel} fehlt — Paket bauen (npm run build).`);
    return JSON.parse(fs.readFileSync(file, 'utf8')) as TypeDefsPayload;
}
