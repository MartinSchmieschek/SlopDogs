/**
 * Prueft den Env-Katalog (server-app/startupEnvCheck.ts, ENV_CATALOG) in zwei Richtungen:
 *
 *   a) Code -> Katalog: jede Env-Variable, die der Server-Code liest, steht im Katalog (als Name oder alias).
 *      Gelesen wird ueber den Syntaxbaum (typescript-API, auch fuer .cjs/.mjs), nicht per Regex:
 *        - process.env.X, process.env['X'], env.X / env['X'] auf einem Env-Objekt (Bezeichner env, *Env, .env)
 *        - const { X } = process.env
 *        - env[name] mit name aus einer konstanten Liste (for (const name of ['X', 'Y'])) oder einem String-const
 *        - Helfer, die einen Namen als Parameter bekommen und env[param] lesen (positiveFromEnv, envFirst,
 *          parseEnvPositiveInt, …): sie werden im Code selbst erkannt, ihre Aufrufe liefern die Namen.
 *      Schreibzugriffe (env.X = …, delete env.X) zaehlen nicht als Lesung.
 *   b) Katalog -> Beispiele: jeder Katalog-Name steht in .env.example und .env.integration.example, in seinem
 *      Abschnitt (Ueberschriften aus ENV_SECTIONS, in Katalog-Reihenfolge) und in Katalog-Reihenfolge — die
 *      Regeln des frueheren StartupTest testEnvCatalogWarnings (bis ef9f8af).
 *
 * Exit 1 mit Liste bei Luecken, sonst eine OK-Zeile.
 * Aufruf (Repo-Root): node -r ts-node/register scripts/check-env-catalog.cjs   (--list: alle gelesenen Namen mit Fundstelle)
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const TAG = '[check-env-catalog]';

/** Server-Code: Wurzeln relativ zum Repo. Verzeichnisse rekursiv, Dateien einzeln. */
const SCAN_ROOTS = ['main.ts', 'api', 'mcp', 'server-app', 'services', 'store', 'server-registries', 'seed-data', 'scripts', 'packages'];

/** Nie durchsuchen: generierter Code, Bauergebnisse, Tests. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated', 'test', '__tests__']);

/**
 * Werkzeuge in scripts/, die weder zur Laufzeit noch beim Build laufen (Pruefungen, Messungen, Testlaeufer):
 * ihre Schalter gehoeren nicht in den Betriebs-Katalog.
 */
const SKIP_FILES = new Set([
    'scripts/check-env-catalog.cjs',
    'scripts/check-integration-dog-coverage.cjs',
    'scripts/check-doc-paths.cjs',
    'scripts/typecheck-packages.cjs',
    'scripts/run-startup-tests.cjs',
    'scripts/compare-registry-heap.cjs',
    'scripts/registry-heap-child.cjs',
]);

const SOURCE_EXT = /\.(ts|cts|mts|js|cjs|mjs)$/;

/**
 * Bewusst nicht im Katalog: Namen, die der Code liest, die aber die Laufzeitumgebung selbst setzt — niemand traegt
 * sie in eine .env-Datei ein. Je Name eine Begruendung. Liest den Namen niemand mehr, schlaegt die Pruefung an
 * (die Liste soll nicht verrotten).
 */
const NOT_CATALOGED = new Map([
    ['container', 'setzen systemd-nspawn/Podman selbst; LocalMode.detectContainer liest es nur als Container-Indiz'],
    ['npm_command', 'setzt npm beim Skriptlauf; postinstall-run.cjs waehlt damit npm ci oder npm install fuer ui-app'],
]);

/** Form eines Env-Namens: Grossbuchstaben, Ziffern, Unterstrich (plus die kleingeschriebenen Plattformnamen). */
function looksLikeEnvName(text) {
    return /^[A-Z][A-Z0-9_]+$/.test(text) || NOT_CATALOGED.has(text);
}

/** Liefert alle Quelldateien unterhalb der Wurzeln, als Pfade relativ zum Repo mit '/'. */
class SourceFiles {
    static list() {
        const out = [];
        for (const rel of SCAN_ROOTS) SourceFiles.walk(path.join(ROOT, rel), out);
        return out
            .map((abs) => path.relative(ROOT, abs).split(path.sep).join('/'))
            .filter((rel) => !SKIP_FILES.has(rel))
            .filter((rel) => !rel.startsWith('store/generated/'))
            .sort();
    }

    static walk(abs, out) {
        if (!fs.existsSync(abs)) return;
        const stat = fs.statSync(abs);
        if (stat.isFile()) {
            if (SOURCE_EXT.test(abs) && !abs.endsWith('.d.ts')) out.push(abs);
            return;
        }
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            if (ent.isDirectory() && SKIP_DIRS.has(ent.name)) continue;
            SourceFiles.walk(path.join(abs, ent.name), out);
        }
    }
}

/** Sucht im Syntaxbaum Env-Lesungen. Zwei Durchgaenge: erst Helfer erkennen, dann Namen sammeln. */
class EnvReadScanner {
    constructor(files) {
        this.sources = files.map((rel) =>
            ts.createSourceFile(
                rel,
                fs.readFileSync(path.join(ROOT, rel), 'utf8'),
                ts.ScriptTarget.Latest,
                true,
                /\.(c|m)?js$/.test(rel) ? ts.ScriptKind.JS : ts.ScriptKind.TS,
            ),
        );
        /** Helfer-Name -> Positionen der Parameter, die als Env-Name gelesen werden. */
        this.helpers = new Map();
        /** Env-Name -> Fundstellen "datei:zeile". */
        this.reads = new Map();
        /** Lesungen mit nicht aufloesbarem Namen (zur Info). */
        this.unresolved = [];
    }

    scan() {
        for (const sf of this.sources) this.visit(sf, sf, (node) => this.detectHelper(node));
        for (const sf of this.sources) this.visit(sf, sf, (node) => this.collect(node, sf));
        return this;
    }

    visit(node, sf, fn) {
        fn(node);
        ts.forEachChild(node, (child) => this.visit(child, sf, fn));
    }

    /** process.env, env, xyzEnv, this.env, opts.env — ein Objekt, aus dem Env-Werte gelesen werden. */
    static isEnvObject(expr) {
        if (ts.isPropertyAccessExpression(expr)) return expr.name.text === 'env';
        if (ts.isIdentifier(expr)) return expr.text === 'env' || /[a-z]Env$/.test(expr.text);
        return false;
    }

    /** Zuweisungsziel oder delete-Operand: kein Lesen. */
    static isWrite(node) {
        const parent = node.parent;
        if (ts.isDeleteExpression(parent)) return true;
        return ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
    }

    static functionName(fn) {
        if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
        const parent = fn.parent;
        if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
        if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
        return null;
    }

    static enclosingFunction(node) {
        for (let n = node.parent; n; n = n.parent) {
            if (ts.isFunctionLike(n) && n.parameters) return n;
        }
        return null;
    }

    /** env[param] in einer Funktion mit diesem Parameter -> die Funktion ist ein Helfer. */
    detectHelper(node) {
        if (!ts.isElementAccessExpression(node) || !EnvReadScanner.isEnvObject(node.expression)) return;
        const arg = node.argumentExpression;
        if (!ts.isIdentifier(arg)) return;
        const fn = EnvReadScanner.enclosingFunction(node);
        if (!fn) return;
        const index = fn.parameters.findIndex((p) => ts.isIdentifier(p.name) && p.name.text === arg.text);
        const name = EnvReadScanner.functionName(fn);
        if (index < 0 || !name) return;
        if (!this.helpers.has(name)) this.helpers.set(name, new Set());
        this.helpers.get(name).add(index);
    }

    collect(node, sf) {
        if (ts.isPropertyAccessExpression(node) && EnvReadScanner.isEnvObject(node.expression)) {
            if (!EnvReadScanner.isWrite(node)) this.record(node.name.text, node, sf);
        } else if (ts.isElementAccessExpression(node) && EnvReadScanner.isEnvObject(node.expression)) {
            if (!EnvReadScanner.isWrite(node)) this.collectElementAccess(node, sf);
        } else if (
            ts.isVariableDeclaration(node) &&
            ts.isObjectBindingPattern(node.name) &&
            node.initializer &&
            EnvReadScanner.isEnvObject(node.initializer)
        ) {
            for (const el of node.name.elements) {
                const key = el.propertyName ?? el.name;
                if (ts.isIdentifier(key) || ts.isStringLiteral(key)) this.record(key.text, el, sf);
            }
        } else if (ts.isCallExpression(node)) {
            this.collectHelperCall(node, sf);
        }
    }

    collectElementAccess(node, sf) {
        const arg = node.argumentExpression;
        if (ts.isStringLiteralLike(arg)) return this.record(arg.text, node, sf);
        if (!ts.isIdentifier(arg)) return this.unresolved.push(EnvReadScanner.where(node, sf));
        const names = EnvReadScanner.resolveConstNames(arg, node);
        if (names) for (const n of names) this.record(n, node, sf);
        else if (!this.isHelperParameter(arg, node)) this.unresolved.push(EnvReadScanner.where(node, sf));
    }

    isHelperParameter(arg, node) {
        const fn = EnvReadScanner.enclosingFunction(node);
        return !!fn && fn.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === arg.text);
    }

    /**
     * Name aus einer Konstante: for (const name of ['A', 'B'] [as const]) oder const NAME = 'A' im selben Block.
     * Liefert null, wenn der Name nicht statisch feststeht.
     */
    static resolveConstNames(id, from) {
        for (let n = from.parent; n; n = n.parent) {
            if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer)) {
                const decl = n.initializer.declarations[0];
                if (decl && ts.isIdentifier(decl.name) && decl.name.text === id.text) {
                    return EnvReadScanner.stringArray(n.expression);
                }
            }
            if (ts.isBlock(n) || ts.isSourceFile(n)) {
                for (const st of n.statements) {
                    if (!ts.isVariableStatement(st)) continue;
                    for (const decl of st.declarationList.declarations) {
                        if (
                            ts.isIdentifier(decl.name) &&
                            decl.name.text === id.text &&
                            decl.initializer &&
                            ts.isStringLiteralLike(decl.initializer)
                        )
                            return [decl.initializer.text];
                    }
                }
            }
        }
        return null;
    }

    static stringArray(expr) {
        let e = expr;
        while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
        if (!ts.isArrayLiteralExpression(e)) return null;
        const out = e.elements.filter(ts.isStringLiteralLike).map((s) => s.text);
        return out.length === e.elements.length ? out : null;
    }

    collectHelperCall(node, sf) {
        const callee = node.expression;
        const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
        const indices = name ? this.helpers.get(name) : null;
        if (!indices) return;
        for (const i of indices) {
            const arg = node.arguments[i];
            if (arg && ts.isStringLiteralLike(arg)) this.record(arg.text, arg, sf);
        }
    }

    record(name, node, sf) {
        if (!looksLikeEnvName(name)) return;
        if (!this.reads.has(name)) this.reads.set(name, []);
        this.reads.get(name).push(EnvReadScanner.where(node, sf));
    }

    static where(node, sf) {
        return `${sf.fileName}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    }
}

/** Regeln des frueheren testEnvCatalogWarnings: Katalog -> .env-Beispiele, mit Abschnitten und Reihenfolge. */
class ExampleFileCheck {
    constructor(catalog, sections) {
        this.catalog = catalog;
        this.sections = sections;
    }

    problems(file) {
        const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
        const lines = text.split(/\r?\n/);
        const out = [];
        const absent = this.catalog.filter((spec) => !new RegExp(`\\b${spec.name}\\b`).test(text)).map((s) => s.name);
        if (absent.length) out.push(`${file}: fehlt ${absent.join(', ')}`);

        const headingAt = this.sections.map((s) => lines.findIndex((l) => l.replace(/^#\s*/, '').trim() === s.heading));
        const noHeading = this.sections.filter((_, i) => headingAt[i] < 0).map((s) => s.heading);
        if (noHeading.length) return [...out, `${file}: Abschnitt fehlt: ${noHeading.join(' / ')}`];
        for (let i = 1; i < headingAt.length; i++) {
            if (headingAt[i] <= headingAt[i - 1])
                out.push(`${file}: "${this.sections[i].heading}" steht vor "${this.sections[i - 1].heading}"`);
        }

        let previous = -1;
        for (const spec of this.catalog) {
            if (absent.includes(spec.name)) continue;
            // Die eigene Zeile der Variable beginnt mit ihrem Namen ("# NAME — …", "# NAME=…" oder aktiv "NAME=…").
            const at = lines.findIndex((l) => new RegExp(`^#? ?${spec.name}\\b`).test(l));
            const s = this.sections.findIndex((x) => x.id === spec.section);
            const end = s + 1 < headingAt.length ? headingAt[s + 1] : lines.length;
            if (at < 0) {
                out.push(`${file}: ${spec.name} hat keine eigene Zeile ("# ${spec.name} — …")`);
                continue;
            }
            if (at < headingAt[s] || at >= end)
                out.push(`${file}: ${spec.name} steht nicht im Abschnitt "${this.sections[s].heading}" (Zeile ${at + 1})`);
            if (at < previous) out.push(`${file}: ${spec.name} (Zeile ${at + 1}) steht vor seinem Vorgaenger im Katalog`);
            previous = at;
        }
        return out;
    }
}

class EnvCatalogCheck {
    static run(argv) {
        process.chdir(ROOT);
        require('ts-node').register({ transpileOnly: true, project: path.join(ROOT, 'tsconfig.json') });
        const { ENV_CATALOG, ENV_SECTIONS } = require(path.join(ROOT, 'server-app', 'startupEnvCheck.ts'));

        const known = new Set(ENV_CATALOG.flatMap((s) => [s.name, ...(s.anyOf ?? []), ...(s.aliases ?? [])]));
        const scanner = new EnvReadScanner(SourceFiles.list()).scan();
        const problems = [];

        const uncataloged = [...scanner.reads.keys()].filter((n) => !known.has(n) && !NOT_CATALOGED.has(n)).sort();
        for (const name of uncataloged) {
            problems.push(`Code liest ${name}, der Katalog kennt es nicht: ${scanner.reads.get(name).slice(0, 3).join(', ')}`);
        }
        for (const name of NOT_CATALOGED.keys()) {
            if (known.has(name)) problems.push(`Ausnahme ${name} steht auch im Katalog — aus NOT_CATALOGED nehmen`);
            else if (!scanner.reads.has(name)) problems.push(`Ausnahme ${name} liest niemand mehr — aus NOT_CATALOGED nehmen`);
        }

        const examples = new ExampleFileCheck(ENV_CATALOG, ENV_SECTIONS);
        for (const file of ['.env.example', '.env.integration.example']) problems.push(...examples.problems(file));

        if (argv.includes('--list')) {
            for (const name of [...scanner.reads.keys()].sort()) console.log(`  ${name}  ${scanner.reads.get(name).join(', ')}`);
            for (const w of scanner.unresolved) console.log(`  (dynamisch, nicht aufgeloest) ${w}`);
        }

        if (problems.length) {
            console.error(`${TAG} ${problems.length} Luecke(n):`);
            for (const p of problems) console.error(`  - ${p}`);
            console.error(
                '\nNeue Variable: Eintrag in ENV_CATALOG (server-app/startupEnvCheck.ts) und in beiden .env-Beispielen;' +
                    ' von der Laufzeitumgebung gesetzt: in NOT_CATALOGED (scripts/check-env-catalog.cjs) mit Begruendung.',
            );
            process.exit(1);
        }
        console.log(
            `${TAG} OK — ${ENV_CATALOG.length} Katalog-Eintraege, ${scanner.reads.size} gelesene Namen, ${NOT_CATALOGED.size} Ausnahmen`,
        );
    }
}

EnvCatalogCheck.run(process.argv.slice(2));
