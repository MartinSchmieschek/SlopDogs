import * as ts from 'typescript';

/**
 * Arr, this be the manifest of a class plundered by the TypeScript compiler —
 * its public members laid bare and its referenced interfaces dragged
 * from brooding gulfs into the light, so the crew may know its eldritch shape.
 */
export interface IClassTypeResult {
    /** A record of member names to their type strings — the plunder of the class, catalogued. */
    members: Record<string, string>;
    /** Interface definitions referenced by the class, dredged from the void as raw TypeScript. */
    referencedInterfaces: string;
}

/** Inhalt von `type-defs.json`: Pact-Quelltyp -> Return-Typ-Definition, Klassenname -> Klassen-Typ. */
export interface TypeDefsPayload {
    pactReturnTypes: Record<string, string>;
    classTypes: Record<string, IClassTypeResult>;
}

/**
 * Welche Dateien des Programms als Quelle gelten (Typen daraus werden ausgegeben). Standard wie seit jeher:
 * alles ausser Deklarationsdateien — lib.d.ts, @types und Fremdpakete bleiben draussen.
 */
export type SourceFilePredicate = (sourceFile: ts.SourceFile) => boolean;

export const nonDeclarationFiles: SourceFilePredicate = (sourceFile) => !sourceFile.isDeclarationFile;

/**
 * Die Logik, mit der SlopDogs aus einem TypeScript-Programm Pact-Return-Typen und Klassen-Typen zieht
 * (frueher privat in `services/CompilerCache.ts`). Server (Live-Kompilierung in dev, Server-eigene Typen
 * im Build) und das Paket-Werkzeug (`slopdogs-typedefs build`, je Paket `dist/type-defs.json`) nutzen
 * genau diesen Code — es gibt keine zweite Kopie, die auseinanderlaufen koennte.
 *
 * Suchen nach Namen (`findNamedTypeDeclaration`, `emitInterfaceDefinition`) laufen wie bisher ueber alle
 * Quelldateien des Programms in Programm-Reihenfolge; der erste Treffer gilt.
 */
export class TypeDefExtractor {
    /** A printer forged in the void, stripping comments as one strips barnacles from a cursed hull. */
    private static readonly pactPrinter = ts.createPrinter({ removeComments: true });

    private readonly checker: ts.TypeChecker;

    constructor(
        private readonly program: ts.Program,
        private readonly isSource: SourceFilePredicate = nonDeclarationFiles,
    ) {
        this.checker = program.getTypeChecker();
    }

    /** Die Quelldateien des Programms in Programm-Reihenfolge (Grundlage jeder Suche nach Namen). */
    sourceFiles(): ts.SourceFile[] {
        return this.program.getSourceFiles().filter((sf) => this.isSource(sf));
    }

    /**
     * Determines whether a declaration be visible to the crew — only those members
     * not marked private or protected may be plundered from the class's hull.
     */
    private static isPublic(node: ts.Declaration): boolean {
        const flags = ts.getCombinedModifierFlags(node);
        return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
    }

    /**
     * Descends into the recursive abyss of a type, collecting all referenced
     * interface names — through unions, intersections, type arguments, and arrays,
     * the carrion hordes of nested types be catalogued so none escape the void.
     */
    private collectReferencedTypes(type: ts.Type, collected: Set<string>): void {
        const checker = this.checker;
        if (type.isUnion()) {
            for (const t of type.types) {
                this.collectReferencedTypes(t, collected);
            }
            return;
        }

        if (type.isIntersection()) {
            for (const t of type.types) {
                this.collectReferencedTypes(t, collected);
            }
            return;
        }

        const symbol = type.aliasSymbol ?? type.getSymbol();
        if (symbol) {
            const decls = symbol.getDeclarations();
            if (decls && decls.length > 0) {
                const decl = decls[0];
                const sourceFile = decl.getSourceFile();
                if (this.isSource(sourceFile) && ts.isInterfaceDeclaration(decl)) {
                    const name = symbol.getName();
                    if (!collected.has(name)) {
                        collected.add(name);
                        for (const member of type.getProperties()) {
                            const memberType = checker.getTypeOfSymbol(member);
                            this.collectReferencedTypes(memberType, collected);
                        }
                    }
                }
            }
        }

        const typeArgs = (type as ts.TypeReference).typeArguments;
        if (typeArgs) {
            for (const arg of typeArgs) {
                this.collectReferencedTypes(arg, collected);
            }
        }

        if (checker.isArrayType(type)) {
            const elementType = (type as ts.TypeReference).typeArguments?.[0];
            if (elementType) {
                this.collectReferencedTypes(elementType, collected);
            }
        }
    }

    /**
     * Searches the program's source files for an interface declaration and emits
     * its definition as a string — dragging the eldritch shape from brooding gulfs
     * into a form the crew can embed in generated type libraries.
     */
    private emitInterfaceDefinition(interfaceName: string): string | null {
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!this.isSource(sourceFile)) continue;
            const result = TypeDefExtractor.findInterfaceInFile(sourceFile, interfaceName);
            if (result) {
                return this.interfaceNodeToString(result);
            }
        }
        return null;
    }

    /** Scours a single source file for an interface declaration bearing the given name. */
    private static findInterfaceInFile(sourceFile: ts.SourceFile, name: string): ts.InterfaceDeclaration | null {
        let found: ts.InterfaceDeclaration | null = null;
        const visit = (node: ts.Node) => {
            if (found) return;
            if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
                found = node;
                return;
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return found;
    }

    /** Hunts through a source file for any named type declaration — interface, type alias, or enum. */
    private static findNamedTypeDeclarationInSourceFile(
        sourceFile: ts.SourceFile,
        name: string,
    ): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | null {
        let found: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | null = null;
        const visit = (node: ts.Node) => {
            if (found) return;
            if (ts.isInterfaceDeclaration(node) && node.name.text === name) {
                found = node;
                return;
            }
            if (ts.isTypeAliasDeclaration(node) && node.name.text === name) {
                found = node;
                return;
            }
            if (ts.isEnumDeclaration(node) && node.name.text === name) {
                found = node;
                return;
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return found;
    }

    /** Arr, traverse ALL source files in the program, seeking a named type declaration — the first match be claimed. */
    private findNamedTypeDeclaration(name: string): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | null {
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!this.isSource(sourceFile)) continue;
            const decl = TypeDefExtractor.findNamedTypeDeclarationInSourceFile(sourceFile, name);
            if (decl) return decl;
        }
        return null;
    }

    /** Prints an enum declaration and appends a return-type alias. */
    private static enumNodeToPactDef(node: ts.EnumDeclaration): string {
        const text = TypeDefExtractor.pactPrinter.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).trim();
        const name = node.name.text;
        return `${text}\ntype ${name}Return = ${name};`;
    }

    /** Resolves a type alias into its full pact definition, with all referenced interfaces. */
    private typeAliasNodeToPactDef(node: ts.TypeAliasDeclaration): string {
        const name = node.name.text;
        const symbol = this.checker.getSymbolAtLocation(node.name);
        if (!symbol) {
            throw new Error(`[CompilerCache] Kein Symbol für Type-Alias "${name}".`);
        }
        const declared = this.checker.getDeclaredTypeOfSymbol(symbol);
        const collected = new Set<string>();
        this.collectReferencedTypes(declared, collected);
        collected.delete(name);

        const interfaceDefs: string[] = [];
        for (const typeName of [...collected].sort()) {
            const def = this.emitInterfaceDefinition(typeName);
            if (def) interfaceDefs.push(def);
        }

        const aliasText = TypeDefExtractor.pactPrinter.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).trim();
        if (interfaceDefs.length) {
            return `${interfaceDefs.join('\n\n')}\n\n${aliasText}\ntype ${name}Return = ${name};`;
        }
        return `${aliasText}\ntype ${name}Return = ${name};`;
    }

    /** Aus Property-Typ-AST (z. B. `preset?: LandmarksOverpassFacet[]`) Enum-Namen sammeln. */
    private static collectEnumNamesFromTypeNode(node: ts.TypeNode | undefined, out: Set<string>): void {
        if (!node) return;
        if (ts.isTypeReferenceNode(node)) {
            const tn = node.typeName;
            if (ts.isIdentifier(tn)) {
                out.add(tn.text);
            } else if (ts.isQualifiedName(tn)) {
                out.add(tn.right.text);
            }
            return;
        }
        if (ts.isUnionTypeNode(node)) {
            for (const t of node.types) {
                TypeDefExtractor.collectEnumNamesFromTypeNode(t, out);
            }
            return;
        }
        if (ts.isArrayTypeNode(node)) {
            TypeDefExtractor.collectEnumNamesFromTypeNode(node.elementType, out);
        }
    }

    /** Finds and emits all enum declarations referenced by an interface's property signatures. */
    private emitReferencedEnumsForInterface(iface: ts.InterfaceDeclaration): string {
        const names = new Set<string>();
        for (const member of iface.members) {
            if (ts.isPropertySignature(member) && member.type) {
                TypeDefExtractor.collectEnumNamesFromTypeNode(member.type, names);
            }
        }
        const blocks: string[] = [];
        for (const en of [...names].sort()) {
            const d = this.findNamedTypeDeclaration(en);
            if (d && ts.isEnumDeclaration(d)) {
                blocks.push(TypeDefExtractor.pactPrinter.printNode(ts.EmitHint.Unspecified, d, d.getSourceFile()).trim());
            }
        }
        return blocks.join('\n\n');
    }

    /**
     * Arr, the heart of the pact type resolution — locates a named type declaration
     * (interface, enum, or type alias) and builds its full return type definition.
     * Throws if the symbol be lost to the void.
     */
    buildPactReturnTypeDef(symbolName: string): string {
        const decl = this.findNamedTypeDeclaration(symbolName);
        if (!decl) {
            throw new Error(
                `[CompilerCache] Pact-Quelltyp "${symbolName}" nicht gefunden. Prüfe Schreibweise und ob die Quell-Datei über tsconfig.json eingebunden ist (nicht nur Deklarationen in node_modules).`,
            );
        }
        if (ts.isInterfaceDeclaration(decl)) {
            const enumBlock = this.emitReferencedEnumsForInterface(decl);
            const iface = this.interfaceNodeToString(decl);
            const prefix = enumBlock ? `${enumBlock}\n\n` : '';
            return `${prefix}${iface}\ntype ${symbolName}Return = ${symbolName};`;
        }
        if (ts.isEnumDeclaration(decl)) {
            return TypeDefExtractor.enumNodeToPactDef(decl);
        }
        if (ts.isTypeAliasDeclaration(decl)) {
            return this.typeAliasNodeToPactDef(decl);
        }
        throw new Error(`[CompilerCache] Unsupported declaration for Pact-Quelltyp "${symbolName}".`);
    }

    /** Converts an interface declaration node into a readable TypeScript string. */
    private interfaceNodeToString(node: ts.InterfaceDeclaration): string {
        const checker = this.checker;
        const name = node.name.text;
        const members: string[] = [];

        for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.name) {
                const memberName = (member.name as ts.Identifier).text;
                const optional = member.questionToken ? '?' : '';
                let typeStr: string | undefined;
                if (member.type) {
                    const t = checker.getTypeAtLocation(member.type);
                    typeStr = checker.typeToString(t, member.type, ts.TypeFormatFlags.NoTruncation);
                } else {
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const memberType = checker.getTypeOfSymbol(symbol);
                        typeStr = checker.typeToString(memberType, node, ts.TypeFormatFlags.NoTruncation);
                    }
                }
                if (typeStr !== undefined) {
                    members.push(`  ${memberName}${optional}: ${typeStr};`);
                }
            } else if (ts.isMethodSignature(member) && member.name) {
                const memberName = (member.name as ts.Identifier).text;
                const optional = member.questionToken ? '?' : '';
                const sig = checker.getSignatureFromDeclaration(member);
                if (sig) {
                    const returnType = checker.getReturnTypeOfSignature(sig);
                    const params = sig.parameters.map((p) => {
                        const pType = checker.getTypeOfSymbol(p);
                        return `${p.name}: ${checker.typeToString(pType)}`;
                    });
                    const retStr = checker.typeToString(returnType, node, ts.TypeFormatFlags.NoTruncation);
                    members.push(`  ${memberName}${optional}(${params.join(', ')}): ${retStr};`);
                }
            } else if (ts.isIndexSignatureDeclaration(member)) {
                const indexSig = checker.getSignatureFromDeclaration(member);
                if (indexSig) {
                    const param = indexSig.parameters[0];
                    if (param) {
                        const keyType = checker.typeToString(checker.getTypeOfSymbol(param));
                        const valueType = checker.typeToString(
                            checker.getReturnTypeOfSignature(indexSig),
                            node,
                            ts.TypeFormatFlags.NoTruncation,
                        );
                        members.push(`  [${param.name}: ${keyType}]: ${valueType};`);
                    }
                }
            }
        }

        return `interface ${name} {\n${members.join('\n')}\n}`;
    }

    /** The first class of this name among the program's source files (live lookup by name, as getClassType always did). */
    findClass(className: string): ts.ClassDeclaration | null {
        let classNode: ts.ClassDeclaration | null = null;
        for (const sourceFile of this.program.getSourceFiles()) {
            if (!this.isSource(sourceFile)) continue;
            ts.forEachChild(sourceFile, (node) => {
                if (!classNode && ts.isClassDeclaration(node) && node.name?.text === className) {
                    classNode = node;
                }
            });
            if (classNode) break;
        }
        return classNode;
    }

    /**
     * Arr, summon the full type information of a class from the void — its public
     * methods, properties, getters, and constructor-promoted parameters be catalogued,
     * and all referenced interfaces dragged from the deep alongside them.
     * Corporeal laws unwritten demand that private and protected members stay hidden.
     */
    computeClassType(className: string): IClassTypeResult | null {
        try {
            const classNode = this.findClass(className);
            return classNode ? this.classTypeOf(classNode) : null;
        } catch (e) {
            console.error('[CompilerCache] Error extracting class type:', e);
            return null;
        }
    }

    /** Der Klassen-Typ einer gegebenen Klassen-Deklaration (Body von computeClassType). */
    private classTypeOf(classNode: ts.ClassDeclaration): IClassTypeResult {
        const checker = this.checker;
        const members: Record<string, string> = {};
        const referencedTypeNames = new Set<string>();

        for (const member of classNode.members) {
            if (!TypeDefExtractor.isPublic(member)) continue;

            if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                const name = member.name.text;
                const sig = checker.getSignatureFromDeclaration(member);
                if (!sig) continue;

                const returnType = checker.getReturnTypeOfSignature(sig);
                const params = sig.parameters.map((p) => {
                    const pType = checker.getTypeOfSymbol(p);
                    return `${p.name}: ${checker.typeToString(pType)}`;
                });
                const retStr = checker.typeToString(returnType, member, ts.TypeFormatFlags.NoTruncation);
                members[name] = `(${params.join(', ')}) => ${retStr}`;

                for (const p of sig.parameters) {
                    this.collectReferencedTypes(checker.getTypeOfSymbol(p), referencedTypeNames);
                }
                this.collectReferencedTypes(returnType, referencedTypeNames);
            }

            if (ts.isGetAccessorDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                const name = member.name.text;
                const sig = checker.getSignatureFromDeclaration(member);
                if (sig) {
                    const returnType = checker.getReturnTypeOfSignature(sig);
                    members[name] = checker.typeToString(returnType, member, ts.TypeFormatFlags.NoTruncation);
                    this.collectReferencedTypes(returnType, referencedTypeNames);
                }
            }

            if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                const name = member.name.text;
                const symbol = checker.getSymbolAtLocation(member.name);
                if (symbol) {
                    const propType = checker.getTypeOfSymbol(symbol);
                    members[name] = checker.typeToString(propType, member, ts.TypeFormatFlags.NoTruncation);
                    this.collectReferencedTypes(propType, referencedTypeNames);
                }
            }

            if (ts.isParameter(member) && member.name && ts.isIdentifier(member.name)) {
                const name = member.name.text;
                const symbol = checker.getSymbolAtLocation(member.name);
                if (symbol) {
                    const propType = checker.getTypeOfSymbol(symbol);
                    members[name] = checker.typeToString(propType, member, ts.TypeFormatFlags.NoTruncation);
                    this.collectReferencedTypes(propType, referencedTypeNames);
                }
            }
        }

        const ctor = classNode.members.find(ts.isConstructorDeclaration);
        if (ctor) {
            for (const param of ctor.parameters) {
                const modFlags = ts.getCombinedModifierFlags(param);
                const isPromoted = modFlags & (ts.ModifierFlags.Public | ts.ModifierFlags.Readonly);
                const isPrivateOrProtected = modFlags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected);
                if (isPromoted && !isPrivateOrProtected && ts.isIdentifier(param.name)) {
                    const name = param.name.text;
                    if (members[name]) continue;
                    const symbol = checker.getSymbolAtLocation(param.name);
                    if (symbol) {
                        const propType = checker.getTypeOfSymbol(symbol);
                        members[name] = checker.typeToString(propType, param, ts.TypeFormatFlags.NoTruncation);
                        this.collectReferencedTypes(propType, referencedTypeNames);
                    }
                }
            }
        }

        const interfaceDefs: string[] = [];
        for (const typeName of referencedTypeNames) {
            const def = this.emitInterfaceDefinition(typeName);
            if (def) interfaceDefs.push(def);
        }

        return {
            members,
            referencedInterfaces: interfaceDefs.join('\n\n'),
        };
    }

    /** Alle Quelltyp-Namen aus `createPact(..., { fromSourceType: 'X' })`-Aufrufen dieser Dateien, in Fundreihenfolge. */
    static pactSourceTypeNames(files: readonly ts.SourceFile[]): string[] {
        const sourceTypeNames = new Set<string>();
        for (const sourceFile of files) {
            const visit = (node: ts.Node): void => {
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'createPact') {
                    const arg2 = node.arguments[1];
                    if (arg2 && ts.isObjectLiteralExpression(arg2)) {
                        for (const prop of arg2.properties) {
                            if (
                                ts.isPropertyAssignment(prop) &&
                                ts.isIdentifier(prop.name) &&
                                prop.name.text === 'fromSourceType' &&
                                ts.isStringLiteral(prop.initializer)
                            ) {
                                sourceTypeNames.add(prop.initializer.text);
                            }
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };
            ts.forEachChild(sourceFile, visit);
        }
        return [...sourceTypeNames];
    }

    /** Die Top-Level-Klassen dieser Dateien, je Name die erste (Fundreihenfolge). */
    static topLevelClasses(files: readonly ts.SourceFile[]): Map<string, ts.ClassDeclaration> {
        const classes = new Map<string, ts.ClassDeclaration>();
        for (const sourceFile of files) {
            ts.forEachChild(sourceFile, (node) => {
                if (ts.isClassDeclaration(node) && node.name && !classes.has(node.name.text)) {
                    classes.set(node.name.text, node);
                }
            });
        }
        return classes;
    }

    /**
     * Build-Schritt (frueher `CompilerCache.computeForBuild`): sammelt aus `scanFiles` alle Pact-Quelltypen
     * (`createPact(..., { fromSourceType })`) und fuer jede Top-Level-Klasse das ClassType-Result — mit einem
     * einzigen ts.Program fuer den ganzen Lauf. Ohne `scanFiles`: alle Quelldateien des Programms.
     */
    compute(scanFiles: readonly ts.SourceFile[] = this.sourceFiles()): TypeDefsPayload {
        const pactReturnTypes: Record<string, string> = {};
        for (const name of TypeDefExtractor.pactSourceTypeNames(scanFiles)) {
            pactReturnTypes[name] = this.buildPactReturnTypeDef(name);
        }
        const classTypes: Record<string, IClassTypeResult> = {};
        for (const [className, node] of TypeDefExtractor.topLevelClasses(scanFiles)) {
            try {
                classTypes[className] = this.classTypeOf(node);
            } catch (e) {
                console.error('[CompilerCache] Error extracting class type:', e);
            }
        }
        return { pactReturnTypes, classTypes };
    }
}
