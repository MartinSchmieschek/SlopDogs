import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog, IKennelConfig, BASE_DOG_PREFIX, type IMimicDogConfig } from '@slopdogs/core';
import { kennelExists, saveKennelSeed, saveMimic } from '../seed-helpers';
export async function seedMdReportKennel(nodesStore: IStore, kennelsStore: IStore): Promise<void> {
    const kennelId = 'md-report-kennel';
    if (await kennelExists(kennelsStore, kennelId)) return;

    const dataVersionId = randomUUID();
    const dataLineageId = randomUUID();

    const dataCfg = {
        id: dataVersionId,
        lineageId: dataLineageId,
        parentId: null,
        displayName: 'MdReportData',
        parentsRequired: [] as string[],
        parentsOptional: [] as string[],
        theRun: `
return {
  title: "From the void",
  generatedAt: new Date().toISOString(),
  sections: [
    { heading: "Message from the void", body: "Rap Tap Tap" }
  ]
};
`,
    };

    await nodesStore.save({
        id: dataVersionId,
        type: SerializedDog.name,
        lineageId: dataLineageId,
        parentId: null,
        displayName: 'MdReportData',
        serializedDogConfig: JSON.stringify(dataCfg),
        createdAt: new Date(),
    });

    const leadVersionId = randomUUID();
    const leadLineageId = randomUUID();

    const leadCfg = {
        id: leadVersionId,
        lineageId: leadLineageId,
        parentId: null,
        displayName: 'MdReportMd',
        parentsRequired: [dataLineageId],
        parentsOptional: [] as string[],
        theRun: `
var d = MdReportData;
var out = "";
out += "# " + d.title + "\\n\\n";
out += "_Stand: " + d.generatedAt + "_\\n\\n";
for (var i = 0; i < d.sections.length; i++) {
  var s = d.sections[i];
  out += "## " + s.heading + "\\n\\n";
  out += s.body + "\\n\\n";
}
return out;
`,
    };

    await nodesStore.save({
        id: leadVersionId,
        type: SerializedDog.name,
        lineageId: leadLineageId,
        parentId: null,
        displayName: 'MdReportMd',
        serializedDogConfig: JSON.stringify(leadCfg),
        createdAt: new Date(),
    });

    const kennelConfig: IKennelConfig = {
        id: kennelId,
        name: 'Markdown Report Pack',
        description: 'Data dog + Markdown lead — void message (Rap Tap Tap)',
        emoji: '\uD83D\uDCC4',
        dogIds: [leadLineageId, dataLineageId],
        defaultQuery: { lat: '50.1109', lng: '8.6821' },
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    await saveKennelSeed(kennelsStore, kennelConfig.id, {
        name: kennelConfig.name,
        description: kennelConfig.description,
        emoji: kennelConfig.emoji,
        dogIds: kennelConfig.dogIds,
        defaultQuery: kennelConfig.defaultQuery,
        defaultBody: undefined,
    });

    console.log(`\u2705 Seeded md-report-kennel (Markdown Report Pack)`);
}
