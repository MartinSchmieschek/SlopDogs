/**
 * Precompile-Schritt für int/prod: ruft CompilerCache.computeForBuild() einmalig auf,
 * spannt dabei genau ein ts.Program über das gesamte Repo und materialisiert
 * Pact-Return-Typen sowie Klassen-Typdefinitionen nach dist/type-defs.json.
 *
 * Zur Laufzeit lädt main.ts diese JSON über CompilerCache.loadPrecomputed(),
 * sodass kein ts.createProgram in production/integration mehr aufgerufen wird.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const compiledCachePath = path.resolve(projectRoot, 'dist/services/CompilerCache.js');
if (!fs.existsSync(compiledCachePath)) {
    console.error(`[precompile-typedefs] Erwartete Datei fehlt: ${compiledCachePath}. Bitte zuerst tsc ausführen.`);
    process.exit(1);
}

const { CompilerCache } = require(compiledCachePath);

const start = Date.now();
const payload = CompilerCache.computeForBuild();
const elapsed = ((Date.now() - start) / 1000).toFixed(2);

const outPath = path.resolve(projectRoot, 'dist/type-defs.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));

const pactCount = Object.keys(payload.pactReturnTypes).length;
const classCount = Object.keys(payload.classTypes).length;
console.log(
    `[precompile-typedefs] ${pactCount} Pact-Typen, ${classCount} Klassen-Typen → ${path.relative(projectRoot, outPath)} (${elapsed}s)`
);
