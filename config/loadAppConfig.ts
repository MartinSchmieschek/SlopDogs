// Laedt die App-Config: SLOPDOGS_CONFIG=<pfad> (relativ zum Arbeitsverzeichnis) oder die mitgelieferte —
// production/integration ohne lokalen Modus: config/default.config, sonst config/local.config (dieselbe Weiche wie
// frueher zwischen slim- und voller Registry). Nur die gewaehlte Datei wird geladen, also nur ihre Base-Dogs.
import path from 'path';
import type { AppConfig, AppDatabase } from './AppConfig';

export interface LoadedAppConfig {
    config: AppConfig<AppDatabase>;
    /** Woher: der Pfad aus SLOPDOGS_CONFIG oder `config/default.config` / `config/local.config`. */
    source: string;
}

export class AppConfigError extends Error {
    constructor(message: string) {
        super(`[config] ${message}`);
        this.name = 'AppConfigError';
    }
}

export class AppConfigLoader {
    /** Welche Datei: SLOPDOGS_CONFIG oder die mitgelieferte je Umgebung. */
    static resolve(env: NodeJS.ProcessEnv, nodeEnv: string, localMode: boolean): { file: string; source: string } {
        const explicit = env.SLOPDOGS_CONFIG?.trim();
        if (explicit) return { file: path.resolve(process.cwd(), explicit), source: explicit };
        const deployed = (nodeEnv === 'production' || nodeEnv === 'integration') && !localMode;
        const name = deployed ? 'default.config' : 'local.config';
        // Ohne Endung: unter ts-node die .ts-Datei, im Build dist/config/*.js.
        return { file: path.join(__dirname, name), source: `config/${name}` };
    }

    static load(env: NodeJS.ProcessEnv, nodeEnv: string, localMode: boolean): LoadedAppConfig {
        const { file, source } = AppConfigLoader.resolve(env, nodeEnv, localMode);
        let mod: { default?: unknown };
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- die Config steht erst zur Laufzeit fest
            mod = require(file) as { default?: unknown };
        } catch (err) {
            throw new AppConfigError(`${source} laesst sich nicht laden: ${(err as Error)?.message ?? err}`);
        }
        const config = (mod.default ?? mod) as AppConfig<AppDatabase>;
        AppConfigLoader.validate(config, source);
        return { config, source };
    }

    /** Bricht mit klarer Meldung ab, wenn die Config die Form nicht hat. */
    static validate(config: unknown, source: string): asserts config is AppConfig<AppDatabase> {
        const c = config as Partial<AppConfig<AppDatabase>> | null;
        const problems: string[] = [];
        if (!c || typeof c !== 'object') throw new AppConfigError(`${source}: kein Objekt als default-Export`);
        if (typeof c.name !== 'string' || !c.name) problems.push('name fehlt');
        for (const fn of ['database', 'cache', 'tiles'] as const) {
            if (typeof c[fn] !== 'function') problems.push(`${fn} ist keine Funktion`);
        }
        for (const list of ['dogs', 'pacts'] as const) {
            const value = c[list];
            if (!Array.isArray(value)) problems.push(`${list} ist keine Liste`);
            else if (value.some((cls) => typeof cls !== 'function')) problems.push(`${list} enthaelt etwas anderes als Klassen`);
        }
        if (typeof c.requireKennelCoverage !== 'boolean') problems.push('requireKennelCoverage fehlt');
        if (problems.length) throw new AppConfigError(`${source}: ${problems.join('; ')}`);
    }
}
