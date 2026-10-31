'use strict';

/**
 * Teil von `npm run build:packages` (nach `tsc -b tsconfig.packages.json`): schreibt fuer jedes installierte
 * SlopDogs-Paket, das hier als Quelltext liegt, `dist/type-defs.json` und `dist/surface.json` — mit genau dem
 * Werkzeug, das auch `npm run build` im Paket aufruft (`slopdogs-typedefs build`, PLAN-DOG-PAKETE P2.1/P2.6).
 * Ein Prozess fuer alle Pakete: lib.d.ts und die core-Deklarationen werden einmal geparst.
 *
 * Uebersprungen wird ein Paket, dessen beide Dateien juenger sind als sein letzter tsc-Lauf (dist/tsconfig.tsbuildinfo),
 * seine package.json und das Werkzeug selbst. `--force` baut alle, `--verbose` nennt jedes Paket.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
    installedSlopdogsPackages,
    buildPackageTypeDefs,
    DEFAULT_TYPE_DEFS,
    DEFAULT_SURFACE,
} = require('@martinschmieschek/slopdogs-typedefs');

const force = process.argv.includes('--force');
const verbose = process.argv.includes('--verbose');
const mtime = (file) => {
    try {
        return fs.statSync(file).mtimeMs;
    } catch {
        return -1;
    }
};
const toolDir = path.dirname(require.resolve('@martinschmieschek/slopdogs-typedefs'));
const toolTime = Math.max(...fs.readdirSync(toolDir).map((f) => mtime(path.join(toolDir, f))));

const started = Date.now();
const cache = new Map();
let built = 0;
let skipped = 0;
for (const pkg of installedSlopdogsPackages(root)) {
    const decl = pkg.manifest.slopdogs;
    if (!decl || !decl.typeDefs) continue;
    if (!fs.existsSync(path.join(pkg.dir, 'tsconfig.json')) || !fs.existsSync(path.join(pkg.dir, 'src'))) continue; // fertig installiert, nicht hier gebaut
    const outputs = [path.join(pkg.dir, decl.typeDefs || DEFAULT_TYPE_DEFS), path.join(pkg.dir, decl.surface || DEFAULT_SURFACE)];
    const inputs = Math.max(mtime(path.join(pkg.dir, 'dist', 'tsconfig.tsbuildinfo')), mtime(path.join(pkg.dir, 'package.json')), toolTime);
    if (!force && outputs.every((f) => mtime(f) >= inputs)) {
        skipped++;
        continue;
    }
    const r = buildPackageTypeDefs(pkg.dir, cache);
    built++;
    if (verbose) console.log(`  ${r.name}: ${r.pacts} Pacts, ${r.classes} Klassen (${r.ms} ms)`);
}
console.log(`[build-package-typedefs] ${built} Paket(e) gebaut, ${skipped} aktuell (${((Date.now() - started) / 1000).toFixed(1)} s)`);
