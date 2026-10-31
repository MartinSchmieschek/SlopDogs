/**
 * `npm run update:dogs` — hebt die gepinnten SlopDogs-Pakete auf das jeweils neueste stabile Release.
 *
 * Gilt fuer den Paket-Betrieb (nach P4.4): core per Git-Tag (`git+https://…/slopdogs-core.git#v<version>`),
 * typedefs und Dog-Pakete per Release-Tarball (`…/releases/download/<tag>/<datei>.tgz`). Die Tags kommen per
 * `git ls-remote` — kein Token, kein API-Kontingent. Gepinnt bleibt es (E2): der Befehl schreibt exakte Versionen
 * in die package.json-Dateien (Wurzel und packages/*) und erneuert danach die Lockdatei per `npm install`.
 *
 *   npm run update:dogs                 anheben und npm install
 *   npm run update:dogs -- --dry-run    nur zeigen, was sich aendern wuerde
 *   npm run update:dogs -- --no-install anheben ohne npm install
 *
 * Im Monorepo (Abhaengigkeiten per file:packages/…) gibt es nichts anzuheben; der Befehl sagt das und endet mit 0.
 * Vorabversionen (z. B. 0.4.0-rc.0) zaehlen nicht als neuestes Release.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCOPE = '@martinschmieschek/slopdogs-';
const CORE_REPO = 'https://github.com/MartinSchmieschek/slopdogs-core';
const DOGS_REPO = 'https://github.com/MartinSchmieschek/slopdogs-base-dogs';
// Peer-Bereiche (^0.3.0) pflegen die Paket-Repos, nicht der Server — hier zaehlen nur feste Pins.
const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const install = !args.has('--no-install') && !dryRun;

/** x.y.z ohne Vorabkennung, sonst null. */
function parseStable(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    return m ? m.slice(1).map(Number) : null;
}

function newer(a, b) {
    const pa = parseStable(a);
    const pb = parseStable(b);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i];
    return false;
}

/** Tag-Namen eines Repos (ohne ^{}-Eintraege). */
function remoteTags(repo) {
    const out = execFileSync('git', ['ls-remote', '--tags', '--refs', `${repo}.git`], { encoding: 'utf8' });
    return out
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[1].replace(/^refs\/tags\//, ''));
}

/** Neueste stabile Version je Paket: core-Repo ueber v<version>, base-dogs ueber <paket>@<version>. */
function latestVersions() {
    const latest = new Map();
    const offer = (name, version) => {
        if (!parseStable(version)) return;
        if (!latest.has(name) || newer(version, latest.get(name))) latest.set(name, version);
    };
    for (const tag of remoteTags(CORE_REPO)) {
        const m = /^v(.+)$/.exec(tag);
        if (!m) continue;
        offer(`${SCOPE}core`, m[1]);
        offer(`${SCOPE}typedefs`, m[1]); // typedefs reist mit core (gleiche Version, Tarball am selben Release)
    }
    for (const tag of remoteTags(DOGS_REPO)) {
        const m = /^(@martinschmieschek\/slopdogs-[^@]+)@(.+)$/.exec(tag);
        if (m) offer(m[1], m[2]);
    }
    return latest;
}

const tarballFile = (name, version) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

/** Spezifikation fuer `name` in `version`, in derselben Form wie `spec`; null, wenn die Form unbekannt ist. */
function specFor(name, spec, version) {
    if (/^git\+https:\/\/github\.com\/MartinSchmieschek\/slopdogs-core\.git#v/.test(spec)) return spec.replace(/#v.+$/, `#v${version}`);
    if (spec.startsWith(`${CORE_REPO}/releases/download/`))
        return `${CORE_REPO}/releases/download/v${version}/${tarballFile(name, version)}`;
    if (spec.startsWith(`${DOGS_REPO}/releases/download/`)) {
        return `${DOGS_REPO}/releases/download/${encodeURIComponent(`${name}@${version}`)}/${tarballFile(name, version)}`;
    }
    if (parseStable(spec)) return version; // Registry-Betrieb (exakte Version)
    return null;
}

/** Version, auf die `spec` heute zeigt; null, wenn nicht ablesbar. */
function pinnedVersion(spec) {
    const m = /#v([^#]+)$/.exec(spec) || /-(\d+\.\d+\.\d+[^/]*)\.tgz$/.exec(spec) || /^(\d+\.\d+\.\d+.*)$/.exec(spec);
    return m ? m[1] : null;
}

function manifestFiles() {
    const files = [path.join(ROOT, 'package.json')];
    const packagesDir = path.join(ROOT, 'packages');
    if (fs.existsSync(packagesDir)) {
        for (const d of fs.readdirSync(packagesDir)) {
            const file = path.join(packagesDir, d, 'package.json');
            if (fs.existsSync(file)) files.push(file);
        }
    }
    return files;
}

function main() {
    const files = manifestFiles();
    const manifests = files.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
    const rootDeps = JSON.parse(manifests[0].text).dependencies || {};
    if (String(rootDeps[`${SCOPE}core`] || '').startsWith('file:')) {
        console.log('[update:dogs] Monorepo: core und Dogs kommen aus packages/ (file:), nichts anzuheben.');
        return;
    }
    const pinned = [];
    for (const m of manifests) {
        const json = JSON.parse(m.text);
        for (const field of FIELDS) {
            for (const [name, spec] of Object.entries(json[field] || {})) {
                if (name.startsWith(SCOPE) && !/^(file:|workspace:|[~^])/.test(String(spec)))
                    pinned.push({ m, field, name, spec: String(spec) });
            }
        }
    }
    if (!pinned.length) {
        console.log('[update:dogs] keine gepinnten SlopDogs-Pakete gefunden.');
        return;
    }

    const latest = latestVersions();
    const changes = [];
    const unknown = [];
    for (const p of pinned) {
        const target = latest.get(p.name);
        const current = pinnedVersion(p.spec);
        if (!target) {
            unknown.push(`${p.name} (kein Release-Tag gefunden)`);
            continue;
        }
        if (current && parseStable(current) && !newer(target, current)) continue;
        const next = specFor(p.name, p.spec, target);
        if (!next) {
            unknown.push(`${p.name} (Form der Spezifikation unbekannt: ${p.spec})`);
            continue;
        }
        changes.push({ ...p, next, from: current, to: target });
    }

    for (const c of changes) {
        console.log(`  ${c.name}: ${c.from ?? '?'} -> ${c.to}  (${path.relative(ROOT, c.m.file)}, ${c.field})`);
    }
    for (const u of unknown) console.warn(`  uebersprungen: ${u}`);
    if (!changes.length) {
        console.log(`[update:dogs] alles aktuell (${pinned.length} gepinnte Eintraege geprueft).`);
        return;
    }
    if (dryRun) {
        console.log(`[update:dogs] --dry-run: ${changes.length} Eintraege wuerden angehoben, nichts geschrieben.`);
        return;
    }

    // Textersatz statt JSON.stringify: Formatierung und Reihenfolge der package.json bleiben, wie sie sind.
    for (const c of changes) {
        const quoted = (s) => JSON.stringify(s);
        const before = `${quoted(c.name)}: ${quoted(c.spec)}`;
        if (!c.m.text.includes(before)) throw new Error(`${c.name} in ${c.m.file} nicht in der erwarteten Form gefunden`);
        c.m.text = c.m.text.replace(before, `${quoted(c.name)}: ${quoted(c.next)}`);
    }
    for (const m of manifests) fs.writeFileSync(m.file, m.text);
    console.log(`[update:dogs] ${changes.length} Eintraege angehoben.`);

    if (install) {
        console.log('[update:dogs] npm install (Lockdatei) ...');
        execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    }
}

main();
