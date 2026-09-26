// Baut den statischen Fallback der Landing (PLAN P5): public/landing/index.html = Skin C "Mixtape",
// gerendert aus denselben Quellen wie der Kennel slopdogs-landing (seed-data/kennels/slopdogs-landing/).
// Mixtape ist der einzige Look (kein ?look=, keine Skins a/b/d mehr — die liegen archiviert unter
// docs/slopdogs/landing/archive/). Kein Kennel-Lauf, keine DB: Content-, Skin- und Lead-Code laufen hier
// wie im VM-Worker (sucrase, dann eine async-Huelle, Parents als Globals) — nur ohne Isolation, es ist
// unser eigener Code aus dem Repo. Deterministisch: gleiche Quellen, gleiche Bytes.
// Aufruf: `node scripts/build-landing.cjs` (Teil von npm run build).
'use strict';
const fs = require('fs');
const path = require('path');
const { transform } = require('sucrase');

const SOURCE_DIR = path.join(__dirname, '..', 'seed-data', 'kennels', 'slopdogs-landing');
const OUT_FILE = path.join(__dirname, '..', 'public', 'landing', 'index.html');

function source(fileName) {
    return fs.readFileSync(path.join(SOURCE_DIR, fileName), 'utf8');
}

/** Ein Dog-Rumpf wie im Worker: TypeScript-Strip, `(async () => { … })()`, Parents als Globals. */
async function runDog(fileName, globals) {
    const code = transform(source(fileName), { transforms: ['typescript'] }).code;
    const names = Object.keys(globals);
    const run = new Function(...names, `return (async () => { ${code}\n})();`);
    return run(...names.map((name) => globals[name]));
}

/** Die Lead-Ausgabe: dieselbe Seite, die der Kennel liefert (Content -> Skin C -> Lead). */
async function render() {
    const content = await runDog('content.js', {});
    const skinC = await runDog('skin_c.js', { SlopdogsLandingContent: content });
    return runDog('lead.js', { SlopdogsLandingSkinC: skinC });
}

async function main() {
    const html = await render();
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, html, 'utf8');
    console.log(`[build-landing] ${path.relative(process.cwd(), OUT_FILE)}: ${Buffer.byteLength(html, 'utf8')} B`);
}

module.exports = { render, OUT_FILE };

if (require.main === module) {
    main().catch((err) => {
        console.error('[build-landing]', err);
        process.exit(1);
    });
}
