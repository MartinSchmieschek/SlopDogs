/**
 * Kindprozess: eine Registry laden, Instanzen wie main erzeugen, heapUsed ausgeben (eine Zeile JSON).
 * Aufruf: node -r ts-node/register -r tsconfig-paths/register scripts/registry-heap-child.cjs slim|full
 */
const path = require('path');

const mode = (process.argv[2] || '').trim();
if (mode !== 'slim' && mode !== 'full') {
    console.error('Usage: registry-heap-child.cjs slim|full');
    process.exit(2);
}

const root = path.join(__dirname, '..');

(() => {
    const regPath =
        mode === 'slim'
            ? path.join(root, 'server-registries', 'slimDeployRegistry.ts')
            : path.join(root, 'server-registries', 'fullRegistry.ts');
    // require('.ts'): ts-node/register muss via -r vor diesem Skript geladen sein.
    const { allBaseDogClasses, allPacts } = require(regPath);

    let constructed = 0;
    let failed = 0;
    for (const DogClass of allBaseDogClasses) {
        try {
            new DogClass();
            constructed++;
        } catch {
            failed++;
        }
    }
    for (const PactClass of allPacts) {
        try {
            new PactClass();
            constructed++;
        } catch {
            failed++;
        }
    }

    const m = process.memoryUsage();
    const v8 = require('v8');
    const heap = v8.getHeapStatistics();
    console.log(
        JSON.stringify({
            mode,
            registryClasses: allBaseDogClasses.length + allPacts.length,
            constructed,
            failed,
            heapUsedMB: Math.round(m.heapUsed / 1024 / 1024),
            rssMB: Math.round(m.rss / 1024 / 1024),
            heapTotalMB: Math.round(m.heapTotal / 1024 / 1024),
            heapSizeLimitMB: Math.round(heap.heap_size_limit / 1024 / 1024),
        }),
    );
})();

process.on('uncaughtException', (e) => {
    console.error(e);
    process.exit(1);
});
