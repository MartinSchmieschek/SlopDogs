import { IStore } from '../../store/IStore';

/** Ein behaltener Dog eines geloeschten Seed-Kennels: welcher Kennel, welcher Dog, auf welcher Lineage. */
export interface SeedKeptDog {
    kennelId: string;
    displayName: string;
    lineageId: string;
}

/**
 * Merker fuer Dogs, die beim Loeschen eines Seed-Kennels stehen blieben, weil andere sie nutzen (SeededKennelDelete).
 * Sie halten zweierlei bis zum Reseed fest: die Sperre (LandingDogLock nimmt die Lineages in seine Startmenge, auch
 * fuer Bestaende mit alten Zufalls-Lineages) und die Lineage, auf die der Seed den Dog wieder setzt (MaintainedSeedDogs)
 * — so entsteht kein zweiter Dog neben dem fremd genutzten. Eine Zeile je (kennelId, displayName) im Kennel-Store,
 * Typ `SeedKeptDog`; die eigene lineageId-Spalte kollidiert mit keiner Dog- oder Kennel-Lineage.
 */
export class SeedKeptDogs {
    static readonly TYPE = 'SeedKeptDog';

    constructor(private readonly store: IStore) {}

    private static rowId(kennelId: string, displayName: string): string {
        return `seed-kept:${kennelId.toLowerCase()}:${displayName}`;
    }

    /** Merkt die behaltenen Dogs; ein vorhandener Merker fuer denselben Namen wird ueberschrieben. */
    async remember(kennelId: string, dogs: Array<{ lineageId: string; displayName: string }>): Promise<void> {
        for (const dog of dogs) {
            const id = SeedKeptDogs.rowId(kennelId, dog.displayName);
            const entry: SeedKeptDog = { kennelId, displayName: dog.displayName, lineageId: dog.lineageId };
            await this.store.save({
                id,
                type: SeedKeptDogs.TYPE,
                lineageId: id,
                serializedDogConfig: JSON.stringify(entry),
                createdAt: new Date(),
            });
        }
    }

    /** Alle Merker, wahlweise nur die eines Kennels. */
    async list(kennelId?: string): Promise<SeedKeptDog[]> {
        const out: SeedKeptDog[] = [];
        for (const row of await this.store.findByType(SeedKeptDogs.TYPE)) {
            try {
                const entry = JSON.parse(row.serializedDogConfig) as SeedKeptDog;
                if (!kennelId || entry.kennelId.toLowerCase() === kennelId.toLowerCase()) out.push(entry);
            } catch {
                /* ein unlesbarer Merker sperrt nichts */
            }
        }
        return out;
    }

    /** Die gemerkte Lineage fuer diesen Dog des Kennels, oder null. */
    async lineageFor(kennelId: string, displayName: string): Promise<string | null> {
        return (await this.list(kennelId)).find((entry) => entry.displayName === displayName)?.lineageId ?? null;
    }

    /** Merker entfernen (der Reseed hat die Lineage wieder in den dogIds des Kennels). */
    async forget(kennelId: string, displayName: string): Promise<void> {
        const id = SeedKeptDogs.rowId(kennelId, displayName);
        if (await this.store.load(id)) await this.store.delete(id);
    }
}
