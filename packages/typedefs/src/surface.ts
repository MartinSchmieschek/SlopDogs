import { createHash } from 'crypto';
import * as ts from 'typescript';
import type { TypeDefsPayload } from './TypeDefExtractor';

/**
 * Vertragsoberflaeche eines Pakets (PLAN-DOG-PAKETE P2.6, `dist/surface.json`): was ein Abhaengiger oder ein
 * gespeicherter Kennel beim Namen nennt. Exporte des Einstiegs (Name + Art), die Klassen darunter und die Pacts
 * mit dem Hash ihres Typs. Bei core gilt nur der Haupteinstieg (der Vertrag), nicht `/runtime`.
 */
export interface PackageSurface {
    surfaceVersion: 1;
    name: string;
    version: string;
    /** Einstiegsdatei relativ zum Paket (`src/index.ts`). */
    entry: string;
    /** Exportname -> Art (`class`, `function`, `const`, `interface`, `type`, `enum`, `pact`, ...). */
    exports: Record<string, string>;
    /** Exportierte Klassen (Dog-Klassen landen per `base:<Klasse>` in Kennels). */
    classes: string[];
    /** Exportname eines Pacts -> Pact-Name (fuer `imitates`), Quelltyp und Hash des Pact-Typs. */
    pacts: Record<string, { pactName: string; sourceType: string | null; hash: string }>;
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function kindOf(symbol: ts.Symbol): string {
    const f = symbol.flags;
    if (f & ts.SymbolFlags.Class) return 'class';
    if (f & ts.SymbolFlags.Function) return 'function';
    if (f & ts.SymbolFlags.Enum) return 'enum';
    if (f & ts.SymbolFlags.Interface) return 'interface';
    if (f & ts.SymbolFlags.TypeAlias) return 'type';
    if (f & ts.SymbolFlags.Variable) return 'const';
    return 'other';
}

/** `createPact('Name', { fromSourceType: 'T' })` / `createPact('Name', 'typedef')` / `createPact('Name')` an einer Variablen. */
function pactCallOf(decl: ts.Declaration | undefined): { pactName: string; sourceType: string | null; typeDef: string | null } | null {
    if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer) return null;
    const init = decl.initializer;
    if (!ts.isCallExpression(init) || !ts.isIdentifier(init.expression) || init.expression.text !== 'createPact') return null;
    const [nameArg, second] = init.arguments;
    if (!nameArg || !ts.isStringLiteralLike(nameArg)) return null;
    let sourceType: string | null = null;
    let typeDef: string | null = null;
    if (second && ts.isStringLiteralLike(second)) typeDef = second.text;
    if (second && ts.isObjectLiteralExpression(second)) {
        for (const prop of second.properties) {
            if (
                ts.isPropertyAssignment(prop) &&
                ts.isIdentifier(prop.name) &&
                prop.name.text === 'fromSourceType' &&
                ts.isStringLiteralLike(prop.initializer)
            )
                sourceType = prop.initializer.text;
        }
    }
    return { pactName: nameArg.text, sourceType, typeDef };
}

/**
 * Oberflaeche des Einstiegs `entryFile` im Programm. Der Pact-Hash nimmt den aufgeloesten Pact-Typ aus
 * `typeDefs` (fromSourceType), sonst den Typ-String aus dem Aufruf, sonst den leeren Typ.
 */
export function computeSurface(
    program: ts.Program,
    entryFile: string,
    meta: { name: string; version: string; entry: string },
    typeDefs: TypeDefsPayload,
): PackageSurface {
    const checker = program.getTypeChecker();
    const sf = program.getSourceFile(entryFile);
    if (!sf) throw new Error(`[slopdogs-typedefs] Einstieg ${entryFile} ist nicht im Programm.`);
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    const exportsOut: Record<string, string> = {};
    const classes: string[] = [];
    const pacts: PackageSurface['pacts'] = {};
    for (const exp of moduleSymbol ? checker.getExportsOfModule(moduleSymbol) : []) {
        const target = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
        const pact = pactCallOf(target.declarations?.[0]);
        if (pact) {
            const typeText = pact.sourceType
                ? (typeDefs.pactReturnTypes[pact.sourceType] ?? `<fehlt:${pact.sourceType}>`)
                : (pact.typeDef ?? '');
            pacts[exp.name] = { pactName: pact.pactName, sourceType: pact.sourceType, hash: sha256(typeText) };
            exportsOut[exp.name] = 'pact';
            continue;
        }
        const kind = kindOf(target);
        exportsOut[exp.name] = kind;
        if (kind === 'class') classes.push(exp.name);
    }
    const sortedExports = Object.fromEntries(Object.entries(exportsOut).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    const sortedPacts = Object.fromEntries(Object.entries(pacts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    return { surfaceVersion: 1, ...meta, exports: sortedExports, classes: classes.sort(), pacts: sortedPacts };
}

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
}

function parseVersion(v: string): ParsedVersion {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
    if (!m) throw new Error(`[slopdogs-typedefs] Version "${v}" ist kein semver.`);
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * Liegt `next` ausserhalb von `^prev`? Das ist der Major-Sprung im Sinn von semver-Caret: bei 1.x und hoeher die
 * erste Stelle, bei 0.x die zweite (0.3 -> 0.4), bei 0.0.x die dritte. Genau dann nimmt ein Abhaengiger mit
 * Peer-Bereich `^prev` die neue Version nicht still an.
 */
export function isBreakingBump(prev: string, next: string): boolean {
    const a = parseVersion(prev);
    const b = parseVersion(next);
    if (a.major > 0) return b.major > a.major;
    if (a.minor > 0) return b.major > 0 || b.minor > a.minor;
    return b.major > 0 || b.minor > 0 || b.patch > a.patch;
}

/** Was sich zwischen zwei Oberflaechen so geaendert hat, dass ein Abhaengiger bricht (Hinzufuegen bricht nichts). */
export function surfaceBreaks(prev: PackageSurface, next: PackageSurface): string[] {
    const out: string[] = [];
    for (const [name, kind] of Object.entries(prev.exports)) {
        if (!(name in next.exports)) out.push(`Export entfernt oder umbenannt: ${name} (${kind})`);
        else if (next.exports[name] !== kind) out.push(`Export ${name}: Art ${kind} -> ${next.exports[name]}`);
    }
    for (const cls of prev.classes) if (!next.classes.includes(cls)) out.push(`Klasse entfernt oder umbenannt: ${cls}`);
    for (const [name, pact] of Object.entries(prev.pacts)) {
        const now = next.pacts[name];
        if (!now) {
            out.push(`Pact entfernt oder umbenannt: ${name} (${pact.pactName})`);
            continue;
        }
        if (now.pactName !== pact.pactName) out.push(`Pact ${name}: Name ${pact.pactName} -> ${now.pactName}`);
        if (now.hash !== pact.hash) out.push(`Pact ${name} (${pact.pactName}): Typ geaendert`);
    }
    return out;
}
