// Die Ergebnis-TTL eines Kennels (PLAN-KENNEL-CACHE 3, E5, E6): `0` (aus), Sekunden oder `"unendlich"`.
// In der DB zwei Spalten — Sekunden und ein Schalter fuer unendlich —, kein Sentinel-Wert. Nach aussen (MCP, REST,
// Bundle, UI) genau ein Feld `resultCacheTtl`.
import { positiveIntFromEnv } from '../../server-app/runAdmission';
import type { CacheClass, CacheClassification } from './CacheClass';

export const RESULT_CACHE_INFINITE = 'unendlich';
export type ResultCacheTtlValue = number | typeof RESULT_CACHE_INFINITE;

/** Die Spalten am Kennel (Dog-Tabelle). */
export interface ResultCacheTtlColumns {
    resultCacheTtlSec: number;
    resultCacheInfinite: boolean;
}

export type ResultCacheTtlParse = { ok: true; ttl: ResultCacheTtl } | { ok: false; error: string };

export class ResultCacheTtl {
    static readonly DEFAULT_MAX_TTL_SEC = 7 * 24 * 60 * 60;
    static readonly OFF = new ResultCacheTtl(0, false);
    static readonly INFINITE = new ResultCacheTtl(0, true);

    private constructor(
        readonly seconds: number,
        readonly infinite: boolean,
    ) {}

    /** Die Obergrenze fuer N Sekunden (E5); unendlich ist davon ausgenommen. */
    static maxSeconds(): number {
        return positiveIntFromEnv('KENNEL_RESULT_CACHE_MAX_TTL_SEC', ResultCacheTtl.DEFAULT_MAX_TTL_SEC);
    }

    /** Aus den DB-Spalten; Unsinn (negativ, kein Integer) ist aus. */
    static fromColumns(seconds: unknown, infinite: unknown): ResultCacheTtl {
        // SQLite liefert Booleans aus $queryRaw als 0/1, Ints je nach Weg als number oder bigint.
        if (infinite === true || Number(infinite) === 1) return ResultCacheTtl.INFINITE;
        const n = Number(seconds);
        return Number.isInteger(n) && n > 0 ? new ResultCacheTtl(n, false) : ResultCacheTtl.OFF;
    }

    /** Aus einem schon gespeicherten oder geparsten Wert (Konfig): nachsichtig, Unsinn ist aus. */
    static fromValue(value: unknown): ResultCacheTtl {
        if (value === RESULT_CACHE_INFINITE) return ResultCacheTtl.INFINITE;
        return typeof value === 'number' ? ResultCacheTtl.fromColumns(value, false) : ResultCacheTtl.OFF;
    }

    /** Die gespeicherte TTL eines Kennels (geparste Konfig mit `resultCacheTtl`), ohne Feld: aus. */
    static ofKennel(kennel: unknown): ResultCacheTtl {
        return ResultCacheTtl.fromValue((kennel as { resultCacheTtl?: unknown } | null | undefined)?.resultCacheTtl);
    }

    /** Eine Eingabe (MCP, REST, Import): streng, mit lesbarem Grund. `null` gilt als 0. */
    static parse(value: unknown): ResultCacheTtlParse {
        if (value === null || value === undefined || value === 0) return { ok: true, ttl: ResultCacheTtl.OFF };
        if (value === RESULT_CACHE_INFINITE) return { ok: true, ttl: ResultCacheTtl.INFINITE };
        const max = ResultCacheTtl.maxSeconds();
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            return {
                ok: false,
                error: `resultCacheTtl must be 0 (off), a whole number of seconds (1..${max}) or "${RESULT_CACHE_INFINITE}"`,
            };
        }
        if (value > max) {
            return {
                ok: false,
                error: `resultCacheTtl ${value} exceeds the maximum of ${max} seconds (use "${RESULT_CACHE_INFINITE}" only for pure kennels)`,
            };
        }
        return { ok: true, ttl: new ResultCacheTtl(value, false) };
    }

    /** Welche TTL eine Klasse zulaesst (2.1): rein 0/N/unendlich, fluechtig und persoenlich 0/N, live nur 0. */
    static allowedFor(klasse: CacheClass): string[] {
        const seconds = `1..${ResultCacheTtl.maxSeconds()} seconds`;
        if (klasse === 'live') return ['0'];
        if (klasse === 'rein') return ['0', seconds, RESULT_CACHE_INFINITE];
        return ['0', seconds];
    }

    get value(): ResultCacheTtlValue {
        return this.infinite ? RESULT_CACHE_INFINITE : this.seconds;
    }

    get enabled(): boolean {
        return this.infinite || this.seconds > 0;
    }

    get columns(): ResultCacheTtlColumns {
        return { resultCacheTtlSec: this.infinite ? 0 : this.seconds, resultCacheInfinite: this.infinite };
    }

    equals(other: ResultCacheTtl): boolean {
        return this.infinite === other.infinite && (this.infinite || this.seconds === other.seconds);
    }

    allowedBy(klasse: CacheClass): boolean {
        if (!this.enabled) return true;
        if (klasse === 'live') return false;
        return !this.infinite || klasse === 'rein';
    }

    /** Die Ablehnung gegen eine Klasse, mit den Gruenden — oder null, wenn die TTL passt. */
    refusalFor(classification: CacheClassification): string | null {
        if (this.allowedBy(classification.klasse)) return null;
        const reasons = classification.gruende.slice(0, 3).join('; ');
        return (
            `resultCacheTtl ${JSON.stringify(this.value)} not allowed: this kennel is "${classification.klasse}"` +
            `${reasons ? ` (${reasons})` : ''}; allowed: ${ResultCacheTtl.allowedFor(classification.klasse).join(' | ')}`
        );
    }
}
