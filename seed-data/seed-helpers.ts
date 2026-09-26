import { randomUUID } from 'crypto';
import { IStore } from '../store/IStore';
import { SerializedDog, type IMimicDogConfig } from '@slopdogs/core';

/**
 * Check if a kennel with this lineageId already exists.
 * Punkt-Lookup ueber (type, lineageId) — kein Scan der ganzen KennelConfig-Partition je Seed-Kennel.
 */
export async function kennelExists(store: IStore, kennelLineageId: string): Promise<boolean> {
    const rows = await store.findByLineage('KennelConfig', kennelLineageId);
    return rows.length > 0;
}

/** Save a versioned kennel seed — lineageId is the stable kennel ID, id is a fresh GUID. */
export async function saveKennelSeed(store: IStore, kennelLineageId: string, data: {
    name?: string; description?: string; emoji?: string;
    dogIds: string[]; defaultQuery?: any; defaultBody?: any;
}): Promise<void> {
    const versionId = randomUUID();
    await store.save({
        id: versionId,
        type: 'KennelConfig',
        lineageId: kennelLineageId,
        parentId: null,
        name: data.name,
        description: data.description,
        emoji: data.emoji,
        dogIds: data.dogIds,
        defaultQuery: data.defaultQuery ? JSON.stringify(data.defaultQuery) : undefined,
        defaultBody: data.defaultBody ? JSON.stringify(data.defaultBody) : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
}

/** Helper: save a MimicDog to the store */
export async function saveMimic(store: IStore, opts: {
    versionId: string; lineageId: string; displayName: string;
    imitates: string; parentsRequired: string[]; theRun: string;
}): Promise<void> {
    const cfg: IMimicDogConfig = {
        id: opts.versionId,
        lineageId: opts.lineageId,
        parentId: null,
        displayName: opts.displayName,
        imitates: opts.imitates,
        parentsRequired: opts.parentsRequired,
        parentsOptional: [],
        theRun: opts.theRun,
    };
    await store.save({
        id: opts.versionId,
        type: SerializedDog.name,
        lineageId: opts.lineageId,
        parentId: null,
        displayName: opts.displayName,
        serializedDogConfig: JSON.stringify(cfg),
        createdAt: new Date(),
    });
}
