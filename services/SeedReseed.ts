// SeedReseed — Landing und Kennel-Liste beim Start auf den Repo-Stand setzen (Spur K), ohne Handarbeit.
//
// Die beiden Seed-Kennels entstehen nur, wenn sie fehlen; eine bestehende DB bekaeme Repo-Aenderungen sonst erst nach
// Loeschen durch einen Maintainer und Neustart. Der Reseed geht genau diesen Weg in einem Start: SeededKennelDelete
// (dieselbe Instanz wie DELETE /api/kennels/:id — unbenutzte Dogs fallen, anderswo genutzte bleiben mit Merker), danach
// der normale Seed (der Merker-Lineages wiederverwendet).
//
// Ausloeser: `--reseed` auf der Kommandozeile (npm run start:local:reseed, dev:reseed) setzt immer zurueck. Deployed
// die Env SLOPDOGS_RESEED=<marke>: die zuletzt angewandte Marke steht dauerhaft im Kennel-Store (Typ SeedReseedMark),
// zurueckgesetzt wird nur bei einer neuen Marke — ein stehengelassenes Env loescht so nicht bei jedem Neustart die
// Live-Aenderungen.
import type { IStore } from '../store/IStore';
import type { SeededKennelDeleteReport } from './SeededKennelDelete';

/** Was den Reseed ausloest: das Flag (immer) oder eine Marke aus der Env (einmal je Marke). */
export type ReseedTrigger = { kind: 'flag' } | { kind: 'marker'; marker: string };

/** Ein Seed-Kennel, den der Reseed zuruecksetzt. */
export interface ReseedTarget {
    kennelId: string;
    /** Kurzname im Log (`landing`, `kennels`). */
    label: string;
    seed(): Promise<'seeded' | 'kept' | 'missing-source'>;
}

export interface SeedReseedDeps {
    targets: readonly ReseedTarget[];
    /** SeededKennelDelete.delete — null, wenn es den Kennel nicht gibt. */
    deleteSeeded(kennelId: string): Promise<SeededKennelDeleteReport | null>;
    marks: SeedReseedMarks;
    /** Nach dem Seed: Memos der Seiten verwerfen, Sperre neu rechnen. */
    afterReseed?(): void;
    log?(line: string): void;
}

export interface ReseedTargetResult {
    kennelId: string;
    label: string;
    /** null = der Kennel fehlte, es gab nichts zu loeschen. */
    deleted: number | null;
    kept: number;
    seed: 'seeded' | 'kept' | 'missing-source';
}

export type ReseedOutcome =
    { status: 'none' } | { status: 'skipped'; marker: string } | { status: 'reseeded'; marker: string; targets: ReseedTargetResult[] };

/** Die zuletzt angewandte Marke — eine Zeile im Kennel-Store, wie die Merker von SeedKeptDogs. */
export class SeedReseedMarks {
    static readonly TYPE = 'SeedReseedMark';
    static readonly ROW_ID = 'seed-reseed:last';

    /** `rowId` nur fuer Tests (eine eigene Zeile neben der echten). */
    constructor(
        private readonly store: IStore,
        private readonly rowId: string = SeedReseedMarks.ROW_ID,
    ) {}

    async last(): Promise<string | null> {
        // Ueber den Typ statt load(): load() liefert bei Zeilen ohne Kennel-Spalten nur den Konfig-Text.
        const row = (await this.store.findByType(SeedReseedMarks.TYPE)).find((r) => r.id === this.rowId);
        if (!row) return null;
        try {
            const entry = JSON.parse(row.serializedDogConfig) as { marker?: unknown };
            return typeof entry.marker === 'string' ? entry.marker : null;
        } catch {
            return null; // unlesbar = keine Marke, der naechste Reseed schreibt sie neu
        }
    }

    async remember(marker: string): Promise<void> {
        await this.store.save({
            id: this.rowId,
            type: SeedReseedMarks.TYPE,
            lineageId: this.rowId,
            serializedDogConfig: JSON.stringify({ marker, appliedAt: new Date().toISOString() }),
            createdAt: new Date(),
        });
    }

    /** Nur fuer Tests. */
    async forget(): Promise<void> {
        if (await this.store.load(this.rowId)) await this.store.delete(this.rowId);
    }
}

export class SeedReseed {
    static readonly FLAG = '--reseed';
    static readonly ENV = 'SLOPDOGS_RESEED';
    /** Eine Marke bleibt kurz und einzeilig — sie steht im Log. */
    static readonly MAX_MARKER = 100;

    constructor(private readonly deps: SeedReseedDeps) {}

    /** Flag vor Marke; ohne beides kein Reseed. */
    static triggerOf(argv: readonly string[], env: NodeJS.ProcessEnv): ReseedTrigger | null {
        if (argv.includes(SeedReseed.FLAG)) return { kind: 'flag' };
        const marker = (env.SLOPDOGS_RESEED ?? '').replace(/\s+/g, ' ').trim().slice(0, SeedReseed.MAX_MARKER);
        return marker ? { kind: 'marker', marker } : null;
    }

    async run(trigger: ReseedTrigger | null): Promise<ReseedOutcome> {
        if (!trigger) return { status: 'none' };
        const marker = trigger.kind === 'flag' ? SeedReseed.FLAG : trigger.marker;
        if (trigger.kind === 'marker' && (await this.deps.marks.last()) === trigger.marker) {
            this.log(`[seed] reseed ${marker} schon angewandt -- uebersprungen`);
            return { status: 'skipped', marker };
        }
        const targets: ReseedTargetResult[] = [];
        for (const target of this.deps.targets) {
            const report = await this.deps.deleteSeeded(target.kennelId);
            const seed = await target.seed();
            targets.push({
                kennelId: target.kennelId,
                label: target.label,
                deleted: report ? report.dogsDeleted.length : null,
                kept: report ? report.dogsKept.length : 0,
                seed,
            });
        }
        this.deps.afterReseed?.();
        if (trigger.kind === 'marker') await this.deps.marks.remember(trigger.marker);
        this.log(`[seed] reseed ${marker}: ${targets.map((t) => SeedReseed.describe(t)).join('; ')}`);
        return { status: 'reseeded', marker, targets };
    }

    private static describe(t: ReseedTargetResult): string {
        const removed = t.deleted === null ? 'fehlte' : `${t.deleted} Dogs geloescht, ${t.kept} behalten`;
        return `${t.label} ${removed}${t.seed === 'seeded' ? '' : ` (Seed: ${t.seed})`}`;
    }

    private log(line: string): void {
        (this.deps.log ?? console.log)(line);
    }
}
