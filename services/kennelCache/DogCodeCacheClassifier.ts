// Statische Klasse eines eigenen Dogs (PLAN-KENNEL-CACHE 2.2): der tsCode wird ueber den TypeScript-Syntaxbaum gelesen,
// nicht per Regex — `fetch` in einem String oder Kommentar ist kein Abruf, `Object.keys` kein Key-Store.
// Das Ergebnis haengt nur am Code einer Version und wird je Version-GUID gemerkt.
import * as ts from 'typescript';
import { stricterOf, type CacheClass } from './CacheClass';

/** Eine Fundstelle: welche Klasse sie begruendet, was dort steht, in welcher Zeile (1-basiert). */
export interface DogCodeFinding {
    klasse: CacheClass;
    what: string;
    line: number;
}

/** Was der Code eines Dogs ueber sein Ergebnis verraet. Ohne Fundstelle: `rein`. */
export class DogCodeVerdict {
    constructor(readonly findings: readonly DogCodeFinding[]) {}

    get klasse(): CacheClass {
        return this.findings.reduce<CacheClass>((acc, f) => stricterOf(acc, f.klasse), 'rein');
    }

    /** Die Fundstellen der strengsten Klasse als Text, z. B. "fetch, Zeile 12; Date, Zeile 3". */
    get detail(): string | undefined {
        const klasse = this.klasse;
        const strongest = this.findings.filter((f) => f.klasse === klasse).slice(0, 3);
        return strongest.length ? strongest.map((f) => `${f.what}, Zeile ${f.line}`).join('; ') : undefined;
    }
}

/** Globale Objekte, ueber die ein Dog eine Kapazitaet per berechnetem Namen erreichen koennte. */
const GLOBAL_OBJECTS = new Set(['globalThis', 'global', 'self', 'window']);
const CLOCK_OBJECTS = new Set(['Date']);
const RANDOM_CALLS = new Map([
    ['Math', new Set(['random'])],
    ['crypto', new Set(['randomUUID', 'getRandomValues', 'randomBytes', 'randomInt'])],
]);
const PERSONAL_CAPABILITIES = new Set(['jsonStore', 'keys']);

/**
 * Liest einen Dog-Code und sammelt die Fundstellen:
 *   fetch(...)                         -> fluechtig (Daten von aussen)
 *   Date, performance.now              -> fluechtig (Uhr)
 *   Math.random, crypto.random*        -> live (Zufall)
 *   jsonStore.*, keys.*                -> persoenlich (Ablage bzw. Schluessel des Ausfuehrenden)
 *   eval, Function, globalThis[...]    -> fluechtig (nicht nachvollziehbar; die Laufzeit-Pruefung deckt den Rest)
 * Ein lokal deklarierter Name (`const keys = Object.keys(x)`) ist keine Kapazitaet.
 *
 * Browser-Code zaehlt nicht: eine Funktion, die der Dog nur als Text ausliefert (`return String(f)`,
 * `'<script>(' + f + ')()'`, `f.toString()`, `${f}`) und nirgends sonst nutzt, laeuft nie auf dem Server — ihr Rumpf
 * (fetch, Date, Math.random im Browser) aendert das Ergebnis des Laufs nicht. Eng gefasst: der Name ist genau einmal
 * deklariert, und jede Nutzung ausserhalb des eigenen Rumpfs ist eine solche Umwandlung in Text.
 */
export class DogCodeAnalysis {
    private readonly findings: DogCodeFinding[] = [];
    private readonly seen = new Set<string>();
    private readonly declared = new Set<string>();
    private readonly declarationCount = new Map<string, number>();
    /** Funktionsknoten, deren Rumpf nur im Browser laeuft — visit() steigt nicht hinein. */
    private readonly browserOnly = new Set<ts.Node>();

    private constructor(private readonly source: ts.SourceFile) {}

    static of(code: string): DogCodeVerdict {
        if (typeof code !== 'string' || code.trim() === '') return new DogCodeVerdict([]);
        const source = ts.createSourceFile('dog.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const analysis = new DogCodeAnalysis(source);
        analysis.collectDeclarations(source);
        analysis.collectBrowserOnlyFunctions(source);
        analysis.visit(source);
        return new DogCodeVerdict(analysis.findings);
    }

    private collectDeclarations(node: ts.Node): void {
        let name: string | undefined;
        if ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name)) {
            name = node.name.text;
        }
        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) name = node.name.text;
        if (name !== undefined) {
            this.declared.add(name);
            this.declarationCount.set(name, (this.declarationCount.get(name) ?? 0) + 1);
        }
        ts.forEachChild(node, (child) => this.collectDeclarations(child));
    }

    /** Benannte Funktionen (Deklaration oder `var f = function/=>`), die nur als Text weitergegeben werden. */
    private collectBrowserOnlyFunctions(root: ts.SourceFile): void {
        const candidates = new Map<string, ts.Node>();
        const collect = (node: ts.Node): void => {
            if (ts.isFunctionDeclaration(node) && node.name && node.body) candidates.set(node.name.text, node);
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
                const init = DogCodeAnalysis.unwrap(node.initializer);
                if (ts.isFunctionExpression(init) || ts.isArrowFunction(init)) candidates.set(node.name.text, init);
            }
            ts.forEachChild(node, collect);
        };
        collect(root);
        for (const name of [...candidates.keys()]) if (this.declarationCount.get(name) !== 1) candidates.delete(name);
        if (candidates.size === 0) return;

        const uses = new Map<string, { text: number; other: number }>();
        const count = (node: ts.Node): void => {
            if (ts.isIdentifier(node) && candidates.has(node.text) && DogCodeAnalysis.isReference(node)) {
                const fn = candidates.get(node.text)!;
                const insideOwnBody = node.pos >= fn.pos && node.end <= fn.end;
                if (!insideOwnBody) {
                    const tally = uses.get(node.text) ?? { text: 0, other: 0 };
                    if (DogCodeAnalysis.isTurnedIntoText(node)) tally.text++;
                    else tally.other++;
                    uses.set(node.text, tally);
                }
            }
            ts.forEachChild(node, count);
        };
        count(root);
        for (const [name, fn] of candidates) {
            const tally = uses.get(name);
            if (tally && tally.text > 0 && tally.other === 0) this.browserOnly.add(fn);
        }
    }

    /** Ein Bezeichner als Wert — nicht als Deklarationsname, nicht als Eigenschaftsname. */
    private static isReference(node: ts.Identifier): boolean {
        const parent = node.parent;
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
        if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
        if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.name === node)
            return false;
        if (
            (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent)) &&
            parent.name === node
        ) {
            return false;
        }
        return true;
    }

    /** Wird dieser Ausdruck hier zu Text: `String(x)`, `x.toString()`, `'…' + x`, `${x}` (Klammern zaehlen nicht)? */
    private static isTurnedIntoText(expr: ts.Node): boolean {
        let node = expr;
        while (ts.isParenthesizedExpression(node.parent)) node = node.parent;
        const parent = node.parent;
        if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'String') {
            return parent.arguments.length === 1 && parent.arguments[0] === node;
        }
        if (ts.isPropertyAccessExpression(parent) && parent.expression === node && parent.name.text === 'toString') {
            return ts.isCallExpression(parent.parent) && parent.parent.expression === parent && parent.parent.arguments.length === 0;
        }
        if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) return true;
        if (ts.isTemplateSpan(parent) && parent.expression === node) return true;
        return false;
    }

    private static unwrap(node: ts.Expression): ts.Expression {
        let current = node;
        while (ts.isParenthesizedExpression(current)) current = current.expression;
        return current;
    }

    private visit(node: ts.Node): void {
        if (this.browserOnly.has(node)) return;
        // Eine namenlose Funktion direkt in Text gewandelt: `String(function () {…})`, `'(' + (() => …) + ')()'`.
        if ((ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && DogCodeAnalysis.isTurnedIntoText(node)) return;
        if (ts.isCallExpression(node)) this.inspectCall(node);
        if (ts.isPropertyAccessExpression(node)) this.inspectPropertyAccess(node);
        if (ts.isElementAccessExpression(node)) this.inspectElementAccess(node);
        if (ts.isIdentifier(node)) this.inspectIdentifier(node);
        ts.forEachChild(node, (child) => this.visit(child));
    }

    private inspectCall(node: ts.CallExpression): void {
        const callee = node.expression;
        if (!ts.isIdentifier(callee)) return;
        if (callee.text === 'fetch' && !this.declared.has('fetch')) this.add('fluechtig', 'fetch', node);
        if (callee.text === 'eval' || callee.text === 'Function') this.add('fluechtig', `${callee.text} (nicht nachvollziehbar)`, node);
    }

    private inspectPropertyAccess(node: ts.PropertyAccessExpression): void {
        const target = node.expression;
        if (!ts.isIdentifier(target)) return;
        const object = target.text;
        const member = node.name.text;
        if (this.declared.has(object)) return;
        if (RANDOM_CALLS.get(object)?.has(member)) this.add('live', `${object}.${member}`, node);
        if (object === 'performance' && member === 'now') this.add('fluechtig', 'performance.now', node);
        if (PERSONAL_CAPABILITIES.has(object)) this.add('persoenlich', `${object}.${member}`, node);
    }

    private inspectElementAccess(node: ts.ElementAccessExpression): void {
        const target = node.expression;
        if (ts.isIdentifier(target) && GLOBAL_OBJECTS.has(target.text) && !ts.isStringLiteral(node.argumentExpression)) {
            this.add('fluechtig', `${target.text}[…] (nicht nachvollziehbar)`, node);
        }
        if (ts.isIdentifier(target) && PERSONAL_CAPABILITIES.has(target.text) && !this.declared.has(target.text)) {
            this.add('persoenlich', `${target.text}[…]`, node);
        }
    }

    /** Ein Bezeichner als Wert (nicht als Eigenschaftsname, nicht als Deklaration). */
    private inspectIdentifier(node: ts.Identifier): void {
        const parent = node.parent;
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) return;
        if (ts.isPropertyAssignment(parent) && parent.name === node) return;
        if ((ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.name === node) return;
        const name = node.text;
        if (CLOCK_OBJECTS.has(name) && !this.declared.has(name)) this.add('fluechtig', name, node);
        if (name === 'jsonStore' && !this.declared.has(name)) this.add('persoenlich', name, node);
    }

    private add(klasse: CacheClass, what: string, node: ts.Node): void {
        const key = `${klasse}\u0000${what}`;
        if (this.seen.has(key)) return;
        this.seen.add(key);
        const line = this.source.getLineAndCharacterOfPosition(node.getStart(this.source)).line + 1;
        this.findings.push({ klasse, what, line });
    }
}

/**
 * Das Urteil je Dog-Version, gemerkt: der Code einer Version aendert sich nie, eine neue Version hat eine neue GUID.
 * Begrenzt (aelteste zuerst raus), damit ein langer Prozess nicht jede je gesehene Version haelt.
 */
export class DogCodeCacheClassifier {
    static readonly MAX_ENTRIES = 5000;
    private readonly byVersion = new Map<string, DogCodeVerdict>();

    knows(versionId: string): boolean {
        return this.byVersion.has(versionId);
    }

    verdictOf(versionId: string): DogCodeVerdict | undefined {
        return this.byVersion.get(versionId);
    }

    classify(versionId: string, code: string): DogCodeVerdict {
        const known = this.byVersion.get(versionId);
        if (known) return known;
        const verdict = DogCodeAnalysis.of(code);
        if (this.byVersion.size >= DogCodeCacheClassifier.MAX_ENTRIES) {
            const oldest = this.byVersion.keys().next().value;
            if (oldest !== undefined) this.byVersion.delete(oldest);
        }
        this.byVersion.set(versionId, verdict);
        return verdict;
    }
}
