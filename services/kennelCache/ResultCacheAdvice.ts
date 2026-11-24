// Was der Besitzer ueber den Ergebnis-Cache seines Kennels wissen soll (PLAN-KENNEL-CACHE D10, Plan 2.3 und 6):
// warum der letzte Lauf nicht abgelegt wurde (Herabstufung) und ein Hinweis aus der Statistik — oft gerufen und
// cachebar, aber ohne TTL; oder wie viele Aufrufe der Cache schon beantwortet hat. Nur fuer den Besitzer: die
// Aufrufzahlen und der Grund einer Herabstufung gehoeren niemandem sonst.
import type { CacheClassView } from './KennelCacheClassifier';
import type { ResultCacheTtl } from './ResultCacheTtl';

export interface ResultCacheOwnerNotes {
    /** Der letzte Lauf dieser Fassung wurde nicht abgelegt, weil … (Laufzeit-Benutzung passte nicht zur Klasse). */
    herabgestuft?: string;
    hinweis?: string;
}

export interface ResultCacheAdviceInput {
    ttl: ResultCacheTtl;
    view: CacheClassView;
    last30d: number;
    cached30d: number;
    downgrade: string | null;
}

export class ResultCacheAdvice {
    /** Ab so vielen Aufrufen in 30 Tagen lohnt der Hinweis, eine TTL zu setzen. */
    static readonly MIN_CALLS_30D = 100;

    static notes(input: ResultCacheAdviceInput): ResultCacheOwnerNotes {
        const out: ResultCacheOwnerNotes = {};
        if (input.downgrade) out.herabgestuft = input.downgrade;
        const hinweis = ResultCacheAdvice.hint(input);
        if (hinweis) out.hinweis = hinweis;
        return out;
    }

    private static hint(input: ResultCacheAdviceInput): string | null {
        const { ttl, view, last30d, cached30d } = input;
        if (!ttl.enabled) {
            if (view.klasse === 'live' || last30d < ResultCacheAdvice.MIN_CALLS_30D) return null;
            return (
                `Called ${last30d} times in the last 30 days and cacheable ("${view.klasse}"): set resultCacheTtl ` +
                `(allowed: ${view.erlaubt.join(' | ')}) to answer repeated calls without a run.`
            );
        }
        if (view.ruht) return null;
        return `${cached30d} of ${last30d} calls in the last 30 days came from the result cache.`;
    }
}
