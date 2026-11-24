// Was ein Kennel-Lauf ueber sich verraet, damit das Tor des Ergebnis-Caches (D4) nach dem Lauf entscheiden kann:
// lief jeder Dog ohne Fehler, hat der Lauf Mimics gespeichert oder geheilt, welche Version jeder eigene Dog hatte.
// Haengt wie LeadOutcome und KeyRunState per WeakMap an den Waves — nach einer Serialisierung ist er weg, und ohne
// ihn wird nichts abgelegt.

export class KennelRunTrace {
    private static readonly byWaves = new WeakMap<object, KennelRunTrace>();

    private dogFailures = 0;
    private changedMimics = 0;
    /** Je Lineage die Version, die die Factory geladen hat. */
    readonly ranVersions = new Map<string, string>();

    static attach(waves: object, trace: KennelRunTrace): void {
        KennelRunTrace.byWaves.set(waves, trace);
    }

    static of(waves: unknown): KennelRunTrace | null {
        return waves && typeof waves === 'object' ? (KennelRunTrace.byWaves.get(waves) ?? null) : null;
    }

    /** Ein Dog endete nicht mit `ok` (Fehler, Timeout, Speicher). */
    noteDogFailure(): void {
        this.dogFailures++;
    }

    /** Der Lauf hat so viele Mimics neu gespeichert oder in die dogIds geheilt. */
    noteChangedMimics(count: number): void {
        this.changedMimics += Math.max(0, count);
    }

    noteVersion(lineageId: string, versionId: string): void {
        this.ranVersions.set(lineageId, versionId);
    }

    get allDogsOk(): boolean {
        return this.dogFailures === 0;
    }

    get mimicsChanged(): boolean {
        return this.changedMimics > 0;
    }
}
