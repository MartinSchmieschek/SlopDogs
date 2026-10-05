/**
 * ~~~ LEAD OUTCOME — was der Lead eines Laufs wirklich getan hat ~~~
 *
 * Die Waves allein koennen das nicht sagen: ein Lead, der `null` zurueckgibt, faellt aus der Welle
 * (der Harvester nimmt nur `collected != undefined || __error`), genauso wie ein Lead, der nie lief.
 * Und ein Lead mit Fehler steht MIT `result === undefined` darin — frueher wurde daraus HTTP 200 mit
 * leerem Rumpf. Deshalb entscheidet runKennel den Ausgang einmal aus der Season und haengt ihn an die
 * Waves (WeakMap, kein Feld im JSON). Jeder Weg nach aussen (/k/, /execute, openapi.json, MCP) liest
 * denselben Ausgang:
 *
 *   ok       — Lead lief ohne Fehler und lieferte einen Wert.
 *   empty    — Lead lief ohne Fehler und lieferte null/undefined: eine gueltige Antwort "nichts".
 *   failed   — Lead traegt einen Fehler (auch einen leeren Text). `memoryPressure`: der Speicher-Waechter
 *              hat ihn abgewiesen — ein voruebergehender Zustand des Servers, kein Fehler des Kennels.
 *   not_run  — Lead lief nie (nicht bereit, weil Eltern fehlten, oder nicht erlaubt in diesem Kennel).
 */

import { DOG_MEMPRESSURE_MARKER, SerializedDog, type IHuntingSeason } from '@slopdogs/core';
import type { NodeEntry, Waves } from './WavesConverter';

export type LeadStatus = 'ok' | 'empty' | 'failed' | 'not_run';

export class LeadOutcome {
    private static readonly attached = new WeakMap<object, LeadOutcome>();

    private constructor(
        readonly status: LeadStatus,
        readonly result: unknown,
        /** Fehlertext (nur `failed`) — kann Dog-Namen und Code-Stellen tragen: nur an READ-Leser. */
        readonly error: string | undefined,
        /** Der Knoten in den Waves, wenn es einen gibt. */
        readonly node: NodeEntry | null,
    ) {}

    /** Der Speicher-Waechter hat den Lead abgewiesen (DOG_MEMPRESSURE_MARKER). */
    get memoryPressure(): boolean {
        return this.status === 'failed' && typeof this.error === 'string' && this.error.includes(DOG_MEMPRESSURE_MARKER);
    }

    get failed(): boolean {
        return this.status === 'failed' || this.status === 'not_run';
    }

    /** Aus der Season eines Laufs — die genaue Quelle. */
    static fromRun(waves: Waves, season: IHuntingSeason, leadRef: string | undefined): LeadOutcome {
        if (!leadRef) return new LeadOutcome('not_run', undefined, undefined, null);
        const node = LeadOutcome.findNode(waves, leadRef);
        const dog: any = season.exhausted.find((d) => LeadOutcome.matchesDog(d, leadRef));
        if (dog && (dog as any).__error !== undefined) {
            // Nur der Text aus den Waves: der ist schon von Schluessel-Werten bereinigt (KeyRunState).
            const text = node?.error ? String(node.error) : '';
            return new LeadOutcome('failed', undefined, text || 'lead failed without a message', node);
        }
        if (node) {
            if (node.error) return new LeadOutcome('failed', undefined, String(node.error), node);
            return node.result === undefined || node.result === null
                ? new LeadOutcome('empty', null, undefined, node)
                : new LeadOutcome('ok', node.result, undefined, node);
        }
        // Nicht in den Waves, aber gelaufen: der Lead gab null/undefined zurueck.
        if (dog) return new LeadOutcome('empty', null, undefined, null);
        return new LeadOutcome('not_run', undefined, undefined, null);
    }

    /** Nur aus den Waves (ohne Season) — fuer Waves, an denen kein Ausgang haengt. */
    static fromWaves(waves: Waves, leadRef: string | undefined): LeadOutcome {
        const node = leadRef ? LeadOutcome.findNode(waves, leadRef) : null;
        if (!node) return new LeadOutcome('not_run', undefined, undefined, null);
        if (node.error) return new LeadOutcome('failed', undefined, String(node.error), node);
        return node.result === undefined || node.result === null
            ? new LeadOutcome('empty', null, undefined, node)
            : new LeadOutcome('ok', node.result, undefined, node);
    }

    static attach(waves: Waves, outcome: LeadOutcome): void {
        LeadOutcome.attached.set(waves, outcome);
    }

    /** Der angehaengte Ausgang, sonst aus den Waves abgeleitet. */
    static of(waves: Waves, leadRef: string | undefined): LeadOutcome {
        return LeadOutcome.attached.get(waves) ?? LeadOutcome.fromWaves(waves, leadRef);
    }

    /** Dieselbe Trefferregel wie findLeadNodeEntry / KennelRunHandler.findDogInWaves. */
    private static findNode(waves: Waves, leadRef: string): NodeEntry | null {
        const searchId = leadRef.startsWith('base:') ? leadRef.substring(5) : leadRef;
        for (const wave of waves) {
            for (const node of wave) {
                if (node.id === searchId || node.id === leadRef
                    || (node.lineageId != null && (node.lineageId === searchId || node.lineageId === leadRef))) {
                    return node;
                }
            }
        }
        return null;
    }

    private static matchesDog(dog: any, leadRef: string): boolean {
        const searchId = leadRef.startsWith('base:') ? leadRef.substring(5) : leadRef;
        if (dog instanceof SerializedDog) {
            return dog.storageId === searchId || dog.storageId === leadRef
                || dog.lineageId === searchId || dog.lineageId === leadRef;
        }
        return dog?.name === searchId || dog?.name === leadRef;
    }
}
