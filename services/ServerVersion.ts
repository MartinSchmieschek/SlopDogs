// ServerVersion — welcher Stand laeuft: Server, Commit, core, typedefs und die geladenen Dog-Pakete. Eine Quelle fuer
// GET /api/health und das MCP-Tool health_check. Die Dog-Pakete kommen aus der Versionsspur (dogVersions.ts, beim Boot
// aus den package.json der geladenen Module eingetragen); der Commit aus RENDER_GIT_COMMIT, sonst aus der Datei, die
// scripts/run-build.cjs nach dist schreibt, sonst null (dev ohne Build).
import * as fs from 'fs';
import * as path from 'path';
import { loadedDogPackages } from './dogVersions';
import { BetaKeys } from '../mcp/auth/betaKeys';

/** Der Versionsblock: nur Namen und Versionen — keine Nutzer, keine Lastzahlen, keine Adressen. */
export interface VersionBlock {
    name: string | null;
    version: string | null;
    /** Kurzer Commit-SHA (7 Zeichen) oder null. */
    commit: string | null;
    core: string | null;
    typedefs: string | null;
    /** Geladene Dog- und Pact-Pakete (ohne core): Anzahl und Pakete je Version. */
    dogs: { packages: number; versions: Record<string, number> };
}

/** Wie der Server laeuft — dieselbe Unterscheidung wie NetworkBoundary.forEnvironment. */
export type ServerMode = 'local' | 'dev' | 'deployed';

const CORE = '@martinschmieschek/slopdogs-core';
const TYPEDEFS = '@martinschmieschek/slopdogs-typedefs';
const SHA = /^[0-9a-f]{7,40}$/i;

interface Manifest {
    name?: unknown;
    version?: unknown;
}

export class ServerVersion {
    /** Von scripts/run-build.cjs neben dist/main.js geschrieben: `{ "commit": "<sha>" | null }`. */
    static readonly BUILD_INFO_FILE = 'build-info.json';

    private fixed: Omit<VersionBlock, 'dogs'> | null = null;

    /** `serverRootDir` = `__dirname` des Einstiegspunkts (Repo-Wurzel unter ts-node, `dist/` gebaut). */
    constructor(
        private readonly serverRootDir: string,
        private readonly env: NodeJS.ProcessEnv = process.env,
    ) {}

    static modeOf(nodeEnv: string, localMode: boolean): ServerMode {
        if (localMode) return 'local';
        return nodeEnv === 'production' || nodeEnv === 'integration' ? 'deployed' : 'dev';
    }

    /** Die Phase (SLOPDOGS_STAGE, bereinigt wie fuer /api/beta) oder null. */
    stage(): string | null {
        return BetaKeys.stage(this.env) || null;
    }

    /** Dateien werden einmal gelesen; die Dog-Pakete stehen erst nach dem Boot fest und werden je Aufruf gezaehlt. */
    block(): VersionBlock {
        this.fixed ??= this.readFixed();
        const versions: Record<string, number> = {};
        let packages = 0;
        for (const pkg of loadedDogPackages()) {
            if (pkg.name === CORE || pkg.name === TYPEDEFS) continue;
            packages += 1;
            versions[pkg.version] = (versions[pkg.version] ?? 0) + 1;
        }
        return { ...this.fixed, dogs: { packages, versions } };
    }

    private readFixed(): Omit<VersionBlock, 'dogs'> {
        const server = this.serverManifest();
        return {
            name: typeof server?.name === 'string' ? server.name : null,
            version: typeof server?.version === 'string' ? server.version : null,
            commit: this.commit(),
            core: ServerVersion.installedVersion(CORE),
            typedefs: ServerVersion.installedVersion(TYPEDEFS),
        };
    }

    private commit(): string | null {
        const fromEnv = (this.env.RENDER_GIT_COMMIT ?? '').trim();
        if (SHA.test(fromEnv)) return fromEnv.slice(0, 7).toLowerCase();
        const info = ServerVersion.readJson(path.join(this.serverRootDir, ServerVersion.BUILD_INFO_FILE)) as { commit?: unknown } | null;
        return typeof info?.commit === 'string' && SHA.test(info.commit) ? info.commit.slice(0, 7).toLowerCase() : null;
    }

    /** package.json des Servers: neben dem Einstiegspunkt (ts-node) oder eine Ebene darueber (dist/). */
    private serverManifest(): Manifest | null {
        for (const dir of [this.serverRootDir, path.join(this.serverRootDir, '..')]) {
            const manifest = ServerVersion.readJson(path.join(dir, 'package.json')) as Manifest | null;
            if (manifest) return manifest;
        }
        return null;
    }

    private static installedVersion(name: string): string | null {
        try {
            const manifest = ServerVersion.readJson(require.resolve(`${name}/package.json`)) as Manifest | null;
            return typeof manifest?.version === 'string' ? manifest.version : null;
        } catch {
            return null; // nicht installiert
        }
    }

    private static readJson(file: string): unknown {
        try {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
            return null; // fehlt oder unlesbar
        }
    }
}
