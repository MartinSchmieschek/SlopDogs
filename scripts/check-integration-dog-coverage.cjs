/**
 * Prüft, ob alle in seed-data vorkommenden `BASE_DOG_PREFIX + '…'`-Namen in der schlanken Registry stehen
 * (dieselbe Datei wie unter NODE_ENV=production | integration).
 * Exit 1 bei Lücken — nach neuen Seed-Kennels `server-registries/slimDeployRegistry.ts` erweitern.
 *
 * Aufruf (Repo-Root): node -r ts-node/register -r tsconfig-paths/register scripts/check-integration-dog-coverage.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

require('ts-node').register({
    transpileOnly: true,
    project: path.join(root, 'tsconfig.json'),
});
require('tsconfig-paths/register');

const { SLIM_DEPLOY_BASE_DOG_NAMES } = require(path.join(root, 'server-registries', 'slimDeployRegistry.ts'));

const allowed = new Set(SLIM_DEPLOY_BASE_DOG_NAMES);
const re = /BASE_DOG_PREFIX\s*\+\s*['"]([A-Za-z0-9_]+)['"]/g;

function walkTsFiles(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...walkTsFiles(p));
        else if (ent.name.endsWith('.ts')) out.push(p);
    }
    return out;
}

const seedDir = path.join(root, 'seed-data');
const missing = new Map(); // name -> [files]

for (const file of walkTsFiles(seedDir)) {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (!allowed.has(name)) {
            const rel = path.relative(root, file);
            if (!missing.has(name)) missing.set(name, []);
            missing.get(name).push(rel);
        }
    }
}

if (missing.size > 0) {
    console.error('[check-integration-dog-coverage] Folgende Base-Dog-Namen aus seed-data fehlen in der schlanken Registry (SLIM_DEPLOY_BASE_DOG_NAMES):');
    for (const [name, files] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  - ${name}`);
        for (const f of [...new Set(files)]) console.error(`      ${f}`);
    }
    console.error('\nErgänze die Klasse in server-registries/slimDeployRegistry.ts (und ggf. allPacts).');
    process.exit(1);
}

console.log('[check-integration-dog-coverage] OK — alle BASE_DOG_PREFIX-Referenzen in seed-data sind in der schlanken Registry (production/integration).');
