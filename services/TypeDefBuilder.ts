import { CompilerCache } from './CompilerCache';
import { MimicDog } from '@slopdogs/core';

/**
 * Arr, the TypeDefBuilder be the shipwright of TypeScript type definitions —
 * forging declarations from brooding gulfs of runtime context so that Monaco
 * and the crew's IntelliSense may peer into the void and know what eldritch
 * shapes their variables take. Through endless faces countless forms, it maps
 * values to types and conjures global declarations from the abyss.
 */
export class TypeDefBuilder {

    /** A cursed ledger mapping pact names to their return type definitions, plundered from the deep. */
    private static pactReturnTypes: Map<string, string> = new Map();

    /**
     * Eindeutiger TypeScript-Alias pro Hund-Instanz, damit sich globale `declare global`-Blöcke
     * in Monaco nicht gegenseitig überschreiben (vorher überall `__ExpectedReturn`).
     */
    public static expectedReturnAliasTypeName(uniqueInstanceKey: string): string {
        const sanitized = String(uniqueInstanceKey)
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[^a-zA-Z_]/, '_');
        return `ExpectedReturn_${sanitized || 'Instance'}`;
    }

    /**
     * Registriert den erwarteten Return-Type fuer einen Pact-Namen.
     * Wird von aussen aufgerufen, z.B. beim Startup.
     */
    public static registerPactReturnType(pactName: string, typeDefinition: string): void {
        this.pactReturnTypes.set(pactName, typeDefinition);
    }

    /**
     * Registriert alle Pact-Klassen: liest name, __pactReturnTypeDef oder __pactSourceTypeName.
     * Bei fromSourceType wird der Typ-String einmal pro Batch aus dem CompilerCache geladen.
     */
    public static registerPacts(pactClasses: (new () => { name: string })[]): void {
        const fromSource: { pactName: string; sourceTypeName: string }[] = [];
        for (const PactClass of pactClasses) {
            const instance = new PactClass();
            const typeDef = (PactClass as any).__pactReturnTypeDef as string | undefined;
            const sourceTypeName = (PactClass as any).__pactSourceTypeName as string | undefined;
            if (typeDef) {
                this.pactReturnTypes.set(instance.name, typeDef);
            } else if (sourceTypeName) {
                fromSource.push({ pactName: instance.name, sourceTypeName });
            }
        }
        if (fromSource.length === 0) return;
        const defs = CompilerCache.getPactReturnTypeDefsBatch(fromSource.map((e) => e.sourceTypeName));
        for (const { pactName, sourceTypeName } of fromSource) {
            const resolved = defs.get(sourceTypeName);
            if (!resolved) {
                throw new Error(
                    `[TypeDefBuilder] Kein Typ-String für Pact "${pactName}" (Quelle: ${sourceTypeName}).`
                );
            }
            this.pactReturnTypes.set(pactName, resolved);
        }
    }

    /**
     * Arr, this be the grand ritual — building a full TypeScript context library
     * from the raw name and runtime context of a dog node. The void yields
     * interface definitions, global declarations, and mimic return types,
     * all woven together so the crew's editor may navigate the eldritch depths.
     * @param rawName - The raw node name, to be sanitized by corporeal laws unwritten.
     * @param ctx - The runtime context object whose properties become global types.
     * @param dog - An optional dog instance; if a MimicDog, its pact return type be conjured.
     * @param uniqueInstanceKey - An optional key to generate a unique ExpectedReturn alias from the abyss.
     * @returns A TypeScript declaration string for Monaco, plundered from the deep.
     */
    public static buildContextLib(rawName: string, ctx: any, dog?: any, uniqueInstanceKey?: string): string {
        const typeName = this.safeTypeName(rawName);
        const expectedReturnTypeName =
            uniqueInstanceKey != null && uniqueInstanceKey !== ''
                ? this.expectedReturnAliasTypeName(uniqueInstanceKey)
                : '__ExpectedReturn';
        let interfaceDefs = "";

        for (const value of Object.values(ctx)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const proto = Object.getPrototypeOf(value);
                if (proto && proto !== Object.prototype) {
                    const className = value.constructor?.name;
                    if (className && className !== 'Object') {
                        const classType = CompilerCache.getClassType(className);
                        if (classType?.referencedInterfaces) {
                            interfaceDefs += classType.referencedInterfaces + "\n";
                        }
                    }
                }
            }
        }

        const typeBody = this.valueToType(ctx, 1);

        let globalVars = "";
        Object.keys(ctx).forEach(key => {
            globalVars += `
            declare global {
            type ${key} = ${this.valueToType(ctx[key], 2) };

            const ${key}: ${key};
          }
      `;
        });

        let mimicReturnDefs = '';
        let expectedReturnAlias = `type ${expectedReturnTypeName} = any;`;
        if (dog && dog instanceof MimicDog && (dog as MimicDog<unknown>).imitatesName) {
            const pactType = this.pactReturnTypes.get((dog as MimicDog<unknown>).imitatesName);
            if (pactType) {
                mimicReturnDefs = pactType;
                const lastTypeLine = pactType.trim().split('\n').pop()?.trim() ?? '';
                const match = lastTypeLine.match(/^type\s+(\w+)\s*=/);
                if (match) {
                    expectedReturnAlias = `type ${expectedReturnTypeName} = ${match[1]};`;
                }
            }
        }

        const mimicGlobalBlock = `declare global {\n${mimicReturnDefs}\n${expectedReturnAlias}\n}`;

        return `
${interfaceDefs}
${mimicGlobalBlock}
${globalVars}

export type ${typeName} = ${typeBody};

${this.buildGlobals(typeName, ctx)}

`;
    }

    /**
     * Purifies a name so it may serve as a TypeScript type identifier —
     * the void tolerates no forbidden glyphs, and the carrion hordes
     * would feast upon any unsanitized name that dared enter the type system.
     * @param name - The raw name to sanitize.
     * @returns A safe TypeScript type name prefixed with "Node_".
     */
    private static safeTypeName(name: string): string {
        return (
            "Node_" +
            name
                .replace(/[^a-zA-Z0-9_]/g, "_")
                .replace(/^[^a-zA-Z_]/, "_")
        );
    }

    /**
     * Conjures `declare global` blocks for each key in the context,
     * binding them to the parent type — so the crew may access these
     * eldritch globals from anywhere in the void without import rituals.
     * @param typeName - The parent type name from which properties be indexed.
     * @param ctx - The context object whose keys become global constants.
     * @returns A string of global declarations, one per context key.
     */
    private static buildGlobals(typeName: string, ctx: any): string {
        return Object.keys(ctx)
            .map(
                key =>
                    `declare global {\n  const ${key}: ${typeName}["${key}"];\n}`
            )
            .join("\n");
    }

    /**
     * Arr, peer into the abyss of a runtime value and divine its TypeScript type —
     * through endless faces countless forms: strings, numbers, booleans, arrays,
     * objects with prototypes from brooding gulfs, and functions whose arguments
     * be naught but `any`. The deep reveals all to those who dare look.
     * @param value - The runtime value to inspect, plundered from the context.
     * @param indent - The current indentation depth for nested object formatting.
     * @returns A TypeScript type string representing the value's eldritch shape.
     */
    private static valueToType(value: any, indent: number): string {
        const pad = (n: number) => "  ".repeat(n);

        if (value === null) return "null";

        if (Array.isArray(value)) {
            if (value.length === 0) return "any[]";
            return `${this.valueToType(value[0], indent)}[]`;
        }

        switch (typeof value) {
            case "string": return "string";
            case "number": return "number";
            case "boolean": return "boolean";

            case "function": {
                const args = Array.from(
                    { length: value.length },
                    (_, i) => `arg${i}: any`
                ).join(", ");
                const isAsync = value.constructor?.name === 'AsyncFunction';
                const returnType = isAsync ? 'Promise<any>' : 'any';
                return `(${args}) => ${returnType}`;
            }

            case "object": {
                const proto = Object.getPrototypeOf(value);

                if (proto && proto !== Object.prototype) {
                    const className = value.constructor?.name;
                    if (className && className !== 'Object') {
                        const classType = CompilerCache.getClassType(className);
                        if (classType) {
                            const lines = Object.entries(classType.members).map(
                                ([k, v]) => `${pad(indent)}${k}: ${v};`
                            );
                            if (!lines.length) return "{}";
                            return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
                        }
                    }

                    const entries: [string, any][] = Object.entries(value);
                    for (const key of Object.getOwnPropertyNames(proto)) {
                        if (key === 'constructor') continue;
                        const desc = Object.getOwnPropertyDescriptor(proto, key);
                        if (!desc) continue;

                        if (desc.get) {
                            try {
                                entries.push([key, desc.get.call(value)]);
                            } catch {
                                entries.push([key, undefined]);
                            }
                        } else if (typeof desc.value === 'function') {
                            entries.push([key, desc.value]);
                        }
                    }

                    if (!entries.length) return "{}";
                    const lines = entries.map(
                        ([k, v]) => `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
                    );
                    return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
                }

                const entries: [string, any][] = Object.entries(value);
                if (!entries.length) return "{}";

                const lines = entries.map(
                    ([k, v]) =>
                        `${pad(indent)}${k}: ${this.valueToType(v, indent + 1)};`
                );

                return `{\n${lines.join("\n")}\n${pad(indent - 1)}}`;
            }

            default:
                return "any";
        }
    }
}
