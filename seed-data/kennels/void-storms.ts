import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
import { VoidHuntDataCode } from '../VoidHuntData';
import { VoidHuntGalleryCode } from '../VoidHuntGallery';
export async function seedVoidStormsKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'void-storms';
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    // Wave 2: VoidHuntData
    const dataVersionId = randomUUID();
    const dataDogId = randomUUID();
    const dataCfg = {
        id: dataVersionId, lineageId: dataDogId, parentId: null,
        displayName: 'Voidhuntdata',
        parentsRequired: ['WarframeAlertsRetriever'],
        parentsOptional: [],
        theRun: VoidHuntDataCode,
    };
    await nodesStore.save({ id: dataVersionId, type: SerializedDog.name, lineageId: dataDogId, parentId: null, displayName: 'Voidhuntdata', serializedDogConfig: JSON.stringify(dataCfg), createdAt: new Date() });

    // Wave 3: VoidHuntGallery (lead — renders HTML)
    const galleryVersionId = randomUUID();
    const galleryDogId = randomUUID();
    const galleryCfg = {
        id: galleryVersionId, lineageId: galleryDogId, parentId: null,
        displayName: 'VoidHuntGallery',
        parentsRequired: [dataDogId],
        parentsOptional: [],
        theRun: VoidHuntGalleryCode,
    };
    await nodesStore.save({ id: galleryVersionId, type: SerializedDog.name, lineageId: galleryDogId, parentId: null, displayName: 'VoidHuntGallery', serializedDogConfig: JSON.stringify(galleryCfg), createdAt: new Date() });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Void Hunt',
        description: 'Warframe Void Fissures, Storms, Invasions — live Dashboard aus dem Void',
        emoji: '\uD83C\uDF00',
        dogIds: [
            galleryDogId,
            dataDogId,
            BASE_DOG_PREFIX + 'WarframeAlertsRetriever',
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: undefined,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded Void Storms Kennel (kennelId: ${kennelId})`);
}
