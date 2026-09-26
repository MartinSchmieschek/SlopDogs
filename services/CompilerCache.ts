import * as ts from 'typescript';
import * as path from 'path';

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

/**
 * Arr, the CompilerCache be the eldritch engine that summons the TypeScript compiler
 * from the abyss, parses the project's tsconfig, and plunders type information
 * from brooding gulfs of source files. Through endless faces countless forms —
 * classes, interfaces, enums, and type aliases — it extracts what the crew needs
 * for IntelliSense, pact return types, and the void's own schema definitions.
 */
export class CompilerCache {

    /** Materialisierter Cache: Pact-Source-Typname → Return-Typ-Definition. Wird in int/prod aus dist/type-defs.json geladen. */
    private static pactReturnTypeCache: Map<string, string> = new Map();

    /** Materialisierter Cache: Klassenname → IClassTypeResult. Wird in int/prod aus dist/type-defs.json geladen. */
    private static classTypeCache: Map<string, IClassTypeResult> = new Map();

    /** Wenn false (int/prod nach loadPrecomputed), wird kein ts.createProgram zur Laufzeit aufgerufen. */
    private static useLiveCompiler: boolean = true;

    /**
     * Lädt vorbereitete Type-Definitions aus dem Build-Output und unterbindet Live-Kompilierung.
     * Wird beim Startup von main.ts in NODE_ENV=production|integration aufgerufen.
     */
    public static loadPrecomputed(payload: {
        pactReturnTypes: Record<string, string>;
        classTypes: Record<string, IClassTypeResult>;
    }): void {
        this.pactReturnTypeCache = new Map(Object.entries(payload.pactReturnTypes ?? {}));
        this.classTypeCache = new Map(Object.entries(payload.classTypes ?? {}));
        this.useLiveCompiler = false;
    }

    /**
     * Summons a TypeScript program and its type checker from the deep —
     * reading the tsconfig.json like an ancient scroll and forging a compiler
     * instance so the crew may interrogate the void for type information.
     * @returns An object bearing the program and checker, plundered from the abyss.
     */
    private static createProgram(): { program: ts.Program; checker: ts.TypeChecker } {
        const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
        if (!configPath) throw new Error('tsconfig.json not found');
        const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(
            configFile.config, ts.sys, path.dirname(configPath)
        );
        const program = ts.createProgram(parsed.fileNames, parsed.options);
        return { program, checker: program.getTypeChecker() };
    }

    /**
     * Determines whether a declaration be visible to the crew — only those members
     * not marked private or protected may be plundered from the class's hull.
     * @param node - The declaration node to inspect for access modifiers.
     * @returns True if the member be public, false if it lurks in the deep.
     */
    private static isPublic(node: ts.Declaration): boolean {
        const flags = ts.getCombinedModifierFlags(node);
        return !(flags & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected));
    }

    /**
     * Descends into the recursive abyss of a type, collecting all referenced
     * interface names — through unions, intersections, type arguments, and arrays,
     * the carrion hordes of nested types be catalogued so none escape the void.
     * @param checker - The type checker, an oracle of the deep.
     * @param type - The type to recursively plunder for references.
     * @param collected - A set accumulating the names of discovered interfaces.
     */
    private static collectReferencedTypes(
        checker: ts.TypeChecker,
        type: ts.Type,
        collected: Set<string>
    ): void {
        if (type.isUnion()) {
            for (const t of type.types) {
                this.collectReferencedTypes(checker, t, collected);
            }
            return;
        }

        if (type.isIntersection()) {
            for (const t of type.types) {
                this.collectReferencedTypes(checker, t, collected);
            }
            return;
        }

        const symbol = type.aliasSymbol ?? type.getSymbol();
        if (symbol) {
            const decls = symbol.getDeclarations();
            if (decls && decls.length > 0) {
                const decl = decls[0];
                const sourceFile = decl.getSourceFile();
                if (!sourceFile.isDeclarationFile && ts.isInterfaceDeclaration(decl)) {
                    const name = symbol.getName();
                    if (!collected.has(name)) {
                        collected.add(name);
                        for (const member of type.getProperties()) {
                            const memberType = checker.getTypeOfSymbol(member);
                            this.collectReferencedTypes(checker, memberType, collected);
                        }
                    }
                }
            }
        }

        const typeArgs = (type as ts.TypeReference).typeArguments;
        if (typeArgs) {
            for (const arg of typeArgs) {
                this.collectReferencedTypes(checker, arg, collected);
            }
        }

        if (checker.isArrayType(type)) {
            const elementType = (type as ts.TypeReference).typeArguments?.[0];
            if (elementType) {
                this.collectReferencedTypes(checker, elementType, collected);
            }
        }
    }

    /**
     * Searches the program's source files for an interface declaration and emits
     * its definition as a string — dragging the eldritch shape from brooding gulfs
     * into a form the crew can embed in generated type libraries.
     * @param checker - The type checker oracle from the void.
     * @param interfaceName - The name of the interface to plunder.
     * @param program - The TypeScript program harboring the source files.
     * @returns The interface definition string, or null if the abyss yields nothing.
     */
    private static emitInterfaceDefinition(
        checker: ts.TypeChecker,
        interfaceName: string,
        program: ts.Program
    ): string | null {
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue;
            const result = this.findInterfaceInFile(sourceFile, interfaceName);
            if (result) {
                return this.interfaceNodeToString(checker, result);
            }
        }
        return null;
    }

    /**
     * Scours a single source file for an interface declaration bearing the given name —
     * like a pirate scouring a shipwreck for a specific piece of plunder in the deep.
     * @param sourceFile - The source file to search through.
     * @param name - The interface name sought by the crew.
     * @returns The interface declaration node, or null if the void conceals it.
     */
    private static findInterfaceInFile(
        sourceFile: ts.SourceFile,
        name: string
    ): ts.InterfaceDeclaration | null {
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

    /**
     * Hunts through a source file for any named type declaration — interface, type alias,
     * or enum — through endless faces countless forms the quarry may take,
     * but the crew shall find it if it lurks within this file.
     * @param sourceFile - The source file to plunder.
     * @param name - The declaration name to seek in the abyss.
     * @returns The found declaration node, or null if the deep keeps its secrets.
     */
    private static findNamedTypeDeclarationInSourceFile(
        sourceFile: ts.SourceFile,
        name: string
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

    /**
     * Arr, traverse ALL non-declaration source files in the program, seeking a named
     * type declaration from brooding gulfs — the first match be claimed as plunder.
     * @param program - The TypeScript program whose files harbor the quarry.
     * @param name - The type name to hunt across the entire codebase.
     * @returns The declaration node, or null if it be lost to the void.
     */
    private static findNamedTypeDeclaration(
        program: ts.Program,
        name: string
    ): ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | null {
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue;
            const decl = this.findNamedTypeDeclarationInSourceFile(sourceFile, name);
            if (decl) return decl;
        }
        return null;
    }

    /** A printer forged in the void, stripping comments as one strips barnacles from a cursed hull. */
    private static readonly pactPrinter = ts.createPrinter({ removeComments: true });

    /**
     * Prints an enum declaration and appends a return-type alias — the enum's
     * eldritch form be captured in text so the pact system may wield it.
     * @param node - The enum declaration node, dragged from the deep.
     * @returns The printed enum text with its Return type alias appended.
     */
    private static enumNodeToPactDef(node: ts.EnumDeclaration): string {
        const text = this.pactPrinter.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).trim();
        const name = node.name.text;
        return `${text}\ntype ${name}Return = ${name};`;
    }

    /**
     * Resolves a type alias into its full pact definition — collecting referenced
     * interfaces from the abyss and printing the alias alongside them, so the
     * carrion hordes of dependent types be properly declared for the crew.
     * @param checker - The type checker, peering into the void on our behalf.
     * @param node - The type alias declaration node to process.
     * @param program - The program from which referenced interfaces be plundered.
     * @returns The complete pact definition string with all referenced interfaces.
     */
    private static typeAliasNodeToPactDef(
        checker: ts.TypeChecker,
        node: ts.TypeAliasDeclaration,
        program: ts.Program
    ): string {
        const name = node.name.text;
        const symbol = checker.getSymbolAtLocation(node.name);
        if (!symbol) {
            throw new Error(`[CompilerCache] Kein Symbol für Type-Alias "${name}".`);
        }
        const declared = checker.getDeclaredTypeOfSymbol(symbol);
        const collected = new Set<string>();
        this.collectReferencedTypes(checker, declared, collected);
        collected.delete(name);

        const interfaceDefs: string[] = [];
        for (const typeName of [...collected].sort()) {
            const def = this.emitInterfaceDefinition(checker, typeName, program);
            if (def) interfaceDefs.push(def);
        }

        const aliasText = this.pactPrinter.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile()).trim();
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
                this.collectEnumNamesFromTypeNode(t, out);
            }
            return;
        }
        if (ts.isArrayTypeNode(node)) {
            this.collectEnumNamesFromTypeNode(node.elementType, out);
        }
    }

    /**
     * Plunders an interface declaration for enum references lurking within its
     * property signatures — each referenced type name be added to the set,
     * lest the carrion hordes of missing enums haunt the generated definitions.
     * @param iface - The interface declaration to inspect.
     * @param out - The set accumulating discovered enum names from the deep.
     */
    private static collectReferencedEnumNamesFromInterface(iface: ts.InterfaceDeclaration, out: Set<string>): void {
        for (const member of iface.members) {
            if (ts.isPropertySignature(member) && member.type) {
                this.collectEnumNamesFromTypeNode(member.type, out);
            }
        }
    }

    /**
     * Finds and emits all enum declarations referenced by an interface —
     * dredging them from the program's source files so they may accompany
     * the interface definition on its voyage through the void.
     * @param program - The TypeScript program harboring the enum declarations.
     * @param iface - The interface whose referenced enums be sought.
     * @returns A string of printed enum declarations, joined from the abyss.
     */
    private static emitReferencedEnumsForInterface(
        program: ts.Program,
        iface: ts.InterfaceDeclaration
    ): string {
        const names = new Set<string>();
        this.collectReferencedEnumNamesFromInterface(iface, names);
        const blocks: string[] = [];
        for (const en of [...names].sort()) {
            const d = this.findNamedTypeDeclaration(program, en);
            if (d && ts.isEnumDeclaration(d)) {
                blocks.push(
                    this.pactPrinter.printNode(ts.EmitHint.Unspecified, d, d.getSourceFile()).trim()
                );
            }
        }
        return blocks.join('\n\n');
    }

    /**
     * Arr, the heart of the pact type resolution — locates a named type declaration
     * (interface, enum, or type alias) and builds its full return type definition
     * from brooding gulfs of the compiler. Throws if the symbol be lost to the void.
     * @param symbolName - The source type name to resolve, as whispered by the pact.
     * @param program - The TypeScript program containing the declaration.
     * @param checker - The type checker for resolving the eldritch type details.
     * @returns The complete pact return type definition string.
     */
    private static buildPactReturnTypeDef(
        symbolName: string,
        program: ts.Program,
        checker: ts.TypeChecker
    ): string {
        const decl = this.findNamedTypeDeclaration(program, symbolName);
        if (!decl) {
            throw new Error(
                `[CompilerCache] Pact-Quelltyp "${symbolName}" nicht gefunden. Prüfe Schreibweise und ob die Quell-Datei über tsconfig.json eingebunden ist (nicht nur Deklarationen in node_modules).`
            );
        }
        if (ts.isInterfaceDeclaration(decl)) {
            const enumBlock = this.emitReferencedEnumsForInterface(program, decl);
            const iface = this.interfaceNodeToString(checker, decl);
            const prefix = enumBlock ? `${enumBlock}\n\n` : '';
            return `${prefix}${iface}\ntype ${symbolName}Return = ${symbolName};`;
        }
        if (ts.isEnumDeclaration(decl)) {
            return this.enumNodeToPactDef(decl);
        }
        if (ts.isTypeAliasDeclaration(decl)) {
            return this.typeAliasNodeToPactDef(checker, decl, program);
        }
        throw new Error(`[CompilerCache] Unsupported declaration for Pact-Quelltyp "${symbolName}".`);
    }

    /**
     * Löst mehrere Pact-Return-Typ-Strings auf. In int/prod aus dem vorbereiteten Cache;
     * in dev wird ein einmaliges ts.Program gespannt.
     */
    static getPactReturnTypeDefsBatch(symbolNames: string[]): Map<string, string> {
        const result = new Map<string, string>();
        const unique = [...new Set(symbolNames)];
        if (unique.length === 0) return result;

        const missing: string[] = [];
        for (const name of unique) {
            const cached = this.pactReturnTypeCache.get(name);
            if (cached !== undefined) result.set(name, cached);
            else missing.push(name);
        }
        if (missing.length === 0) return result;

        if (!this.useLiveCompiler) {
            throw new Error(
                `[CompilerCache] Vorbereitete Type-Definitions fehlen für: ${missing.join(', ')}. ` +
                `Build neu erzeugen (npm run build:prod / build:integration).`
            );
        }

        const { program, checker } = this.createProgram();
        for (const symbolName of missing) {
            const def = this.buildPactReturnTypeDef(symbolName, program, checker);
            this.pactReturnTypeCache.set(symbolName, def);
            result.set(symbolName, def);
        }
        return result;
    }

    /**
     * Resolves a single pact return type definition by summoning a fresh compiler
     * from the abyss — less efficient than the batch method, but suitable when
     * only one eldritch symbol must be plundered from the deep.
     * @param symbolName - The source type name to resolve.
     * @returns The pact return type definition string, conjured from the void.
     */
    static getPactReturnTypeDef(symbolName: string): string {
        const cached = this.pactReturnTypeCache.get(symbolName);
        if (cached !== undefined) return cached;
        if (!this.useLiveCompiler) {
            throw new Error(
                `[CompilerCache] Vorbereitete Type-Definition fehlt für "${symbolName}". Build neu erzeugen.`
            );
        }
        const { program, checker } = this.createProgram();
        const def = this.buildPactReturnTypeDef(symbolName, program, checker);
        this.pactReturnTypeCache.set(symbolName, def);
        return def;
    }

    /**
     * Converts an interface declaration node into a readable TypeScript string —
     * each property, method, and index signature be transcribed from the AST
     * like ancient runes copied from a tablet found in the brooding gulfs.
     * @param checker - The type checker for resolving member types from the void.
     * @param node - The interface declaration to serialize.
     * @returns A TypeScript interface definition string, plundered from the AST.
     */
    private static interfaceNodeToString(
        checker: ts.TypeChecker,
        node: ts.InterfaceDeclaration
    ): string {
        const name = node.name.text;
        const members: string[] = [];

        for (const member of node.members) {
            if (ts.isPropertySignature(member) && member.name) {
                const memberName = (member.name as ts.Identifier).text;
                const optional = member.questionToken ? '?' : '';
                let typeStr: string | undefined;
                if (member.type) {
                    const t = checker.getTypeAtLocation(member.type);
                    typeStr = checker.typeToString(
                        t,
                        member.type,
                        ts.TypeFormatFlags.NoTruncation
                    );
                } else {
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const memberType = checker.getTypeOfSymbol(symbol);
                        typeStr = checker.typeToString(
                            memberType, node, ts.TypeFormatFlags.NoTruncation
                        );
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
                    const params = sig.parameters.map(p => {
                        const pType = checker.getTypeOfSymbol(p);
                        return `${p.name}: ${checker.typeToString(pType)}`;
                    });
                    const retStr = checker.typeToString(
                        returnType, node, ts.TypeFormatFlags.NoTruncation
                    );
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
                            ts.TypeFormatFlags.NoTruncation
                        );
                        members.push(`  [${param.name}: ${keyType}]: ${valueType};`);
                    }
                }
            }
        }

        return `interface ${name} {\n${members.join('\n')}\n}`;
    }

    /**
     * Arr, summon the full type information of a class from the void — its public
     * methods, properties, getters, and constructor-promoted parameters be catalogued,
     * and all referenced interfaces dragged from the deep alongside them.
     * Corporeal laws unwritten demand that private and protected members stay hidden.
     * @param className - The name of the class to plunder for type information.
     * @returns The class type result with members and referenced interfaces, or null if the abyss yields nothing.
     */
    static getClassType(className: string): IClassTypeResult | null {
        const cached = this.classTypeCache.get(className);
        if (cached !== undefined) return cached;
        if (!this.useLiveCompiler) return null;
        try {
            const { program, checker } = this.createProgram();
            const result = this.computeClassType(className, program, checker);
            if (result) this.classTypeCache.set(className, result);
            return result;
        } catch (e) {
            console.error('[CompilerCache] Error extracting class type:', e);
            return null;
        }
    }

    /**
     * Extrahierter Body von getClassType — operiert auf einem von außen übergebenen Program/Checker,
     * damit der Build-Schritt alle Klassen mit einem einzigen ts.Program berechnen kann.
     */
    private static computeClassType(
        className: string,
        program: ts.Program,
        checker: ts.TypeChecker
    ): IClassTypeResult | null {
        try {
            const members: Record<string, string> = {};
            const referencedTypeNames = new Set<string>();
            let classNode: ts.ClassDeclaration | null = null;

            for (const sourceFile of program.getSourceFiles()) {
                if (sourceFile.isDeclarationFile) continue;
                ts.forEachChild(sourceFile, (node) => {
                    if (ts.isClassDeclaration(node) && node.name?.text === className) {
                        classNode = node;
                    }
                });
                if (classNode) break;
            }

            if (!classNode) return null;

            for (const member of (classNode as ts.ClassDeclaration).members) {
                if (!this.isPublic(member)) continue;

                if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const sig = checker.getSignatureFromDeclaration(member);
                    if (!sig) continue;

                    const returnType = checker.getReturnTypeOfSignature(sig);
                    const params = sig.parameters.map(p => {
                        const pType = checker.getTypeOfSymbol(p);
                        return `${p.name}: ${checker.typeToString(pType)}`;
                    });
                    const retStr = checker.typeToString(
                        returnType, member, ts.TypeFormatFlags.NoTruncation
                    );
                    members[name] = `(${params.join(', ')}) => ${retStr}`;

                    for (const p of sig.parameters) {
                        this.collectReferencedTypes(checker, checker.getTypeOfSymbol(p), referencedTypeNames);
                    }
                    this.collectReferencedTypes(checker, returnType, referencedTypeNames);
                }

                if (ts.isGetAccessorDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const sig = checker.getSignatureFromDeclaration(member);
                    if (sig) {
                        const returnType = checker.getReturnTypeOfSignature(sig);
                        members[name] = checker.typeToString(
                            returnType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, returnType, referencedTypeNames);
                    }
                }

                if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const propType = checker.getTypeOfSymbol(symbol);
                        members[name] = checker.typeToString(
                            propType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, propType, referencedTypeNames);
                    }
                }

                if (ts.isParameter(member) && member.name && ts.isIdentifier(member.name)) {
                    const name = member.name.text;
                    const symbol = checker.getSymbolAtLocation(member.name);
                    if (symbol) {
                        const propType = checker.getTypeOfSymbol(symbol);
                        members[name] = checker.typeToString(
                            propType, member, ts.TypeFormatFlags.NoTruncation
                        );
                        this.collectReferencedTypes(checker, propType, referencedTypeNames);
                    }
                }
            }

            const ctor = (classNode as ts.ClassDeclaration).members.find(ts.isConstructorDeclaration);
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
                            members[name] = checker.typeToString(
                                propType, param, ts.TypeFormatFlags.NoTruncation
                            );
                            this.collectReferencedTypes(checker, propType, referencedTypeNames);
                        }
                    }
                }
            }

            const interfaceDefs: string[] = [];
            for (const typeName of referencedTypeNames) {
                const def = this.emitInterfaceDefinition(checker, typeName, program);
                if (def) interfaceDefs.push(def);
            }

            return {
                members,
                referencedInterfaces: interfaceDefs.join('\n\n')
            };
        } catch (e) {
            console.error('[CompilerCache] Error extracting class type:', e);
            return null;
        }
    }

    /**
     * Build-Schritt: scannt einmalig alle Quell-Dateien nach `createPact(..., { fromSourceType: 'X' })`-Aufrufen
     * und sammelt zusätzlich für jede Top-Level-Klasse das ClassType-Result. Verwendet ein einziges ts.Program
     * für den gesamten Lauf — so wird die Heap-Spitze auf Buildzeit verlagert und zur Laufzeit eliminiert.
     */
    static computeForBuild(): {
        pactReturnTypes: Record<string, string>;
        classTypes: Record<string, IClassTypeResult>;
    } {
        const { program, checker } = this.createProgram();

        const sourceTypeNames = new Set<string>();
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue;
            const visit = (node: ts.Node): void => {
                if (
                    ts.isCallExpression(node) &&
                    ts.isIdentifier(node.expression) &&
                    node.expression.text === 'createPact'
                ) {
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

        const pactReturnTypes: Record<string, string> = {};
        for (const name of sourceTypeNames) {
            pactReturnTypes[name] = this.buildPactReturnTypeDef(name, program, checker);
        }

        const classTypes: Record<string, IClassTypeResult> = {};
        const seen = new Set<string>();
        for (const sourceFile of program.getSourceFiles()) {
            if (sourceFile.isDeclarationFile) continue;
            ts.forEachChild(sourceFile, (node) => {
                if (ts.isClassDeclaration(node) && node.name && !seen.has(node.name.text)) {
                    const className = node.name.text;
                    seen.add(className);
                    const result = this.computeClassType(className, program, checker);
                    if (result) classTypes[className] = result;
                }
            });
        }

        return { pactReturnTypes, classTypes };
    }
}
