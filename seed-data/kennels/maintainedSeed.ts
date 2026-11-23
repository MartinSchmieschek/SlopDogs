import { createHash, randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog } from '@martinschmieschek/slopdogs-core/runtime';
import { SeedKeptDogs } from './seedKeptDogs';

/** Ein Dog eines gepflegten Seed-Kennels (Landing, Kennel-Liste), so wie das Repo ihn beschreibt. */
export interface MaintainedSeedDog {
    displayName: string;
    theRun: string;
    parentsRequired: string[];
    icon: string;
    description: string;
}

/** Liest eine Quelldatei des Kennels — im Betrieb aus dem Repo, im Test auch aus dem Speicher. */
export interface MaintainedSeedSource {
    read(fileName: string): string;
}

/** Die Kopfzeile einer Lineage (findAllVersions), soweit der Vergleich sie braucht. */
interface SeedDogHead {
    id?: unknown;
    createdAt?: unknown;
    serializedDogConfig?: unknown;
    visibility?: unknown;
    ownerId?: unknown;
    editors?: unknown;
    viewers?: unknown;
    runners?: unknown;
}

/** Was der Seed mit einem Dog getan hat. */
export type MaintainedSeedDogOutcome = 'created' | 'versioned' | 'reused';

/**
 * Die Dogs der gepflegten Seed-Kennels (Spur K): Landing und Kennel-Liste werden nur geseedet, wenn der Kennel fehlt.
 * Ihre Dogs tragen feste Lineages aus (kennelId, displayName) — so entsteht ein geloeschter Kennel beim naechsten
 * Boot mit denselben Dog-Lineages neu, und fremde Kennels, die einen dieser oeffentlichen Dogs nutzen, bleiben heil.
 *
 * Steht die Lineage schon (der Dog blieb beim Loeschen stehen), wird sie nicht ersetzt: weicht der Kopf vom Repo ab,
 * folgt genau eine neue Kopfversion (parentId = alter Kopf, wie Controller.save), sonst bleibt der Kopf, wie er ist.
 * Hat ein Dog einen Merker (SeedKeptDogs: beim Loeschen behalten, weil andere ihn nutzen), nimmt der Seed dessen
 * Lineage statt der festen — auch eine alte Zufalls-Lineage —, damit kein zweiter Dog daneben entsteht; settle()
 * entfernt die benutzten Merker, sobald der Kennel steht.
 */
export class MaintainedSeedDogs {
    private readonly usedMarkers: string[] = [];

    constructor(
        private readonly store: IStore,
        private readonly kennelId: string,
        private readonly kept: SeedKeptDogs | null = null,
    ) {}

    /** Nach dem Speichern des Kennels: die benutzten Merker fallen. */
    async settle(): Promise<void> {
        for (const displayName of this.usedMarkers.splice(0)) await this.kept?.forget(this.kennelId, displayName);
    }

    /** Die Lineage fuer den Dog: die gemerkte, solange sie noch Versionen hat, sonst die feste. */
    private async lineageFor(displayName: string): Promise<string> {
        const marked = await this.kept?.lineageFor(this.kennelId, displayName);
        if (marked) {
            this.usedMarkers.push(displayName);
            if ((await this.store.findAllVersions(SerializedDog.name, marked)).length > 0) return marked;
        }
        return MaintainedSeedDogs.lineageId(this.kennelId, displayName);
    }

    /** Die feste Lineage eines Seed-Dogs: SHA-1 ueber (kennelId, displayName) in UUID-v5-Form. */
    static lineageId(kennelId: string, displayName: string): string {
        const bytes = createHash('sha1').update(`slopdogs-seed\u0000${kennelId}\u0000${displayName}`).digest().subarray(0, 16);
        bytes[6] = (bytes[6] & 0x0f) | 0x50;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    /** Legt den Dog an, versioniert ihn oder nimmt den Kopf, wie er ist; liefert die Lineage. */
    async put(dog: MaintainedSeedDog): Promise<{ lineageId: string; outcome: MaintainedSeedDogOutcome }> {
        const lineageId = await this.lineageFor(dog.displayName);
        const head = (await this.store.findAllVersions(SerializedDog.name, lineageId))[0] as SeedDogHead | undefined;
        if (head && MaintainedSeedDogs.matches(head, dog)) return { lineageId, outcome: 'reused' };

        const versionId = randomUUID();
        const parentId = head ? String(head.id) : null;
        // Der neue Kopf muss nach dem alten liegen: der Kopf einer Lineage ist ihre neueste Zeile (createdAt).
        const headTime = head?.createdAt ? new Date(head.createdAt as string | Date).getTime() : 0;
        await this.store.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId,
            displayName: dog.displayName,
            serializedDogConfig: JSON.stringify({
                id: versionId,
                lineageId,
                parentId,
                displayName: dog.displayName,
                description: dog.description,
                icon: dog.icon,
                parentsRequired: dog.parentsRequired,
                parentsOptional: [],
                theRun: dog.theRun,
            }),
            visibility: 'public',
            ...(head ? { ownerId: null, editors: null, viewers: null, runners: null } : {}),
            createdAt: new Date(Math.max(Date.now(), headTime + 1)),
        });
        return { lineageId, outcome: head ? 'versioned' : 'created' };
    }

    /** Gleicht der Kopf dem Repo-Stand — Code, Eltern, Anzeige, Sichtbarkeit, ohne Besitzer und Listen? */
    private static matches(head: SeedDogHead, dog: MaintainedSeedDog): boolean {
        let cfg: Record<string, unknown> | null = null;
        try {
            cfg =
                typeof head.serializedDogConfig === 'string'
                    ? JSON.parse(head.serializedDogConfig)
                    : (head.serializedDogConfig as Record<string, unknown>);
        } catch {
            return false;
        }
        if (!cfg || cfg.imitates) return false;
        const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
        return (
            cfg.theRun === dog.theRun &&
            same(cfg.parentsRequired ?? [], dog.parentsRequired) &&
            same(cfg.parentsOptional ?? [], []) &&
            cfg.displayName === dog.displayName &&
            cfg.description === dog.description &&
            cfg.icon === dog.icon &&
            (head.visibility ?? 'public') === 'public' &&
            !head.ownerId &&
            !head.editors &&
            !head.viewers &&
            !head.runners
        );
    }
}
