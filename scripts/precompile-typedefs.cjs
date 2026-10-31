/**
 * Precompile-Schritt für int/prod: mischt die `type-defs.json` aller installierten SlopDogs-Pakete
 * (jedes Paket schreibt sie beim eigenen Build mit `slopdogs-typedefs build`, PLAN-DOG-PAKETE P2.1) mit den
 * Server-eigenen Pact- und Klassen-Typen und schreibt das Ergebnis nach dist/type-defs.json
 * (`computeTypeDefsForBuild` in services/CompilerCache.ts).
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

const { computeTypeDefsForBuild } = require(compiledCachePath);

const start = Date.now();
const { payload, conflicts, packages } = computeTypeDefsForBuild(projectRoot);
const elapsed = ((Date.now() - start) / 1000).toFixed(2);

const outPath = path.resolve(projectRoot, 'dist/type-defs.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));

const pactCount = Object.keys(payload.pactReturnTypes).length;
const classCount = Object.keys(payload.classTypes).length;
console.log(
    `[precompile-typedefs] ${pactCount} Pact-Typen, ${classCount} Klassen-Typen aus ${packages} Paketen + Server → ${path.relative(projectRoot, outPath)} (${elapsed}s)`,
);
for (const c of conflicts) {
    console.log(`[precompile-typedefs] Konflikt ${c.kind} ${c.key}: ${c.kept} behalten, ${c.dropped} verworfen`);
}
