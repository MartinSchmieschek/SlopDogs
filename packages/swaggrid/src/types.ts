/**
 * Ein ausgeführter Knoten (Hund) in einer Welle — `essence` ist sein Lauf-Ergebnis.
 */
export type Rune = {
    id: string;
    /** SerializedDog: oft Kennel-`dogIds[0]` ist lineage, `id` in den Waves ist storageId */
    lineageId?: string;
    name: string;
    essence: unknown;
    /** z. B. Icon */
    sigil?: string;
    /** true: gebundene/serialisierte Form (in der Doku als SerializedDog) */
    bound?: boolean;
};

/**
 * Alles, was zur Spezifikation eines Rifts nötig ist — ohne Kennel-/Core-Typen.
 */
export type SwaggridCast = {
    /** Name des Kennels (Titel-Rueckfall, operationId) */
    rift: string;
    /** Öffentlicher Pfad des Endpunkts, z. B. `/k/wetter` — landet als Schlüssel in `paths` */
    publicPath: string;
    title?: string;
    scroll?: string;
    /** Lead-Knoten: Instanz-ID oder Lineage-ID (wie in `dogIds[0]`); Abgleich inkl. `base:`-Prefix und Versions-Suffix */
    heraldId: string;
    whispers?: Record<string, string>;
    offering?: unknown;
    strata: Rune[][];
};

/** OpenAPI-3.x-Dokument (JSON-serialisierbar). */
export type OpenApiGrimoire = {
    openapi: string;
    info: { title: string; description: string; version: string };
    servers: Array<{ url: string; description: string }>;
    paths: Record<string, unknown>;
    components: { schemas: Record<string, unknown> };
};
