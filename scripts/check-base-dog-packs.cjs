'use strict';

/**
 * Pruefung zu PLAN-DOG-PAKETE P2.5 (`npm run check:dog-packs`, Teil von `npm test`): erkennt BaseDogPacks Paket,
 * Namen und Version eines Base-Dogs auch dann, wenn das Paket unter `node_modules/@martinschmieschek/slopdogs-<x>/`
 * liegt (installiert, nicht im Monorepo)? Frueher las BaseDogPacks den Namen aus `/packages/<name>/` im Pfad;
 * unter node_modules wurde `pack` fuer jeden Dog null.
 *
 * Simuliert wird ein installiertes Paket in einem Wegwerf-Ordner unter os.tmpdir(): package.json + dist/index.js,
 * per require geladen, dann BaseDogPacks ueber den echten require.cache. Zusaetzlich zwei Gegenproben: ein Paket
 * ausserhalb des Scopes und eine Datei ohne package.json liefern null. Exit 1 bei Abweichung.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { BaseDogPacks } = require('../services/BaseDogPacks');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slopdogs-packs-'));
function fakePackage(name, version, className) {
    const dir = path.join(tmp, 'app', 'node_modules', ...name.split('/'));
    fs.mkdirSync(path.join(dir, 'dist', 'Fake'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, main: 'dist/index.js' }));
    fs.writeFileSync(path.join(dir, 'dist', 'Fake', `${className}.js`), `class ${className} {}\nexports.${className} = ${className};\n`);
    fs.writeFileSync(path.join(dir, 'dist', 'index.js'), `module.exports = require('./Fake/${className}');\n`);
    return require(path.join(dir, 'dist', 'index.js'))[className];
}

let failed = 0;
const expect = (label, actual, wanted) => {
    const ok = JSON.stringify(actual) === JSON.stringify(wanted);
    if (!ok) failed++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (erwartet ${JSON.stringify(wanted)})`}`);
};

try {
    const Weather = fakePackage('@martinschmieschek/slopdogs-dogs-fakeweather', '1.4.2', 'FakeWeatherRetriever');
    const Foreign = fakePackage('@someone/dogs-other', '9.9.9', 'ForeignRetriever');
    const loose = path.join(tmp, 'loose.js');
    fs.writeFileSync(loose, 'class LooseDog {}\nexports.LooseDog = LooseDog;\n');
    const Loose = require(loose).LooseDog;

    const packs = BaseDogPacks.fromLoadedModules();
    const file = require.resolve(
        path.join(tmp, 'app', 'node_modules', '@martinschmieschek', 'slopdogs-dogs-fakeweather', 'dist', 'index.js'),
    );
    expect('Pfad liegt unter node_modules', /[\\/]node_modules[\\/]@martinschmieschek[\\/]slopdogs-dogs-fakeweather[\\/]/.test(file), true);
    expect('Paket der Klasse', packs.packageOf(Weather), {
        pack: 'dogs-fakeweather',
        name: '@martinschmieschek/slopdogs-dogs-fakeweather',
        version: '1.4.2',
    });
    expect('pack-Label einer Instanz', packs.packOf(new Weather()), 'dogs-fakeweather');
    expect('fremdes Paket ausserhalb des Scopes', packs.packageOf(Foreign), null);
    expect('Datei ohne SlopDogs-package.json', packs.packageOf(Loose), null);
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(
    failed ? `[check-base-dog-packs] ${failed} Abweichung(en)` : '[check-base-dog-packs] OK — Paket und Version auch unter node_modules',
);
process.exit(failed ? 1 : 0);
