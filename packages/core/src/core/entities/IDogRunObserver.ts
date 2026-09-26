/**
 * ~~~ THE WATCHER AT THE KENNEL GATE ~~~
 *
 * Arr, every hound that runs passes this gate once -- and the watcher counts it.
 * The core knows nothing of kennels, sources or ledgers; it only reports what it saw:
 * which hound, how it ended, how long it took, how often its memory answered.
 * The app decides what to do with the tally (P4b: counting in services/, persistence in store/).
 *
 * Kein Pakt, kein Schema, kein Store: ein Interface, eine reine Klassifikation, zwei Marker.
 */

import { IHuntingDog } from './IHuntingDog';

/** Wie ein Lauf endete. `cached` ist keine Core-Klasse — die App leitet sie aus den Cache-Zahlen ab. */
export type DogRunOutcome = 'ok' | 'error' | 'timeout' | 'oom';

export interface DogRunReport {
    dog: IHuntingDog<unknown>;
    outcome: DogRunOutcome;
    /** Um collectYield gemessen, inklusive Worker-Start. */
    durationMs: number;
    /** getOrFetch-Aufrufe, die OHNE factory zurueckkamen (Treffer, In-flight-Dedup, NEG-HIT). */
    cacheHits: number;
    /** getOrFetch-Aufrufe, die factory gerufen haben. */
    cacheMisses: number;
    waveIndex: number;
    errorMessage?: string;
}

/** Synchron, darf nie werfen — tut er es doch, faengt letOut() es ab (die Welle laeuft weiter). */
export interface IDogRunObserver {
    onDogRun(report: DogRunReport): void;
}

/** Steht in der Meldung, wenn der Worker eines SerializedDog sein Zeitbudget ueberschritten hat. */
export const DOG_TIMEOUT_MARKER = 'VM execution timed out after';

/** Steht in der Meldung, wenn der Worker eines SerializedDog sein Heap-Limit gesprengt hat. */
export const DOG_OOM_MARKER = 'sandbox worker exceeded its heap limit';

/** Ordnet eine Fehlermeldung ein — nur ueber die Marker, nie ueber Prosa. */
export function classifyDogError(msg: string): DogRunOutcome {
    const text = typeof msg === 'string' ? msg : String(msg);
    if (text.includes(DOG_TIMEOUT_MARKER)) return 'timeout';
    if (text.includes(DOG_OOM_MARKER)) return 'oom';
    return 'error';
}
