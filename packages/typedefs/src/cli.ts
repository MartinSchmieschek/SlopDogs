/**
 * slopdogs-typedefs — Typen und Vertragsoberflaeche eines SlopDogs-Pakets (PLAN-DOG-PAKETE P2.1, P2.6).
 *
 *   slopdogs-typedefs build [<paketordner> ...]          dist/type-defs.json + dist/surface.json (Standard: .)
 *   slopdogs-typedefs surface --check <alte surface.json> [--package <ordner>]
 *        Exit 1, wenn gegenueber der alten Oberflaeche etwas entfernt, umbenannt oder ein Pact-Typ geaendert
 *        wurde und die Version keinen Major-Sprung (semver-Caret) macht. Vergleicht mit dist/surface.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import type * as ts from 'typescript';
import { buildPackageTypeDefs, DEFAULT_SURFACE } from './build';
import { readManifest } from './packages';
import { isBreakingBump, surfaceBreaks, type PackageSurface } from './surface';

function usage(): never {
    console.error('Aufruf: slopdogs-typedefs build [<paketordner> ...] | surface --check <alte surface.json> [--package <ordner>]');
    process.exit(2);
}

function build(dirs: string[]): void {
    const cache = new Map<string, ts.SourceFile>();
    for (const dir of dirs.length ? dirs : ['.']) {
        const r = buildPackageTypeDefs(dir, cache);
        console.log(
            `[slopdogs-typedefs] ${r.name}: ${r.pacts} Pact-Typen, ${r.classes} Klassen-Typen -> ${path.relative(process.cwd(), r.typeDefsFile) || r.typeDefsFile} (${r.ms} ms)`,
        );
    }
}

function checkSurface(args: string[]): void {
    const at = args.indexOf('--check');
    const oldFile = at >= 0 ? args[at + 1] : undefined;
    if (!oldFile) usage();
    const pkgAt = args.indexOf('--package');
    const dir = path.resolve(pkgAt >= 0 ? args[pkgAt + 1] : '.');
    const manifest = readManifest(dir);
    const nowFile = path.join(dir, manifest.slopdogs?.surface ?? DEFAULT_SURFACE);
    if (!fs.existsSync(nowFile)) {
        console.error(`[slopdogs-typedefs] ${nowFile} fehlt — erst bauen (slopdogs-typedefs build).`);
        process.exit(2);
    }
    const prev = JSON.parse(fs.readFileSync(oldFile, 'utf8')) as PackageSurface;
    const next = JSON.parse(fs.readFileSync(nowFile, 'utf8')) as PackageSurface;
    const breaks = surfaceBreaks(prev, next);
    if (!breaks.length) {
        console.log(`[slopdogs-typedefs] ${next.name} ${prev.version} -> ${next.version}: Oberflaeche vertraeglich`);
        return;
    }
    const major = isBreakingBump(prev.version, next.version);
    const list = breaks.map((b) => `  - ${b}`).join('\n');
    if (major) {
        console.log(
            `[slopdogs-typedefs] ${next.name} ${prev.version} -> ${next.version}: ${breaks.length} Bruch/Brueche, Major-Sprung vorhanden\n${list}`,
        );
        return;
    }
    console.error(
        `[slopdogs-typedefs] ${next.name} ${prev.version} -> ${next.version}: ${breaks.length} Bruch/Brueche ohne Major-Sprung\n${list}`,
    );
    process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
try {
    if (command === 'build') build(rest);
    else if (command === 'surface') checkSurface(rest);
    else usage();
} catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
}
