/**
 * Vergleicht Heap nach Registry-Load in zwei frischen Node-Prozessen (slim ≈ integration/production vs full ≈ development).
 * Repo-Root: node scripts/compare-registry-heap.cjs
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const childScript = path.join(__dirname, 'registry-heap-child.cjs');

function runMode(mode) {
    const r = spawnSync(
        process.execPath,
        ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register', childScript, mode],
        { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    if (r.status !== 0) {
        console.error(`[${mode}] stderr:\n`, r.stderr);
        throw new Error(`Child ${mode} exited ${r.status}`);
    }
    return JSON.parse(r.stdout.trim());
}

console.log('Vergleich Registry → Heap (je eigener Node-Prozess, nach Konstruktion aller Dogs/Pacts)\n');
const slim = runMode('slim');
const full = runMode('full');

console.table([slim, full]);
console.log(
    `\nUngefähre Differenz heapUsed: ${full.heapUsedMB - slim.heapUsedMB} MB (full − slim), RSS-Diff: ${full.rssMB - slim.rssMB} MB`,
);
