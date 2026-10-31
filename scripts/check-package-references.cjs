'use strict';

/**
 * Vor jedem `npm run build:packages` (postinstall, build, typecheck): stehen alle Pakete in
 * tsconfig.packages.json, und nennt jedes Paket seine @slopdogs-Abhaengigkeiten als `references`?
 *
 * `tsc -b tsconfig.packages.json` baut nur, was dort steht. Ein neues packages/<x> ohne Eintrag wuerde
 * still weder gebaut noch typgeprueft — lokal faellt das wegen eines alten dist nicht auf, auf Render
 * scheitert dann `require('@slopdogs/<x>')` beim Boot. Frueher fand scripts/typecheck-packages.cjs neue
 * Pakete selbst; diese Pruefung haelt dieselbe Zusage. Exit 1 mit Liste, sonst eine Zeile.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const packagesDir = path.join(root, 'packages');
const SCOPE = '@slopdogs/';

function readTsconfig(file) {
    const { config, error } = ts.readConfigFile(file, ts.sys.readFile);
    if (error) throw new Error(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    return config;
}

function referencedNames(config, fromDir) {
    return (config.references || []).map((ref) => path.basename(path.resolve(fromDir, ref.path)));
}

const packages = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packagesDir, entry.name, 'tsconfig.json')))
    .map((entry) => entry.name)
    .sort();

const problems = [];
const solution = new Set(referencedNames(readTsconfig(path.join(root, 'tsconfig.packages.json')), root));
for (const name of packages) {
    if (!solution.has(name)) problems.push(`tsconfig.packages.json: Referenz auf ./packages/${name} fehlt`);
}
for (const name of solution) {
    if (!packages.includes(name)) problems.push(`tsconfig.packages.json: ./packages/${name} gibt es nicht (oder ohne tsconfig.json)`);
}
for (const name of packages) {
    const dir = path.join(packagesDir, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const deps = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
        .filter((dep) => dep.startsWith(SCOPE))
        .map((dep) => dep.slice(SCOPE.length));
    const refs = new Set(referencedNames(readTsconfig(path.join(dir, 'tsconfig.json')), dir));
    for (const dep of deps) {
        if (!refs.has(dep))
            problems.push(`packages/${name}/tsconfig.json: references ohne ../${dep} (package.json haengt an ${SCOPE}${dep})`);
    }
}

if (problems.length) {
    console.error(`[check-package-references] ${problems.length} Luecke(n):\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log(`[check-package-references] OK — ${packages.length} Pakete, alle in tsconfig.packages.json und mit ihren references`);
