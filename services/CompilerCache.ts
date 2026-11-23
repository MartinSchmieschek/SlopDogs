import * as ts from 'typescript';
import * as path from 'path';
import {
    TypeDefExtractor,
    installedSlopdogsPackages,
    isInside,
    mergeTypeDefs,
    readPackageTypeDefs,
    slopdogsSourcePredicate,
    type IClassTypeResult,
    type MergeConflict,
    type TypeDefsPayload,
} from '@martinschmieschek/slopdogs-typedefs';

export type { IClassTypeResult };

/**
 * Summons a TypeScript program from the deep — reading the tsconfig.json like an ancient scroll —
 * and the extractor that interrogates it.
 */
function createLiveExtractor(): { program: ts.Program; extractor: TypeDefExtractor } {
    const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) throw new Error('tsconfig.json not found');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    return { program, extractor: new TypeDefExtractor(program, slopdogsSourcePredicate(program)) };
}

/**
 * Arr, the CompilerCache be the eldritch engine that summons the TypeScript compiler
 * from the abyss, parses the project's tsconfig, and plunders type information
 * from brooding gulfs of source files. Through endless faces countless forms —
 * classes, interfaces, enums, and type aliases — it extracts what the crew needs
 * for IntelliSense, pact return types, and the void's own schema definitions.
 *
 * Die Extraktion selbst steht seit P2.1 in `@martinschmieschek/slopdogs-typedefs` (TypeDefExtractor) —
 * derselbe Code, mit dem jedes Paket beim Bau sein `dist/type-defs.json` schreibt.
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
                    `Build neu erzeugen (npm run build:prod / build:integration).`,
            );
        }

        const { extractor } = createLiveExtractor();
        for (const symbolName of missing) {
            const def = extractor.buildPactReturnTypeDef(symbolName);
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
            throw new Error(`[CompilerCache] Vorbereitete Type-Definition fehlt für "${symbolName}". Build neu erzeugen.`);
        }
        const def = createLiveExtractor().extractor.buildPactReturnTypeDef(symbolName);
        this.pactReturnTypeCache.set(symbolName, def);
        return def;
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
            const result = createLiveExtractor().extractor.computeClassType(className);
            if (result) this.classTypeCache.set(className, result);
            return result;
        } catch (e) {
            console.error('[CompilerCache] Error extracting class type:', e);
            return null;
        }
    }

    /** Build-Schritt (P2.1): siehe {@link computeTypeDefsForBuild} — gemischt aus Paketen und Server. */
    static computeForBuild(): {
        pactReturnTypes: Record<string, string>;
        classTypes: Record<string, IClassTypeResult>;
    } {
        return computeTypeDefsForBuild().payload;
    }
}

/**
 * Build-Schritt (P2.1, `scripts/precompile-typedefs.cjs`): mischt die `type-defs.json` aller installierten
 * SlopDogs-Pakete (Abhaengigkeiten aus der package.json des Projekts, aufgeloest wie zur Laufzeit ueber
 * `require.resolve`) mit den Typen des Servers selbst. Fuer den Server-Anteil spannt er ein ts.Program ueber
 * die Root-tsconfig und scannt nur Dateien ausserhalb der Paketordner; Pakete liefern ihren Anteil fertig aus
 * ihrem Build. Bei gleichem Schluessel gewinnt die erste Quelle (Pakete vor dem Server), Konflikte kommen mit.
 */
export function computeTypeDefsForBuild(root: string = process.cwd()): {
    payload: TypeDefsPayload;
    conflicts: MergeConflict[];
    packages: number;
} {
    const installed = installedSlopdogsPackages(root);
    const { program, extractor } = createLiveExtractor();
    const own = program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && !installed.some((p) => isInside(sf.fileName, p.dir)));
    const sources: Array<{ label: string; payload: TypeDefsPayload }> = [];
    for (const pkg of installed) {
        const payload = readPackageTypeDefs(pkg);
        if (payload) sources.push({ label: pkg.name, payload });
    }
    const packages = sources.length;
    sources.push({ label: 'server', payload: extractor.compute(own) });
    const { payload, conflicts } = mergeTypeDefs(sources);
    return { payload, conflicts, packages };
}
