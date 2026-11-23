// BaseDogPacks — which package a base dog comes from (P6 U5, `pack` in GET /api/nodes) and in which
// version (PLAN-DOG-PAKETE P2.5, `packageName`/`packageVersion`, `dogVersions` of a run).
//
// The registries (server-registries/*Registry.ts) import every base dog from its package
// (`@martinschmieschek/slopdogs-dogs-weather`, `@martinschmieschek/slopdogs-core`, ...) and hand out a flat
// list of classes. The package is not written anywhere else, and a second hand-kept table would rot. So it is
// read from the module graph the registry has just loaded: every module whose nearest package.json names a
// SlopDogs package and whose exports hold the class. The defining file wins over an index that only re-exports it.
// Name and version come from that package.json — not from the path, so it works for any install location
// (`node_modules/@martinschmieschek/slopdogs-<name>/dist/...`).

import * as fs from 'fs';
import * as path from 'path';

type ModuleLike = { filename?: string; exports?: unknown };

/** Scope prefix of every SlopDogs package (PLAN-DOG-PAKETE E5). The visible `pack` label drops it. */
export const SLOPDOGS_PACKAGE_PREFIX = '@martinschmieschek/slopdogs-';

const INDEX_FILE = /[\\/]index\.[cm]?[jt]s$/;

/** A base dog's package: the visible label (`dogs-weather`), the npm name and its version. */
export interface DogPackage {
    pack: string;
    name: string;
    version: string;
}

/** Nearest package.json above a module file, read once per directory. */
export class PackageJsonLookup {
    private readonly byDir = new Map<string, DogPackage | null>();

    /** The SlopDogs package a file belongs to, or null (not inside one, or another package). */
    packageOf(fileName: string): DogPackage | null {
        let dir = path.dirname(fileName);
        const visited: string[] = [];
        let found: DogPackage | null = null;
        for (;;) {
            const cached = this.byDir.get(dir);
            if (cached !== undefined) {
                found = cached;
                break;
            }
            visited.push(dir);
            const manifest = PackageJsonLookup.readManifest(path.join(dir, 'package.json'));
            if (manifest) {
                found =
                    typeof manifest.name === 'string' && manifest.name.startsWith(SLOPDOGS_PACKAGE_PREFIX)
                        ? {
                              pack: manifest.name.slice(SLOPDOGS_PACKAGE_PREFIX.length),
                              name: manifest.name,
                              version: typeof manifest.version === 'string' ? manifest.version : '',
                          }
                        : null;
                break;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
        for (const v of visited) this.byDir.set(v, found);
        return found;
    }

    private static readManifest(file: string): { name?: unknown; version?: unknown } | null {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            return null; // no package.json here (or unreadable) — keep walking up
        }
    }
}

export class BaseDogPacks {
    private constructor(private readonly byClass: ReadonlyMap<Function, DogPackage>) {}

    /** Reads `require.cache` (CommonJS: ts-node in development, dist in production and integration). */
    static fromLoadedModules(
        cache: Record<string, ModuleLike | undefined> = require.cache as Record<string, ModuleLike | undefined>,
        lookup: PackageJsonLookup = new PackageJsonLookup(),
    ): BaseDogPacks {
        const found = new Map<Function, { pkg: DogPackage; viaIndex: boolean }>();
        for (const mod of Object.values(cache)) {
            if (!mod?.filename) continue;
            const pkg = lookup.packageOf(mod.filename);
            if (!pkg) continue;
            const viaIndex = INDEX_FILE.test(mod.filename);
            for (const value of BaseDogPacks.exportedFunctions(mod.exports)) {
                const known = found.get(value);
                if (!known || (known.viaIndex && !viaIndex)) found.set(value, { pkg, viaIndex });
            }
        }
        return new BaseDogPacks(new Map([...found].map(([fn, v]) => [fn, v.pkg])));
    }

    /** The package of a base dog instance or class — `dogs-weather`, `core`; null when unknown. */
    packOf(dog: unknown): string | null {
        return this.packageOf(dog)?.pack ?? null;
    }

    /** Label, npm name and version of a base dog's package; null when unknown. */
    packageOf(dog: unknown): DogPackage | null {
        if (typeof dog === 'function') return this.byClass.get(dog) ?? null;
        const ctor = (dog as { constructor?: Function } | null)?.constructor;
        return ctor ? (this.byClass.get(ctor) ?? null) : null;
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
