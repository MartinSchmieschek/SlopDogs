// Die App-Config (PLAN-CACHE-KONFIG, 10-0 24.11.): Code, kein JSON. Sie beschreibt, wie der Server an seine
// Daten kommt (database), wo er cacht (cache, tiles) und welche Base-Dogs und Pacts er laedt (dogs, pacts).
// Zugangsdaten stehen NICHT hier — die bleiben in der Env (DATABASE_URL, CACHE_DATABASE_URL, …); die Config
// bekommt sie ueber `ctx.urls`. Eine andere Config: SLOPDOGS_CONFIG=<pfad> (config/loadAppConfig.ts).
import type { IStore } from '../store/IStore';
import type { IDogStatsStore, IKennelStatsStore } from '../store/IKennelStatsStore';
import type { IUserPageStore } from '../store/IUserPageStore';
import type { SharedPrismaClients } from '../store/SharedPrismaClients';
import type { PrunableTileFeatureCache } from '../services/StoreCacheHandler';
import type { ICacheStore } from './cache/ICacheStore';

/** Was der Server vom Store braucht: Nodes/Kennels, Statistik, eigene Seiten — und Start/Ende. */
export type AppStore = IStore &
    IKennelStatsStore &
    IDogStatsStore &
    IUserPageStore & {
        init(): Promise<void>;
        disconnect(): Promise<void>;
    };

/** Die Adressen der Datenbanken — aus der Env (scripts/dbEnv.cjs), aufgeloest erst beim Aufruf. */
export interface DatabaseUrls {
    store(): string;
    cache(): string;
    jsonStorage(): string;
}

/** Was jede Config-Funktion bekommt. */
export interface ConfigContext {
    env: NodeJS.ProcessEnv;
    nodeEnv: string;
    localMode: boolean;
    urls: DatabaseUrls;
}

/** Der Datenzugang, den `database` liefert. */
export interface AppDatabase {
    store: AppStore;
    /**
     * Die Prisma-Clients fuer die Teile, die (noch) direkt an Prisma haengen: JSON-Ablage, Auth, Key-Store.
     * Ein Datenzugang ohne Prisma braucht dafuer erst eigene Schnittstellen.
     */
    clients: SharedPrismaClients;
    /** Eine Zeile fuers Log: welche Clients es gibt. */
    describe(): string;
    /** Eigene Verbindungen ausser dem Store freigeben (den trennt `store.disconnect()`). Idempotent. */
    close(): Promise<void>;
}

/** Eine Base-Dog-Klasse, wie die Registries sie fuehren: ohne Argumente baubar, mit Namen. */
export type BaseDogClass = new () => { readonly name: string };
/** Eine Pact-Klasse. */
export type PactClass = new () => { readonly name: string };

/** `D`: der Datenzugang dieser Config — cache und tiles bekommen ihn mit seinem vollen Typ. */
export interface AppConfig<D extends AppDatabase = AppDatabase> {
    /** Fuer Log und /health: welche Config laeuft. */
    name: string;
    /** Wie der Server an seine Daten kommt. Der Store ist danach initialisiert. */
    database(ctx: ConfigContext): Promise<D>;
    /** Der Cache-Speicher fuer Base-Dogs (getOrFetch) und Ergebnisse ganzer Kennel-Laeufe. */
    cache(ctx: ConfigContext, db: D): ICacheStore;
    /** Der Tile-Feature-Cache der OSM-Dogs (Features je Kachel, kein Schluessel-Wert-Speicher). */
    tiles(ctx: ConfigContext, db: D): PrunableTileFeatureCache;
    /** Die Base-Dogs, die der Server laedt. Wer hier fehlt, wird nicht importiert. */
    dogs: readonly BaseDogClass[];
    /** Die Pacts, die der Server kennt. */
    pacts: readonly PactClass[];
    /** Beim Start pruefen, dass jeder base:-Verweis der Kennels in der DB hier geladen ist (sonst Abbruch). */
    requireKennelCoverage: boolean;
}

/** Nur fuer die Typen: `export default defineConfig({ … })`. */
export function defineConfig<D extends AppDatabase>(config: AppConfig<D>): AppConfig<D> {
    return config;
}
