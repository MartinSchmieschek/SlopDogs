#!/usr/bin/env node
'use strict';

/**
 * Surface-Pruefung gegen die zuletzt veroeffentlichte Fassung (PLAN-DOG-PAKETE P2.6, P3.3).
 *
 *   node scripts/surface-check.cjs [<paketordner> ...] [--baseline <ordner mit .tgz>]
 *
 * Je Paket (Standard: jedes Paket dieses Repos mit `slopdogs.surface` in der package.json):
 *   1. Vorfassung bestimmen: die hoechste veroeffentlichte Version <= der eigenen. Quelle ist die Registry
 *      (`npm view <name> versions`, GitHub Packages ueber .npmrc) oder mit --baseline ein Ordner mit
 *      `npm pack`-Tarballs (lokale Probe, Release-Tarballs).
 *   2. Deren `dist/surface.json` aus dem Tarball holen (`npm pack <name>@<version>` bzw. die Datei im Ordner).
 *   3. `slopdogs-typedefs surface --check <alt> --package <ordner>`: Exit 1, wenn etwas entfernt, umbenannt
 *      oder ein Pact-Typ geaendert wurde und die Version keinen Major-Sprung macht.
 * Gibt es noch keine Vorfassung (erstes Release), wird das Paket uebersprungen und so benannt.
 *
 * Voraussetzung: das Paket ist gebaut (`dist/surface.json` liegt vor). Exit 1, sobald ein Paket bricht.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function parseArgs(argv) {
    const dirs = [];
    let baseline = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--baseline') baseline = path.resolve(argv[++i]);
        else dirs.push(path.resolve(argv[i]));
    }
    return { dirs, baseline };
}

function readManifest(dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

/** Alle Pakete dieses Repos: die Wurzel (slopdogs-core) und jeder Workspace-Ordner unter packages/ bzw. typedefs/. */
function repoPackages() {
    const dirs = [root];
    for (const parent of ['packages']) {
        const base = path.join(root, parent);
        if (!fs.existsSync(base)) continue;
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'package.json'))) dirs.push(path.join(base, entry.name));
        }
    }
    return dirs;
}

/** semver-Vergleich ohne Abhaengigkeit: major.minor.patch, eine Vorabversion ist kleiner als die Freigabe. */
function compareVersions(a, b) {
    const parse = (v) => {
        const [core, pre] = String(v).split('-', 2);
        return { nums: core.split('.').map((n) => Number(n) || 0), pre: pre ?? null };
    };
    const x = parse(a);
    const y = parse(b);
    for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
    if (x.pre === y.pre) return 0;
    if (x.pre === null) return 1;
    if (y.pre === null) return -1;
    return x.pre < y.pre ? -1 : 1;
}

function newestNotAbove(versions, current) {
    return (
        versions
            .filter((v) => compareVersions(v, current) <= 0)
            .sort(compareVersions)
            .pop() ?? null
    );
}

/** Dateiname, den `npm pack` fuer ein Paket schreibt: @scope/name@1.2.3 -> scope-name-1.2.3.tgz */
function tarballPrefix(name) {
    return name.replace(/^@/, '').replace('/', '-') + '-';
}

function previousFromBaseline(name, current, dir) {
    const prefix = tarballPrefix(name);
    const byVersion = new Map();
    for (const file of fs.readdirSync(dir)) {
        if (!file.startsWith(prefix) || !file.endsWith('.tgz')) continue;
        const version = file.slice(prefix.length, -'.tgz'.length);
        if (/^\d+\.\d+\.\d+/.test(version)) byVersion.set(version, path.join(dir, file));
    }
    const version = newestNotAbove([...byVersion.keys()], current);
    return version ? { version, tarball: byVersion.get(version) } : null;
}

function previousFromRegistry(name, current, tmp) {
    let versions;
    try {
        const out = execFileSync(npm, ['view', name, 'versions', '--json'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        });
        const parsed = JSON.parse(out || '[]');
        versions = Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
        const text = String(err.stderr || err.message);
        if (/E404|404 Not Found|is not in this registry/i.test(text)) return null;
        throw new Error(`npm view ${name}: ${text.trim().split('\n').slice(-3).join(' ')}`);
    }
    const version = newestNotAbove(versions, current);
    if (!version) return null;
    const out = execFileSync(npm, ['pack', `${name}@${version}`, '--pack-destination', tmp, '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
    });
    const [{ filename }] = JSON.parse(out);
    return { version, tarball: path.join(tmp, path.basename(filename)) };
}

function extractSurface(tarball, surfaceRel, tmp) {
    const target = path.join(tmp, `x-${path.basename(tarball, '.tgz')}`);
    fs.mkdirSync(target, { recursive: true });
    // tar liegt auf Linux, macOS und Windows 10+ (bsdtar) bei; -C statt absoluter Pfade, weil GNU tar "C:" als Host liest.
    execFileSync('tar', ['-xzf', path.basename(tarball), '-C', path.relative(path.dirname(tarball), target), `package/${surfaceRel}`], {
        cwd: path.dirname(tarball),
        stdio: ['ignore', 'ignore', 'pipe'],
    });
    return path.join(target, 'package', surfaceRel);
}

/** Versionen, fuer die es einen Release-Tag gibt: `v<version>` fuer das Wurzelpaket, sonst `<name>@<version>`. */
function taggedVersions(name, isRoot) {
    let tags;
    try {
        tags = execFileSync('git', ['-C', root, 'tag', '--list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/);
    } catch {
        return [];
    }
    const prefix = isRoot ? 'v' : `${name}@`;
    return tags.filter((t) => t.startsWith(prefix) && /^\d+\.\d+\.\d+/.test(t.slice(prefix.length))).map((t) => t.slice(prefix.length));
}

function typedefsCli() {
    const local = path.join(root, 'typedefs', 'bin', 'slopdogs-typedefs.cjs');
    if (fs.existsSync(local)) return local;
    const pj = require.resolve('@martinschmieschek/slopdogs-typedefs/package.json', { paths: [root] });
    return path.join(path.dirname(pj), 'bin', 'slopdogs-typedefs.cjs');
}

function main() {
    const { dirs, baseline } = parseArgs(process.argv.slice(2));
    const targets = (dirs.length ? dirs : repoPackages()).filter((dir) => readManifest(dir).slopdogs?.surface);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'surface-check-'));
    const cli = typedefsCli();
    let broken = 0;
    let checked = 0;
    let first = 0;
    try {
        for (const dir of targets) {
            const manifest = readManifest(dir);
            const surfaceRel = manifest.slopdogs.surface;
            if (!fs.existsSync(path.join(dir, surfaceRel)))
                throw new Error(`${manifest.name}: ${surfaceRel} fehlt — erst bauen (npm run build).`);
            const prev = baseline
                ? previousFromBaseline(manifest.name, manifest.version, baseline)
                : previousFromRegistry(manifest.name, manifest.version, tmp);
            if (!prev) {
                // Gegenprobe ueber die Git-Tags: wurde schon eine kleinere Version getaggt, muss es eine Vorfassung geben.
                // Liefert die Registry dann nichts, fehlt Lesezugriff (GitHub Packages antwortet dann ebenfalls 404).
                const tagged = taggedVersions(manifest.name, dir === root).filter((v) => compareVersions(v, manifest.version) < 0);
                if (tagged.length)
                    throw new Error(
                        `${manifest.name}: ${tagged.sort(compareVersions).pop()} ist getaggt, aber keine Vorfassung lesbar — Zugriff auf die Registry pruefen (NODE_AUTH_TOKEN, Manage Actions access)`,
                    );
                console.log(
                    `[surface-check] ${manifest.name}@${manifest.version}: keine Vorfassung veroeffentlicht — erstes Release, nichts zu vergleichen`,
                );
                first++;
                continue;
            }
            const oldSurface = extractSurface(prev.tarball, surfaceRel, tmp);
            try {
                execFileSync(process.execPath, [cli, 'surface', '--check', oldSurface, '--package', dir], { stdio: 'inherit' });
            } catch {
                broken++;
            }
            checked++;
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`[surface-check] ${checked} gegen Vorfassung geprueft, ${first} ohne Vorfassung, ${broken} gebrochen`);
    process.exit(broken ? 1 : 0);
}

try {
    main();
} catch (err) {
    console.error(`[surface-check] ${err instanceof Error ? err.message : err}`);
    process.exit(1);
}
