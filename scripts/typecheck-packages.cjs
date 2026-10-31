'use strict';

/**
 * `npm run typecheck:packages`: `tsc --noEmit` fuer jedes Paket unter packages/ (core, geo-pact, swaggrid
 * und alle dogs-*), mit der tsconfig.json des Pakets — so, wie es auch allein gebaut wird. Ein neues
 * Paket ist ohne Eintrag dabei. Die Pakete pruefen gegen die gebauten Abhaengigkeiten (dist von core,
 * geo-pact, dogs-demo); die legt `npm ci`/`npm install` per postinstall an, sonst `npm run build:packages`.
 *
 * Exit 1, sobald ein Paket Typfehler hat; die Ausgabe von tsc steht dann unter dem Paketnamen.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const tscBin = require.resolve('typescript/bin/tsc', { paths: [root] });
const packagesDir = path.join(root, 'packages');
const parallel = Math.max(1, Math.min(4, os.cpus().length));

const packages = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packagesDir, entry.name, 'tsconfig.json')))
    .map((entry) => entry.name)
    .sort();

function typecheck(name) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [tscBin, '--noEmit', '-p', path.join('packages', name)], { cwd: root });
        let output = '';
        child.stdout.on('data', (chunk) => { output += chunk; });
        child.stderr.on('data', (chunk) => { output += chunk; });
        child.on('close', (code) => resolve({ name, ok: code === 0, output }));
    });
}

async function main() {
    const startedAt = Date.now();
    const queue = [...packages];
    const failed = [];
    const worker = async () => {
        for (let name = queue.shift(); name; name = queue.shift()) {
            const result = await typecheck(name);
            if (!result.ok) {
                failed.push(name);
                console.error(`\n[typecheck:packages] ${name}:\n${result.output.trim()}`);
            }
        }
    };
    await Promise.all(Array.from({ length: parallel }, worker));
    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[typecheck:packages] ${packages.length - failed.length}/${packages.length} Pakete ohne Typfehler (${seconds} s)`);
    if (failed.length) {
        console.error(`[typecheck:packages] mit Typfehlern: ${failed.sort().join(', ')}`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('[typecheck:packages]', err);
    process.exit(1);
});
