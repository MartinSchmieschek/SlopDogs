// Die eine Schnittstelle fuer jeden Cache-Speicher (PLAN-CACHE-KONFIG, 10-0 24.11.): die App-Config beschreibt
// den Speicher (config/default.config.ts: RAM vor DB), wer etwas anderes anbinden will, schreibt einen eigenen
// ICacheStore und verweist mit SLOPDOGS_CONFIG auf seine Config. Nur Ablage, keine Logik: getOrFetch,
// Buendelung laufender Abrufe und Negativ-Cache liegen im StoreCacheHandler, Kappen und Gleiten im
// KennelResultCache — darueber, fuer jeden Speicher gleich.

/** Ein abgelegter Eintrag. Der Speicher parst nie: `value` bleibt Text. */
export interface CacheRecord {
    /** Immer Text (JSON). */
    value: string;
    /** Ablauf in ms seit Epoche; danach liefert `get` null. */
    expiresAt: number;
    /** Gruppe zum Loeschen, Zaehlen und Kappen (Ergebnis-Cache: die Kennel-Lineage). */
    group?: string | null;
    /** Kleine Zusatzfelder des Aufrufers (Ergebnis-Cache: scope, leadStatus, contentKind, …). */
    meta?: Record<string, string | number | boolean> | null;
    /** Groesse von `value` in Bytes (UTF-8). */
    sizeBytes: number;
    /** Letzter Treffer in ms; bestimmt, was `trimGroup` zuerst entfernt. */
    lastHitAt: number;
}

export interface ICacheStore {
    /** Fuer Logs und /health — z. B. "ram+db". */
    readonly name: string;
    /** Der Eintrag oder null (fehlt oder abgelaufen). */
    get(key: string): Promise<CacheRecord | null>;
    /** Anlegen oder ersetzen. */
    set(key: string, record: CacheRecord): Promise<void>;
    /** Ein Treffer: lastHitAt setzen, optional den Ablauf verschieben. Fehlt der Eintrag, passiert nichts. */
    touch(key: string, lastHitAt: number, expiresAt?: number): Promise<void>;
    delete(key: string): Promise<void>;
    /** Alle Eintraege, deren Schluessel mit `prefix` beginnt; liefert die Anzahl. */
    deleteByPrefix(prefix: string): Promise<number>;
    /** Alle Eintraege einer Gruppe; liefert die Anzahl. */
    deleteGroup(group: string): Promise<number>;
    countGroup(group: string): Promise<number>;
    /** Hoechstens `max` Eintraege in der Gruppe lassen; die am laengsten nicht getroffenen gehen. Liefert die Anzahl. */
    trimGroup(group: string, max: number): Promise<number>;
    /** Abgelaufene Eintraege (expiresAt <= now) entfernen; liefert die Anzahl. */
    prune(now: number): Promise<number>;
    /** Eigene Verbindungen und Timer freigeben. Idempotent. */
    close(): Promise<void>;
}

/** Groesse eines Textes in Bytes (UTF-8) — die Einheit von `sizeBytes` und der Speicherdeckel. */
export function utf8Bytes(text: string): number {
    return Buffer.byteLength(text, 'utf8');
}
