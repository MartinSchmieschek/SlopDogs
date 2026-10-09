import { randomUUID } from 'crypto';
import { IStore } from '../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { TalkingDog } from '@slopdogs/dogs-talking';
import { RandomRecipesRetriever, CountryFlagBlackLab, DishFlagBlackLab, RandomEveryThingRetriever } from '@slopdogs/dogs-demo';
import { saveKennelSeed } from './seed-helpers';

export async function seedSerializedDog(nodesStore: IStore): Promise<string | null> {
    // Eine Zeile genuegt — frueher zog dieser Check die ganze SerializedDog-Tabelle ueber ALLE Versionen
    // samt tsCode durch den Boot, um danach nur die erste zu lesen.
    const firstSeed = await nodesStore.findFirstOfType(SerializedDog.name);
    if (!firstSeed) {
        // Forge the spirit's identity — a GUID for the incarnation, a GUID for the lineage.
        const versionId = randomUUID();
        const lineageId = randomUUID();

        // The first mimic — it imitates LayoutInputProvider and hunts recipes from the eldritch RandomDogs.
        // Corporeal laws are unwritten as suns and love retreat: it borrows another's form to live.
        const seedCfg: IMimicDogConfig = {
            id: versionId,
            lineageId,
            parentId: null,
            displayName: 'Seed Serialized 1',
            imitates: 'LayoutInputProvider',
            parentsRequired: ['RandomRecipesRetriever', 'RandomEveryThingRetriever'],
            parentsOptional: [],
            theRun: `
return {
    type: "tinder",
    imageUrl: RandomEveryThingRetriever.woof.url,
    title: RandomRecipesRetriever.name,
    description: RandomRecipesRetriever.instructions.join(" and ")
}
`,
        };

        await nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId: null,
            displayName: 'Seed Serialized 1',
            serializedDogConfig: JSON.stringify(seedCfg),
            createdAt: new Date(),
        });
        console.log(`✅ Seeded initial SerializedDog into DB (lineageId: ${lineageId})`);
        return lineageId;
    }

    // If a hound already lurks, extract its lineageId for the kennel manifest.
    try {
        const config = typeof firstSeed.serializedDogConfig === 'string'
            ? JSON.parse(firstSeed.serializedDogConfig)
            : firstSeed.serializedDogConfig;
        return config.lineageId || firstSeed.lineageId || null;
    } catch {
        return null;
    }
}

/**
 * Raises the first kennel from the abyss — a gathering place for all base hounds.
 * To cosmic madness laws submit, though stalwart minds entreat; every dog finds its kennel.
 * If a kennel already prowls the store, we disturb it not — the void remembers what has been.
 */
export async function seedKennelConfig(kennelsStore: IStore, seedLineageId: string | null): Promise<void> {
    // The full roster of base hounds — born of the code, not the store.
    // Each is summoned fresh upon every run, like stars that fell and rose again.
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever
    ];

    // Rouse each hound just long enough to read its name for the kennel manifest.
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    // Nur "gibt es schon einen?" — eine Zeile, nicht alle Kennel-Versionen.
    if (!(await kennelsStore.findFirstOfType('KennelConfig'))) {
        // The kennel references the lineageId (lineage GUID), not a specific version —
        // so it always summons the latest incarnation from the branching tree.
        const dogIds = [
            ...(seedLineageId ? [seedLineageId] : []),
            ...allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name)
        ];

        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Bind the dogIds to the abyss as a JSON string — the store speaks only in primitive tongues.
        await saveKennelSeed(kennelsStore, defaultKennelConfig.id, {
            name: defaultKennelConfig.name,
            description: defaultKennelConfig.description,
            dogIds: defaultKennelConfig.dogIds,
            defaultQuery: defaultKennelConfig.defaultQuery,
            defaultBody: defaultKennelConfig.defaultBody,
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
    }
}
