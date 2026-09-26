// BaseDogPacks — which package a base dog comes from (P6 U5, `pack` in GET /api/nodes).
//
// The registries (server-registries/*Registry.ts) import every base dog from its package
// (`@slopdogs/dogs-weather`, `@slopdogs/core`, ...) and hand out a flat list of classes. The package
// is not written anywhere else, and a second hand-kept table would rot. So the name is read from the
// module graph the registry has just loaded: every module under `packages/<name>/` whose exports hold
// the class. The defining file wins over an index that only re-exports it.

type ModuleLike = { filename?: string; exports?: unknown };

const PACKAGE_DIR = /[\\/]packages[\\/]([^\\/]+)[\\/]/;
const INDEX_FILE = /[\\/]index\.[cm]?[jt]s$/;

export class BaseDogPacks {
    private constructor(private readonly byClass: ReadonlyMap<Function, string>) { }

    /** Reads `require.cache` (CommonJS: ts-node in development, dist in production and integration). */
    static fromLoadedModules(cache: Record<string, ModuleLike | undefined> = require.cache as Record<string, ModuleLike | undefined>): BaseDogPacks {
        const found = new Map<Function, { pack: string; viaIndex: boolean }>();
        for (const mod of Object.values(cache)) {
            const match = mod?.filename ? PACKAGE_DIR.exec(mod.filename) : null;
            if (!match || !mod) continue;
            const viaIndex = INDEX_FILE.test(mod.filename!);
            for (const value of BaseDogPacks.exportedFunctions(mod.exports)) {
                const known = found.get(value);
                if (!known || (known.viaIndex && !viaIndex)) found.set(value, { pack: match[1], viaIndex });
            }
        }
        return new BaseDogPacks(new Map([...found].map(([fn, v]) => [fn, v.pack])));
    }

    /** The package of a base dog instance or class — `dogs-weather`, `core`; null when unknown. */
    packOf(dog: unknown): string | null {
        if (typeof dog === 'function') return this.byClass.get(dog) ?? null;
        const ctor = (dog as { constructor?: Function } | null)?.constructor;
        return ctor ? this.byClass.get(ctor) ?? null : null;
    }

    private static exportedFunctions(exports: unknown): Function[] {
        if (typeof exports === 'function') return [exports];
        if (!exports || typeof exports !== 'object') return [];
        const out: Function[] = [];
        for (const key of Object.keys(exports)) {
            let value: unknown;
            try {
                value = (exports as Record<string, unknown>)[key];
            } catch {
                continue; // a throwing getter must not break the boot
            }
            if (typeof value === 'function') out.push(value);
        }
        return out;
    }
}
