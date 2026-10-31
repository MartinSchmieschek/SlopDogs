#!/usr/bin/env node
'use strict';

/**
 * Schnitt der Pakete in eigene Repos (PLAN-DOG-PAKETE P4.1, P4.2, P4.4) als ausfuehrbare Anleitung.
 * Schreibt nur lokal: legt Repos und Ordner unter <ziel> an, committet dort, setzt kein Remote, pusht nichts,
 * taggt nichts, veroeffentlicht nichts. Die Schritte nach aussen stehen am Ende jedes Laufs als Liste.
 *
 *   node scripts/split-repos.cjs core      <ziel> [--ref <rev>] [--with-worktree] [--version 0.3.0] [--no-lock]
 *   node scripts/split-repos.cjs base-dogs <ziel> [--ref <rev>] [--with-worktree] [--version 0.3.0]
 *                                                 [--core-spec <spec>] [--typedefs-spec <spec>] [--no-lock]
 *   node scripts/split-repos.cjs all       <ziel> [Optionen wie oben]
 *   node scripts/split-repos.cjs server    <ordner> [--ref <rev>] [--with-worktree] [--version 0.3.0]
 *                                                 [--registry | --core-spec <spec> --tarballs <ordner>] [--in-place]
 *
 * core       -> <ziel>/slopdogs-core: `git subtree split` von packages/core (Historie bleibt) als Wurzel, dazu
 *               packages/typedefs per `git subtree split` + `git subtree add` unter typedefs/ (Historie bleibt).
 *               Das Typ-Werkzeug liegt als zweites Paket im Unterordner, wird von core gebaut (`npm run build`) und
 *               mit core veroeffentlicht (gleiche Version, Tag v<version>). Per Git installierbar ist nur core
 *               (Wurzel); typedefs braucht nur, wer Dog-Pakete baut — es kommt ueber Registry oder Release-Tarball (F4).
 * base-dogs  -> <ziel>/slopdogs-base-dogs: packages/dogs-* und packages/geo-pact (dogs-demo ist ein dogs-*) mit
 *               ihrer Historie, Pfade bleiben packages/<x>; core, typedefs und swaggrid fallen heraus.
 *               `git filter-repo`, wenn installiert; sonst `git filter-branch --index-filter` (in Git enthalten,
 *               gleiches Ergebnis: Pfadfilter ueber die ganze Historie, leere Commits fallen weg). `git subtree`
 *               scheidet aus: es schneidet genau einen Ordner und haengt ihn an die Wurzel.
 * server     -> P4.4 an einer Kopie des Server-Baums (oder mit --in-place am Ordner selbst): Pakete raus (bis auf
 *               swaggrid), Abhaengigkeiten exakt auf die Pakete, Projekt-Referenzen, tsconfig-Pfade und ESLint-
 *               Ausgangsliste nachgezogen. --registry: exakte Versionen aus GitHub Packages plus .npmrc mit
 *               ${NPM_TOKEN} (erst mit P4); sonst --core-spec (z. B. Git-Tag) und Tarballs aus --tarballs.
 *
 * Quelle ist immer ein Klon des Repos unter <ziel>/.split-work-*, nie dieser Arbeitsbaum: `git subtree split` und
 * `filter-branch` schreiben Objekte und Refs. --ref waehlt den Commit (Standard HEAD). --with-worktree legt im
 * Klon einen Commit mit den noch nicht committeten Aenderungen dieses Arbeitsbaums obenauf (nur fuer Proben —
 * dieser Commit steht dann in der Historie der Ziel-Repos).
 *
 * Was die Ziel-Repos zusaetzlich zur geschnittenen Quelle brauchen, liegt unter repo-templates/: _shared/ fuer
 * beide, slopdogs-core/ bzw. slopdogs-base-dogs/ je Repo. .prettierrc.json und .nvmrc kommen aus der Wurzel
 * dieses Repos, die ESLint-Ausgangsliste wird aus eslint-suppressions.json gefiltert.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATES = path.join(ROOT, 'repo-templates');
const SCOPE = '@martinschmieschek/slopdogs-';
const REGISTRY = 'https://npm.pkg.github.com';
const OWNER_URL = 'https://github.com/MartinSchmieschek';
/** Pakete, die im Server-Repo bleiben (P4.2: swaggrid ist kein Dog-Paket). */
const SERVER_PACKAGES = new Set(['swaggrid']);
const CORE_REPO_PACKAGES = new Set(['core', 'typedefs']);
const isBaseDogsPackage = (dir) => dir.startsWith('dogs-') || dir === 'geo-pact';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// ---------------------------------------------------------------------------------------------- Hilfen

function run(cmd, args, opts = {}) {
    const started = Date.now();
    const out = execFileSync(cmd, args, {
        encoding: 'utf8',
        stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        shell: opts.shell ?? false,
        maxBuffer: 256 * 1024 * 1024,
    });
    if (opts.timed) log(`  ${opts.timed}: ${((Date.now() - started) / 1000).toFixed(1)} s`);
    return typeof out === 'string' ? out.trim() : '';
}
const git = (cwd, args, opts = {}) => run('git', ['-C', cwd, ...args], opts);
const log = (msg) => console.log(msg);
const posix = (p) => p.split(path.sep).join('/');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function parseArgs(argv) {
    const [command, target, ...rest] = argv;
    const opts = { command, target, ref: 'HEAD', version: '0.3.0', withWorktree: false, lock: true, registry: false, inPlace: false };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === '--ref') opts.ref = rest[++i];
        else if (a === '--version') opts.version = rest[++i];
        else if (a === '--with-worktree') opts.withWorktree = true;
        else if (a === '--no-lock') opts.lock = false;
        else if (a === '--core-spec') opts.coreSpec = rest[++i];
        else if (a === '--typedefs-spec') opts.typedefsSpec = rest[++i];
        else if (a === '--tarballs') opts.tarballs = path.resolve(rest[++i]);
        else if (a === '--registry') opts.registry = true;
        else if (a === '--in-place') opts.inPlace = true;
        else throw new Error(`unbekannte Option ${a}`);
    }
    if (!['core', 'base-dogs', 'all', 'server'].includes(command) || !target) {
        console.error(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
        process.exit(2);
    }
    opts.target = path.resolve(target);
    if (opts.target === ROOT || ROOT.startsWith(opts.target + path.sep)) {
        if (!(command === 'server' && opts.inPlace)) throw new Error(`Ziel ${opts.target} ist dieser Arbeitsbaum oder liegt darueber`);
    }
    return opts;
}

/**
 * Kopiert einen Template-Ordner rekursiv. Im Server-Repo duerfen die Vorlagen nicht wirken: `gitignore` wird erst
 * im Ziel zu `.gitignore`, `eslint.config.template.mjs` erst dort zu `eslint.config.mjs` (ESLint 10 sucht die
 * Konfiguration je Datei im naechsten Ordner — die Vorlage wuerde sonst die Server-Konfiguration fuer
 * repo-templates/ ersetzen). `*.template.json`/`*.overlay.json` verarbeitet der Aufrufer selbst.
 */
function copyTemplate(from, to) {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, entry.name);
        if (entry.isDirectory()) {
            copyTemplate(src, path.join(to, entry.name));
            continue;
        }
        if (/\.(template|overlay)\.json$/.test(entry.name)) continue;
        const name = entry.name === 'gitignore' ? '.gitignore' : entry.name.replace(/\.template\.mjs$/, '.mjs');
        fs.mkdirSync(to, { recursive: true });
        fs.copyFileSync(src, path.join(to, name));
    }
}

/** Ersetzt {{PLATZHALTER}} in einem JSON-Wert rekursiv. */
function fill(value, vars) {
    if (typeof value === 'string')
        return value.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => {
            if (!(k in vars)) throw new Error(`Platzhalter {{${k}}} ohne Wert`);
            return vars[k];
        });
    if (Array.isArray(value)) return value.map((v) => fill(v, vars));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, vars)]));
    return value;
}

/** Werkzeug-Versionen fuer die Ziel-Repos: dieselben wie im Server (P3.1). */
function toolVersions(sourceDir) {
    const pkg = readJson(path.join(sourceDir, 'package.json'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    return {
        ESLINT_VERSION: all.eslint,
        PRETTIER_VERSION: all.prettier,
        TYPESCRIPT_VERSION: all.typescript,
        TYPESCRIPT_ESLINT_VERSION: all['typescript-eslint'],
    };
}

/** Die ESLint-Ausgangsliste des Servers, gefiltert auf `prefix` und umgeschrieben auf `replacement`. */
function filteredSuppressions(sourceDir, rules) {
    const file = path.join(sourceDir, 'eslint-suppressions.json');
    if (!fs.existsSync(file)) return {};
    const out = {};
    for (const [key, value] of Object.entries(readJson(file))) {
        for (const [prefix, replacement] of rules) {
            if (key.startsWith(prefix)) {
                out[replacement + key.slice(prefix.length)] = value;
                break;
            }
        }
    }
    return out;
}

/** JSONC (tsconfig) lesen: Kommentarkopf behalten, Rumpf als Objekt. */
function readJsonc(file) {
    const ts = require('typescript');
    const text = fs.readFileSync(file, 'utf8');
    const { config, error } = ts.parseConfigFileTextToJson(file, text);
    if (error) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    const header = text.slice(0, text.indexOf('{')).trimEnd();
    return { config, header };
}
function writeJsonc(file, { config, header }) {
    fs.writeFileSync(file, (header ? header + '\n' : '') + JSON.stringify(config, null, 2) + '\n');
}

// ---------------------------------------------------------------------------------------------- Quelle

/**
 * Klon des Repos unter <ziel>/<name>, ausgecheckt auf --ref; mit --with-worktree plus ein Commit mit dem Stand
 * dieses Arbeitsbaums (geaendert, neu und nicht ignoriert, geloescht).
 */
function prepareSource(opts, name) {
    const work = path.join(opts.target, name);
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(opts.target, { recursive: true });
    const rev = git(ROOT, ['rev-parse', '--verify', `${opts.ref}^{commit}`]);
    run('git', ['clone', '--quiet', '--no-local', '--no-checkout', ROOT, work], { timed: `Klon ${name}` });
    git(work, ['checkout', '--quiet', '--detach', rev]);
    if (opts.withWorktree) overlayWorktree(work, rev);
    return { work, rev: git(work, ['rev-parse', 'HEAD']), sourceRev: rev };
}

function overlayWorktree(work, rev) {
    const list = (args) =>
        git(ROOT, ['ls-files', '-z', ...args])
            .split('\0')
            .filter(Boolean);
    const present = list(['-c', '-o', '--exclude-standard']);
    const deleted = new Set(list(['-d']));
    let copied = 0;
    for (const rel of present) {
        if (deleted.has(rel)) continue;
        const src = path.join(ROOT, rel);
        if (!fs.existsSync(src) || fs.statSync(src).isDirectory()) continue;
        const dst = path.join(work, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        copied++;
    }
    for (const rel of deleted) fs.rmSync(path.join(work, rel), { force: true });
    git(work, ['add', '-A']);
    const staged = git(work, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    if (!staged.length) {
        log(`  Arbeitsbaum = ${rev.slice(0, 7)}, kein Zusatz-Commit`);
        return;
    }
    git(work, [
        'commit',
        '--quiet',
        '--no-verify',
        '-m',
        `Arbeitsstand auf ${rev.slice(0, 7)} mit nicht committeten Aenderungen (nur Probe, split-repos --with-worktree)`,
    ]);
    log(`  Arbeitsstand obenauf: ${staged.length} Dateien geaendert (${copied} kopiert, ${deleted.size} geloescht)`);
}

/** Neues Repo aus einem Branch des Klons: eigener Klon, Remote entfernt, Branch main. */
function repoFromBranch(work, branch, dir) {
    if (fs.existsSync(dir)) throw new Error(`${dir} gibt es schon — vorher wegraeumen`);
    run('git', ['clone', '--quiet', '--no-local', '--branch', branch, work, dir]);
    git(dir, ['remote', 'remove', 'origin']);
    git(dir, ['branch', '-m', branch, 'main']);
}

function commitAll(dir, message) {
    git(dir, ['add', '-A']);
    git(dir, ['commit', '--quiet', '--no-verify', '-m', message]);
    return git(dir, ['rev-parse', '--short', 'HEAD']);
}

function lockfile(dir, opts, why) {
    if (!opts.lock) return log(`  package-lock.json: uebersprungen (--no-lock)`);
    if (why) return log(`  package-lock.json: nicht erzeugt — ${why}`);
    run(npm, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: dir,
        shell: process.platform === 'win32',
        timed: 'package-lock.json',
    });
}

// ---------------------------------------------------------------------------------------------- Manifeste

/**
 * Manifest eines Pakets fuer sein Ziel-Repo: Version, nicht mehr private, Repository, publishConfig; Peers auf
 * `^<version>`; `file:`-Abhaengigkeiten auf die Spezifikation aus `specs` (core, typedefs) oder `^<version>`
 * (Geschwister im selben Workspace).
 */
function rewriteManifest(manifest, { version, repoUrl, directory, specs }) {
    const out = {};
    for (const [key, value] of Object.entries(manifest)) {
        if (key === 'private') continue;
        if (key === 'version') out.version = version;
        else if (key === 'repository') {
            out.repository = { type: 'git', url: repoUrl, ...(directory ? { directory } : {}) };
            out.publishConfig = { registry: REGISTRY };
        } else out[key] = value;
    }
    if (!out.publishConfig) out.publishConfig = { registry: REGISTRY };
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        const deps = out[field];
        if (!deps) continue;
        for (const [name, spec] of Object.entries(deps)) {
            if (!name.startsWith(SCOPE)) continue;
            const short = name.slice(SCOPE.length);
            if (field === 'peerDependencies') deps[name] = `^${version}`;
            else if (String(spec).startsWith('file:')) deps[name] = specs[short] ?? `^${version}`;
        }
    }
    return out;
}

// ---------------------------------------------------------------------------------------------- core

function splitCore(opts) {
    log(`\n[core] Quelle ${opts.ref}${opts.withWorktree ? ' + Arbeitsbaum' : ''}`);
    const { work, rev, sourceRev } = prepareSource(opts, '.split-work-core');
    git(work, ['subtree', 'split', '--prefix=packages/core', '-b', 'split-core', rev], { timed: 'subtree split packages/core' });
    git(work, ['subtree', 'split', '--prefix=packages/typedefs', '-b', 'split-typedefs', rev], {
        timed: 'subtree split packages/typedefs',
    });
    const dir = path.join(opts.target, 'slopdogs-core');
    repoFromBranch(work, 'split-core', dir);
    git(
        dir,
        [
            'subtree',
            'add',
            '--prefix=typedefs',
            work,
            'split-typedefs',
            '-m',
            `Typ-Werkzeug aus SlopDogs packages/typedefs (${sourceRev.slice(0, 7)}) mit Historie unter typedefs/`,
        ],
        {
            timed: 'subtree add typedefs/',
        },
    );

    const tools = toolVersions(work);
    // core: Wurzelpaket
    const corePkg = rewriteManifest(readJson(path.join(dir, 'package.json')), {
        version: opts.version,
        repoUrl: `${OWNER_URL}/slopdogs-core.git`,
        specs: {},
    });
    const overlay = fill(readJson(path.join(TEMPLATES, 'slopdogs-core', 'package.overlay.json')), tools);
    corePkg.repository = overlay.repository;
    corePkg.publishConfig = overlay.publishConfig;
    corePkg.scripts = { ...corePkg.scripts, ...overlay.scripts };
    // typedefs liegt im Repo und wird ueber den Pfad gebaut: keine devDependency, kein Registry-Zugriff beim Git-Weg.
    const devDependencies = { ...corePkg.devDependencies, ...overlay.devDependencies };
    delete devDependencies[`${SCOPE}typedefs`];
    corePkg.devDependencies = Object.fromEntries(Object.entries(devDependencies).sort(([a], [b]) => a.localeCompare(b)));
    writeJson(path.join(dir, 'package.json'), corePkg);
    // typedefs: zweites Paket im Unterordner, gleiche Version
    const toolPkg = rewriteManifest(readJson(path.join(dir, 'typedefs', 'package.json')), {
        version: opts.version,
        repoUrl: `${OWNER_URL}/slopdogs-core.git`,
        directory: 'typedefs',
        specs: {},
    });
    writeJson(path.join(dir, 'typedefs', 'package.json'), toolPkg);
    // tsconfig: Basis aus dem Unterordner statt aus node_modules; Monorepo-Referenzen gibt es hier nicht.
    const tsconfig = path.join(dir, 'tsconfig.json');
    fs.writeFileSync(
        tsconfig,
        fs
            .readFileSync(tsconfig, 'utf8')
            .replace('"@martinschmieschek/slopdogs-typedefs/tsconfig.base.json"', '"./typedefs/tsconfig.base.json"'),
    );
    for (const f of ['tsconfig.monorepo.json', path.join('typedefs', 'tsconfig.monorepo.json')])
        fs.rmSync(path.join(dir, f), { force: true });

    copyTemplate(path.join(TEMPLATES, '_shared'), dir);
    copyTemplate(path.join(TEMPLATES, 'slopdogs-core'), dir);
    for (const f of ['.prettierrc.json', '.nvmrc']) fs.copyFileSync(path.join(work, f), path.join(dir, f));
    // MIT-Lizenz aus SlopDogs: Repo-Wurzel (= Paket core) und typedefs/, damit jeder Tarball sie traegt.
    for (const to of ['LICENSE', path.join('typedefs', 'LICENSE')]) fs.copyFileSync(path.join(work, 'LICENSE'), path.join(dir, to));
    writeJson(
        path.join(dir, 'eslint-suppressions.json'),
        filteredSuppressions(work, [
            ['packages/core/', ''],
            ['packages/typedefs/', 'typedefs/'],
        ]),
    );
    lockfile(dir, opts);
    const head = commitAll(
        dir,
        `chore(repo): slopdogs-core ${opts.version} — Geruest aus SlopDogs repo-templates (PLAN-DOG-PAKETE P3, P4.1)`,
    );
    log(`[core] ${dir} auf main ${head}; ${git(dir, ['rev-list', '--count', 'HEAD'])} Commits`);
    return dir;
}

// ---------------------------------------------------------------------------------------------- base-dogs

function hasFilterRepo() {
    try {
        run('git', ['filter-repo', '--version']);
        return true;
    } catch {
        return false;
    }
}

function splitBaseDogs(opts) {
    log(`\n[base-dogs] Quelle ${opts.ref}${opts.withWorktree ? ' + Arbeitsbaum' : ''}`);
    const { work, rev } = prepareSource(opts, '.split-work-base-dogs');
    // Was aus der Wurzel gebraucht wird, vor dem Filter sichern — danach liegen im Klon nur noch die Pakete.
    const rootFiles = path.join(opts.target, '.split-work-base-dogs-root');
    fs.rmSync(rootFiles, { recursive: true, force: true });
    fs.mkdirSync(rootFiles, { recursive: true });
    for (const f of ['package.json', '.prettierrc.json', '.nvmrc', 'eslint-suppressions.json', 'LICENSE']) {
        if (fs.existsSync(path.join(work, f))) fs.copyFileSync(path.join(work, f), path.join(rootFiles, f));
    }
    git(work, ['checkout', '--quiet', '-b', 'split-base-dogs', rev]);
    if (hasFilterRepo()) {
        // Ungemessen auf diesem Rechner (git-filter-repo nicht installiert, 31.10.); gleiche Pfadwahl wie unten.
        git(
            work,
            [
                'filter-repo',
                '--force',
                '--refs',
                'split-base-dogs',
                '--path',
                'packages/geo-pact/',
                '--path-regex',
                '^packages/dogs-[^/]+/',
            ],
            {
                timed: 'filter-repo',
            },
        );
    } else {
        log('  git filter-repo ist nicht installiert — git filter-branch --index-filter (gleicher Pfadfilter)');
        git(
            work,
            [
                'filter-branch',
                '-f',
                '--prune-empty',
                '--index-filter',
                `git rm -r -q --cached --ignore-unmatch -- . ':(exclude)packages/dogs-*' ':(exclude)packages/geo-pact'`,
                '--',
                'split-base-dogs',
            ],
            { env: { FILTER_BRANCH_SQUELCH_WARNING: '1' }, timed: 'filter-branch' },
        );
    }
    const dir = path.join(opts.target, 'slopdogs-base-dogs');
    repoFromBranch(work, 'split-base-dogs', dir);
    const stray = git(dir, ['ls-files'])
        .split('\n')
        .filter((f) => f && !/^packages\/(dogs-[^/]+|geo-pact)\//.test(f));
    if (stray.length) throw new Error(`Filter liess fremde Dateien stehen: ${stray.slice(0, 5).join(', ')}`);

    const packagesDir = path.join(dir, 'packages');
    const names = fs
        .readdirSync(packagesDir)
        .filter((d) => isBaseDogsPackage(d) && fs.existsSync(path.join(packagesDir, d, 'package.json')));
    const specs = { core: opts.coreSpec ?? `^${opts.version}`, typedefs: opts.typedefsSpec ?? `^${opts.version}` };
    for (const name of names) {
        const pkgDir = path.join(packagesDir, name);
        const manifest = rewriteManifest(readJson(path.join(pkgDir, 'package.json')), {
            version: opts.version,
            repoUrl: `${OWNER_URL}/slopdogs-base-dogs.git`,
            directory: `packages/${name}`,
            specs,
        });
        writeJson(path.join(pkgDir, 'package.json'), manifest);
        const mono = path.join(pkgDir, 'tsconfig.monorepo.json');
        if (fs.existsSync(mono)) {
            const parsed = readJsonc(mono);
            // core und typedefs kommen hier aus node_modules (gebaute .d.ts), nicht als Projekt-Referenz.
            const refs = (parsed.config.references || []).filter((r) => !/^\.\.\/(core|typedefs)\//.test(r.path));
            if (refs.length) parsed.config.references = refs;
            else delete parsed.config.references;
            writeJsonc(mono, parsed);
        }
    }
    writeJson(path.join(dir, 'tsconfig.packages.json'), {
        files: [],
        references: names.map((n) => ({ path: `./packages/${n}/tsconfig.monorepo.json` })),
    });

    const tools = toolVersions(rootFiles);
    writeJson(
        path.join(dir, 'package.json'),
        fill(readJson(path.join(TEMPLATES, 'slopdogs-base-dogs', 'package.template.json')), {
            ...tools,
            CORE_SPEC: specs.core,
            TYPEDEFS_SPEC: specs.typedefs,
        }),
    );
    copyTemplate(path.join(TEMPLATES, '_shared'), dir);
    copyTemplate(path.join(TEMPLATES, 'slopdogs-base-dogs'), dir);
    for (const f of ['.prettierrc.json', '.nvmrc']) fs.copyFileSync(path.join(rootFiles, f), path.join(dir, f));
    // MIT-Lizenz aus SlopDogs: Repo-Wurzel und jedes Paket (npm pack eines Unterordners nimmt die Wurzel nicht mit).
    for (const to of ['LICENSE', ...names.map((n) => path.join('packages', n, 'LICENSE'))])
        fs.copyFileSync(path.join(rootFiles, 'LICENSE'), path.join(dir, to));
    writeJson(
        path.join(dir, 'eslint-suppressions.json'),
        filteredSuppressions(
            rootFiles,
            names.map((n) => [`packages/${n}/`, `packages/${n}/`]),
        ),
    );
    const fromRegistry = !opts.coreSpec || !opts.typedefsSpec;
    lockfile(
        dir,
        opts,
        fromRegistry ? 'core/typedefs kommen aus GitHub Packages; erst nach deren Release `npm install` und Lock committen' : null,
    );
    const head = commitAll(
        dir,
        `chore(repo): slopdogs-base-dogs ${opts.version} — Geruest aus SlopDogs repo-templates (PLAN-DOG-PAKETE P3, P4.2)`,
    );
    log(`[base-dogs] ${dir} auf main ${head}; ${names.length} Pakete, ${git(dir, ['rev-list', '--count', 'HEAD'])} Commits`);
    return dir;
}

// ---------------------------------------------------------------------------------------------- Server (P4.4)

function copyServerTree(opts) {
    const { work } = prepareSource(opts, '.split-work-server');
    const dir = opts.target;
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => !f.startsWith('.split-work'))) throw new Error(`${dir} ist nicht leer`);
    const files = git(work, ['ls-files', '-z']).split('\0').filter(Boolean);
    for (const rel of files) {
        const dst = path.join(dir, rel);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(path.join(work, rel), dst);
    }
    fs.rmSync(work, { recursive: true, force: true });
    // Eigenes Wegwerf-Repo: format:check und ESLint lesen die Dateiliste aus git, und der Schnitt wird als Diff sichtbar.
    git(dir, ['init', '--quiet', '-b', 'main']);
    commitAll(dir, `Server-Kopie von ${opts.ref}${opts.withWorktree ? ' + Arbeitsbaum' : ''} (Probe, split-repos server)`);
    log(`  ${files.length} Dateien kopiert und als Repo angelegt (ohne node_modules, dist, .env — was git nicht kennt, fehlt)`);
    return dir;
}

function tarballFor(dir, name, version) {
    const file = path.join(dir, `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`);
    if (!fs.existsSync(file)) throw new Error(`Tarball fehlt: ${file}`);
    return `file:${posix(file)}`;
}

function cutServer(opts) {
    log(`\n[server] P4.4 ${opts.inPlace ? 'am Ordner' : 'an einer Kopie'}: ${opts.target}`);
    if (!opts.registry && !(opts.coreSpec && opts.tarballs)) throw new Error('server braucht --registry oder --core-spec und --tarballs');
    const dir = opts.inPlace ? opts.target : copyServerTree(opts);
    const packagesDir = path.join(dir, 'packages');
    const removed = fs
        .readdirSync(packagesDir)
        .filter((d) => !SERVER_PACKAGES.has(d) && (CORE_REPO_PACKAGES.has(d) || isBaseDogsPackage(d)));
    for (const d of removed) fs.rmSync(path.join(packagesDir, d), { recursive: true, force: true });

    const specFor = (short) => {
        const name = SCOPE + short;
        if (opts.registry) return opts.version;
        if (short === 'core') return opts.coreSpec;
        return tarballFor(opts.tarballs, name, opts.version);
    };
    const pkgFile = path.join(dir, 'package.json');
    const pkg = readJson(pkgFile);
    let rewired = 0;
    for (const [name, spec] of Object.entries(pkg.dependencies)) {
        const m = /^file:packages\/(.+)$/.exec(String(spec));
        if (!m || !removed.includes(m[1])) continue;
        pkg.dependencies[name] = specFor(name.slice(SCOPE.length));
        rewired++;
    }
    writeJson(pkgFile, pkg);
    // swaggrid baut weiter im Server; sein Typ-Werkzeug ist jetzt dasselbe wie das des Servers (eine Kopie).
    for (const d of fs.readdirSync(packagesDir)) {
        const file = path.join(packagesDir, d, 'package.json');
        if (!fs.existsSync(file)) continue;
        const m = readJson(file);
        for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
            for (const [name, spec] of Object.entries(m[field] || {})) {
                const ref = /^file:\.\.\/(.+)$/.exec(String(spec));
                if (ref && removed.includes(ref[1])) m[field][name] = pkg.dependencies[name] ?? specFor(ref[1]);
            }
        }
        writeJson(file, m);
        const mono = path.join(packagesDir, d, 'tsconfig.monorepo.json');
        if (fs.existsSync(mono)) {
            const parsed = readJsonc(mono);
            const refs = (parsed.config.references || []).filter((r) => !removed.includes(posix(r.path).split('/')[1]));
            if (refs.length) parsed.config.references = refs;
            else delete parsed.config.references;
            writeJsonc(mono, parsed);
        }
    }
    // Projekt-Referenzen: nur noch, was hier liegt.
    const solutionFile = path.join(dir, 'tsconfig.packages.json');
    const solution = readJson(solutionFile);
    solution.references = solution.references.filter((r) => !removed.includes(posix(r.path).split('/')[2]));
    writeJson(solutionFile, solution);
    // tsconfig-Pfade auf packages/<x>/src: fuer entfernte Pakete gibt es keine Quelle mehr (Aufloesung aus node_modules).
    const tsconfigFile = path.join(dir, 'tsconfig.json');
    const before = fs.readFileSync(tsconfigFile, 'utf8').split('\n');
    const after = before.filter((line) => {
        const m = /^\s*"@martinschmieschek\/slopdogs-[^"]+":\s*\["packages\/([^/"]+)\//.exec(line);
        return !(m && removed.includes(m[1]));
    });
    fs.writeFileSync(tsconfigFile, after.join('\n'));
    // ESLint-Ausgangsliste: Eintraege fuer Dateien, die es hier nicht mehr gibt, liesse ESLint scheitern.
    const supFile = path.join(dir, 'eslint-suppressions.json');
    const sup = readJson(supFile);
    const kept = Object.fromEntries(Object.entries(sup).filter(([k]) => !removed.some((d) => k.startsWith(`packages/${d}/`))));
    writeJson(supFile, kept);
    if (opts.registry) {
        fs.writeFileSync(
            path.join(dir, '.npmrc'),
            `@martinschmieschek:registry=${REGISTRY}\n//npm.pkg.github.com/:_authToken=\${NPM_TOKEN}\n`,
        );
    }
    if (!opts.inPlace)
        commitAll(dir, `P4.4: Pakete aus ${opts.registry ? 'GitHub Packages' : 'Git-Tag und Tarballs'} statt packages/ (Probe)`);
    log(
        `[server] ${removed.length} Pakete entfernt, ${rewired} Abhaengigkeiten umgestellt, tsconfig-Pfade ${before.length - after.length} weniger, ` +
            `ESLint-Ausgangsliste ${Object.keys(sup).length} -> ${Object.keys(kept).length} Dateien${opts.registry ? ', .npmrc geschrieben' : ''}`,
    );
    log('  weiter: npm install (Lock), npm ci, npm test, npm run test:startup, build:prod, build:local');
}

// ---------------------------------------------------------------------------------------------- Ablauf

function nextSteps(opts) {
    log(`
Nach aussen (nur auf Wort des 10-0), in dieser Reihenfolge:
  1. GitHub: Repos MartinSchmieschek/slopdogs-core und MartinSchmieschek/slopdogs-base-dogs anlegen (leer).
  2. slopdogs-core: Remote setzen, main pushen, Tag v${opts.version} pushen -> release.yml veroeffentlicht core und typedefs.
  3. Paket slopdogs-core und slopdogs-typedefs in GitHub Packages: Manage Actions access -> slopdogs-base-dogs (read)
     und SlopDogs (read).
  4. slopdogs-base-dogs: npm install (Lock gegen die veroeffentlichten core/typedefs), committen, Remote, main pushen,
     dann je Paket den Tag <paket>@${opts.version} einzeln pushen (GitHub startet bei mehr als drei Tags je Push nichts).
  5. Server: node scripts/split-repos.cjs server <checkout> --registry --in-place auf einem Branch, npm install,
     Render-Env NPM_TOKEN (read:packages) setzen, PR, Deploy.`);
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const started = Date.now();
    if (opts.command === 'core' || opts.command === 'all') splitCore(opts);
    if (opts.command === 'base-dogs' || opts.command === 'all') splitBaseDogs(opts);
    if (opts.command === 'server') cutServer(opts);
    for (const name of ['.split-work-core', '.split-work-base-dogs', '.split-work-base-dogs-root'])
        fs.rmSync(path.join(opts.target, name), { recursive: true, force: true });
    log(`\nfertig in ${((Date.now() - started) / 1000).toFixed(1)} s — nichts gepusht, kein Remote, keine Tags`);
    if (opts.command !== 'server') nextSteps(opts);
}

try {
    main();
} catch (err) {
    console.error(`[split-repos] ${err instanceof Error ? err.message : err}`);
    if (err && err.stderr) console.error(String(err.stderr).trim());
    process.exit(1);
}
