/**
 * Env-Variablen als Metadaten (PLAN-DOG-PAKETE P2.7). Ein Dog-Paket, das Env-Variablen liest, exportiert sie unter
 * `<paket>/env` als `envVars: readonly DogEnvVar[]`; der Server nimmt sie in seinen Katalog (ENV_CATALOG in
 * server-app/startupEnvCheck.ts) — dieselbe Form wie die Server-Eintraege, damit Startwarnung, .env-Beispiele und
 * die Katalog-Pruefung keinen Unterschied zwischen Server- und Paket-Variablen machen.
 */

/** Umgebungen, die der Dienst kennt. Alles andere zaehlt wie development. */
export type DogEnvNodeEnv = 'development' | 'integration' | 'production';

/**
 * Zusatzbedingung einer Regel:
 *   authRequired     — nur wenn MCP_AUTH_REQUIRED=true (Login an)
 *   storeNotPostgres — nur wenn DATABASE_URL KEINE Postgres-URL ist
 *   notLocalMode     — nur ohne SLOPDOGS_MODE=local (der lokale Modus laeuft als production, aber ohne Login)
 */
export type DogEnvCondition = 'authRequired' | 'storeNotPostgres' | 'notLocalMode';

export interface DogEnvRule {
    /** In welchen NODE_ENVs die Regel greift. */
    readonly in: readonly DogEnvNodeEnv[];
    /** required = Warnzeile "[env] missing"; recommended = Hinweiszeile "[env] recommended". */
    readonly level: 'required' | 'recommended';
    readonly when?: DogEnvCondition;
}

export interface DogEnvVar {
    readonly name: string;
    /** Abschnitt der .env-Dateien; Dog-Pakete stehen in `integrations`. */
    readonly section: 'required' | 'operations' | 'features' | 'integrations' | 'development' | 'internal';
    /** Kurz: wofuer. */
    readonly purpose: string;
    /** Default im Code, oder '—' wenn es keinen gibt. */
    readonly defaultValue: string;
    /** Phase, seit der der Name gilt: 'vor P1', 'P1' … 'P6-Fix', 'Beta'. */
    readonly since: string;
    /** Folge bei Fehlen, z. B. "Exit 78", "WebcamRetriever steht nicht auf". */
    readonly consequence: string;
    /** Pflicht-/Empfehlungsregeln; leer = nie gewarnt. */
    readonly rules?: readonly DogEnvRule[];
    /** Weitere Namen, die die Regel ebenso erfuellen ("eins von"). */
    readonly anyOf?: readonly string[];
    /** Frueherer Name, den der Code noch liest (envFirst) — erfuellt die Regel ebenso. */
    readonly aliases?: readonly string[];
    /** Gesetzt reicht nicht, der Wert muss genau dieser sein (MCP_AUTH_REQUIRED=true). */
    readonly requiredValue?: string;
}
