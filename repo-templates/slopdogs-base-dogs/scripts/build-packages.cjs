#!/usr/bin/env node
'use strict';

/**
 * `npm run build` in slopdogs-base-dogs: alle Pakete unter packages/ in einem Lauf.
 *
 * 1. `tsc -b tsconfig.packages.json` — Projekt-Referenzen in Abhaengigkeitsreihenfolge (geo-pact und dogs-demo
 *    vor ihren Abhaengigen), inkrementell. Die Referenzen stehen je Paket in tsconfig.monorepo.json.
 * 2. `slopdogs-typedefs build <alle Paketordner>` — dist/type-defs.json und dist/surface.json je Paket, in einem
 *    Prozess (lib.d.ts und die core-Deklarationen werden einmal geparst).
 *
 * Einzelne Pakete bauen nicht ueber ihr eigenes `prepare`: in einem npm-Workspace startet npm `prepare` aller
 * Pakete parallel und ohne Reihenfolge. Die Pakete erkennen den Workspace und tun dort nichts; gebaut wird hier,
 * ueber `prepare` der Wurzel (also auch bei `npm ci`).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const started = Date.now();
const tsc = require.resolve('typescript/bin/tsc', { paths: [root] });
execFileSync(process.execPath, [tsc, '-b', 'tsconfig.packages.json'], { cwd: root, stdio: 'inherit' });

const packagesDir = path.join(root, 'packages');
const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(packagesDir, e.name, 'package.json')))
    .map((e) => path.join('packages', e.name))
    .filter((dir) => JSON.parse(fs.readFileSync(path.join(root, dir, 'package.json'), 'utf8')).slopdogs?.typeDefs);
const pj = require.resolve('@martinschmieschek/slopdogs-typedefs/package.json', { paths: [root] });
const cli = path.join(path.dirname(pj), 'bin', 'slopdogs-typedefs.cjs');
execFileSync(process.execPath, [cli, 'build', ...dirs], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
console.log(
    `[build] ${dirs.length} Pakete gebaut (tsc -b, type-defs.json, surface.json) in ${((Date.now() - started) / 1000).toFixed(1)} s`,
);
