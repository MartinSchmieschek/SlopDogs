/**
 * Paket-Tests von slopdogs-base-dogs (PLAN-DOG-PAKETE P0.1 -> P4.2): die Dog-Anteile der Startup-Tests des Servers.
 *
 * - `testBaseDogsAvailability`: die Demo-Dogs sind da, jeder exportierte Dog laesst sich bauen und meldet einen
 *   Namen, kein Name kommt zweimal vor (der Server legt alle Dogs unter ihrem Namen in eine Map).
 * - `testTalkingDogAllDependenciesResolved` (dogs-talking): fillKennel loest alle Abhaengigkeiten auf.
 * - `testPactFromSourceType`, Typanteil (dogs-geo): die Pact-Typen stehen in der eigenen dist/type-defs.json
 *   (P2.1). Der CompilerCache-/TypeDefBuilder-Teil bleibt im Server.
 * - Was ein Server zum Booten braucht: dist/type-defs.json und dist/surface.json in jedem Paket, dist/env.js
 *   in jedem Paket mit Einstieg ./env (fehlt eins, scheitern Start bzw. build:prod laut).
 *
 * Laeuft gegen die gebauten Pakete (Workspace-Links) und genau ein core aus node_modules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Dog, IHuntingDog } from '@martinschmieschek/slopdogs-core';
import { KennelRun, MimicDog, QueryRetriever, BodyRetriever } from '@martinschmieschek/slopdogs-core/runtime';

// Wie `required`/`optional` in core: Konstruktoren mit beliebigen Argumenten.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DogClass = new (...args: any[]) => IHuntingDog<unknown>;
type DependencyClass = DogClass & { __isPact?: boolean };

const root = path.resolve(__dirname, '..');
const packagesDir = path.join(root, 'packages');

interface Pkg {
    dir: string;
    manifest: { name: string; version: string; exports?: Record<string, unknown>; slopdogs?: { typeDefs?: string; surface?: string } };
}

const packages: Pkg[] = fs
    .readdirSync(packagesDir)
    .filter((d) => fs.existsSync(path.join(packagesDir, d, 'package.json')))
    .map((d) => ({
        dir: path.join(packagesDir, d),
        manifest: JSON.parse(fs.readFileSync(path.join(packagesDir, d, 'package.json'), 'utf8')),
    }));

/** Jede exportierte Klasse, die von core.Dog erbt — samt Pacts, so wie der Server sie registriert. */
function exportedDogClasses(pkg: Pkg): Array<{ exportName: string; cls: DogClass }> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Paketname erst zur Laufzeit bekannt
    const mod = require(pkg.manifest.name) as Record<string, unknown>;
    return Object.entries(mod)
        .filter(([, v]) => typeof v === 'function' && (v as { prototype?: unknown }).prototype instanceof Dog)
        .map(([exportName, cls]) => ({ exportName, cls: cls as DogClass }));
}

test('genau ein core: alle Pakete sehen dieselbe Dog-Klasse', () => {
    const resolved = new Set(packages.map((p) => fs.realpathSync(require.resolve('@martinschmieschek/slopdogs-core', { paths: [p.dir] }))));
    assert.equal(resolved.size, 1, `core mehrfach aufgeloest: ${[...resolved].join(', ')}`);
});

test('jedes Paket traegt dist/type-defs.json, dist/surface.json und (mit ./env) dist/env.js', () => {
    const missing: string[] = [];
    for (const p of packages) {
        for (const rel of [p.manifest.slopdogs?.typeDefs, p.manifest.slopdogs?.surface]) {
            if (!rel) missing.push(`${p.manifest.name}: slopdogs.typeDefs/surface nicht angekuendigt`);
            else if (!fs.existsSync(path.join(p.dir, rel))) missing.push(`${p.manifest.name}: ${rel}`);
        }
        if (p.manifest.exports && './env' in p.manifest.exports && !fs.existsSync(path.join(p.dir, 'dist', 'env.js')))
            missing.push(`${p.manifest.name}: dist/env.js`);
    }
    assert.deepEqual(missing, []);
});

test('BaseDogs: Verfuegbarkeit (Demo-Dogs da, jeder Dog hat einen Namen, kein Name doppelt)', () => {
    const byName = new Map<string, { cls: DogClass; where: string }>();
    const problems: string[] = [];
    let built = 0;
    const allClasses = packages.flatMap((p) => exportedDogClasses(p).map((e) => e.cls));
    for (const p of packages) {
        for (const { exportName, cls } of exportedDogClasses(p)) {
            let name: unknown;
            try {
                name = new cls().name;
            } catch (err) {
                // Wie im Server (main.ts): ein Dog, dessen Konstruktor wirft (fehlender API-Key), ist nicht verfuegbar.
                console.log(`  ${p.manifest.name}: ${exportName} nicht gebaut — ${(err as Error).message}`);
                continue;
            }
            built++;
            if (typeof name !== 'string' || !name) {
                // Eine abstrakte Basisklasse (z. B. OsmFeatureRetriever) hat keinen Namen und steht in keiner Registry;
                // sie ist daran zu erkennen, dass ein anderer exportierter Dog von ihr erbt.
                if (allClasses.some((other) => other !== cls && other.prototype instanceof cls)) {
                    console.log(`  ${p.manifest.name}: ${exportName} ist Basisklasse, ohne Namen`);
                    continue;
                }
                problems.push(`${p.manifest.name}: ${exportName} ohne Namen`);
                continue;
            }
            const where = `${p.manifest.name}:${exportName}`;
            const other = byName.get(name);
            // Dieselbe Klasse unter zwei Exporten ist kein Konflikt; zwei Klassen unter einem Namen schon.
            if (other && other.cls !== cls) problems.push(`${name} doppelt: ${other.where} und ${where}`);
            if (!other) byName.set(name, { cls, where });
        }
    }
    console.log(`  ${built} Dog-Klassen aus ${packages.length} Paketen gebaut, ${byName.size} Namen`);
    for (const expected of [
        'RandomRecipesRetriever',
        'CountryFlagBlackLab',
        'DishFlagBlackLab',
        'RandomEveryThingRetriever',
        'TalkingDog',
    ]) {
        if (!byName.has(expected)) problems.push(`fehlender BaseDog: ${expected}`);
    }
    assert.deepEqual(problems, []);
});

test('TalkingDog: Alle Dependencies im Kennel nach fillKennel', async () => {
    const map = new Map<string, DogClass>();
    for (const C of [QueryRetriever, BodyRetriever] as DogClass[]) map.set(new C().name, C);
    for (const p of packages.filter((x) => /slopdogs-dogs-(demo|talking)$/.test(x.manifest.name))) {
        for (const { cls } of exportedDogClasses(p)) map.set(new cls().name, cls);
    }
    const kennel = await new KennelRun({ id: 'test-talkingdog-kennel', dogIds: ['base:TalkingDog'] }, map).fillKennel();
    const talkingDog = kennel.find((d) => d.name === 'TalkingDog');
    assert.ok(talkingDog, 'TalkingDog nicht im Kennel');
    const { required, optional } = talkingDog as unknown as { required: DependencyClass[]; optional: DependencyClass[] };
    const deps = [...required, ...optional];
    const missing = deps
        .filter(
            (depClass) =>
                !kennel.some((d) => {
                    if (d === talkingDog) return false;
                    if (d instanceof MimicDog && depClass.__isPact === true)
                        return (d as MimicDog<unknown>).imitatesClasses.includes(depClass);
                    return d instanceof depClass;
                }),
        )
        .map((c) => c.name || 'unknown');
    assert.deepEqual(missing, [], `fehlende Dependencies fuer TalkingDog: ${missing.join(', ')}`);
    assert.ok(
        kennel.some((d) => d instanceof MimicDog && (d as MimicDog<unknown>).imitatesName === 'LayoutInputProvider'),
        'kein MimicDog fuer LayoutInputProvider im Kennel',
    );
});

test('Pact: fromSourceType — Pact-Typen aus dogs-geo/dist/type-defs.json', () => {
    const geo = packages.find((p) => p.manifest.name.endsWith('/slopdogs-dogs-geo'));
    assert.ok(geo, 'dogs-geo fehlt');
    const defs = JSON.parse(fs.readFileSync(path.join(geo.dir, geo.manifest.slopdogs!.typeDefs!), 'utf8')) as {
        pactReturnTypes: Record<string, string>;
    };
    const iso = defs.pactReturnTypes.BloodhoundIsochroneInput;
    assert.ok(iso, 'kein Eintrag fuer BloodhoundIsochroneInput');
    for (const member of ['lat', 'range', 'BloodhoundIsochroneInputReturn'])
        assert.ok(iso.includes(member), `BloodhoundIsochroneInput ohne ${member}`);
    const landmarks = defs.pactReturnTypes.OsmLandmarksQueryInput;
    assert.ok(landmarks, 'kein Eintrag fuer OsmLandmarksQueryInput');
    assert.ok(landmarks.includes('preset') && landmarks.includes('OsmLandmarksQueryInputReturn'), 'OsmLandmarksQueryInput unvollstaendig');
    assert.ok(!landmarks.includes('BloodhoundIsochroneInput'), 'OsmLandmarksQueryInput darf BloodhoundIsochroneInput nicht enthalten');
});

test('Env: was ein Paket in src/env.ts nennt, steht in seinem Code; jedes process.env.X steht in src/env.ts', () => {
    const problems: string[] = [];
    const sourceFiles = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(dir, e.name);
            return e.isDirectory() ? sourceFiles(p) : /\.ts$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
        });
    for (const p of packages) {
        const src = path.join(p.dir, 'src');
        if (!fs.existsSync(src)) continue;
        const files = sourceFiles(src).filter((f) => path.basename(f) !== 'env.ts');
        const code = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
        const declared = new Set<string>();
        if (p.manifest.exports && './env' in p.manifest.exports) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- Paketname erst zur Laufzeit bekannt
            const { envVars } = require(`${p.manifest.name}/env`) as {
                envVars: Array<{ name: string; anyOf?: string[]; aliases?: string[] }>;
            };
            for (const v of envVars) {
                const names = [v.name, ...(v.anyOf ?? []), ...(v.aliases ?? [])];
                names.forEach((n) => declared.add(n));
                if (!names.some((n) => new RegExp(`\\b${n}\\b`).test(code)))
                    problems.push(`${p.manifest.name}: envVars nennt ${v.name}, der Code liest es nicht`);
            }
        }
        // Nur direkte Lesungen; Namen ueber Helfer (process.env[name]) prueft die Richtung oben.
        for (const m of code.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
            if (!declared.has(m[1])) problems.push(`${p.manifest.name}: liest ${m[1]}, src/env.ts nennt es nicht`);
        }
    }
    assert.deepEqual([...new Set(problems)], []);
});
