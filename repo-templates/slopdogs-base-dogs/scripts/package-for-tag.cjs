#!/usr/bin/env node
'use strict';

/**
 * `node scripts/package-for-tag.cjs <paket>@<version>` -> gibt den Paketordner (packages/<x>) aus.
 * Exit 1, wenn kein Paket so heisst oder seine package.json eine andere Version traegt als der Tag.
 * Genutzt von .github/workflows/release.yml; Tags legt `npx changeset tag` an.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const tag = process.argv[2] || '';
const at = tag.lastIndexOf('@');
if (at <= 0) {
    console.error(`[package-for-tag] "${tag}" ist kein Tag der Form <paket>@<version>`);
    process.exit(1);
}
const name = tag.slice(0, at);
const version = tag.slice(at + 1);
const packagesDir = path.join(root, 'packages');
for (const entry of fs.readdirSync(packagesDir)) {
    const file = path.join(packagesDir, entry, 'package.json');
    if (!fs.existsSync(file)) continue;
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (manifest.name !== name) continue;
    if (manifest.version !== version) {
        console.error(`[package-for-tag] ${name}: Tag sagt ${version}, packages/${entry}/package.json sagt ${manifest.version}`);
        process.exit(1);
    }
    process.stdout.write(`packages/${entry}\n`);
    process.exit(0);
}
console.error(`[package-for-tag] kein Paket ${name} unter packages/`);
process.exit(1);
