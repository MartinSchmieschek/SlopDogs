/**
 * Test-Kennels fuer StartupTests: oeffentliche Dogs, die eine feste HTML-Seite liefern, und Kennels darueber. Alles,
 * was hier entsteht, nimmt `cleanup()` wieder mit; ein Fehler beim Aufraeumen aendert kein Testergebnis.
 */
import { SerializedDog, type ISerializedDogConfig } from '@martinschmieschek/slopdogs-core/runtime';
import type { IStore } from '../../store/IStore';
import type { ICreateKennelInput, KennelController } from '../../api/KennelController';
import { generateLineageId, generateVersionId } from '../../api/utils/versioning';

export interface TestKennel {
    lineageId: string;
    /** Die Versions-GUID der angelegten (ersten) Version. */
    versionId: string;
}

export class TestKennels {
    private readonly dogVersions: string[] = [];
    private readonly kennelIds: string[] = [];

    constructor(
        private readonly nodesStore: IStore,
        private readonly kennelsController: KennelController,
    ) {}

    /** Ein oeffentlicher SerializedDog ohne Besitzer, der `html` liefert; gibt die lineageId zurueck. */
    async htmlDog(displayName: string, html: string): Promise<string> {
        const versionId = generateVersionId();
        const lineageId = generateLineageId();
        const config: ISerializedDogConfig = {
            id: versionId,
            lineageId,
            parentId: null,
            displayName,
            theRun: `return ${JSON.stringify(html)};`,
            parentsRequired: [],
            parentsOptional: [],
        };
        await this.nodesStore.save({
            id: versionId,
            type: SerializedDog.name,
            lineageId,
            parentId: null,
            displayName,
            serializedDogConfig: JSON.stringify(config),
            visibility: 'public',
            ownerId: null,
            createdAt: new Date(),
        });
        this.dogVersions.push(versionId);
        return lineageId;
    }

    /** Legt den Kennel ueber den Controller an (ohne die Pruefungen der Anlege-Wege). */
    async kennel(input: ICreateKennelInput & { id: string }): Promise<TestKennel> {
        const created = await this.kennelsController.create(input);
        if (!created.ok || !created.data) throw new Error(`Kennel ${input.id} nicht angelegt: ${created.error}`);
        this.track(input.id);
        return { lineageId: input.id, versionId: created.data.id };
    }

    /** Reste eines abgebrochenen Laufs unter festen Test-IDs gehen vorher weg (der Dev-Server laeuft die Suite gegen dev.db). */
    async removeLeftovers(kennelIds: string[]): Promise<void> {
        for (const kennelId of kennelIds) await this.kennelsController.delete(kennelId).catch(() => undefined);
    }

    /** Ein Kennel, der anderswo angelegt wurde (REST, MCP, Import), wird beim Aufraeumen mitgenommen. */
    track(kennelId: string): void {
        if (!this.kennelIds.includes(kennelId)) this.kennelIds.push(kennelId);
    }

    /** Ein Dog, der anderswo angelegt wurde, faellt beim Aufraeumen samt aller Versionen. */
    async trackDog(lineageId: string): Promise<void> {
        for (const row of await this.nodesStore.findByLineageId(lineageId)) this.dogVersions.push(String(row.id));
    }

    async cleanup(): Promise<void> {
        for (const kennelId of this.kennelIds) await this.kennelsController.delete(kennelId).catch(() => undefined);
        for (const versionId of this.dogVersions) await this.nodesStore.delete(versionId).catch(() => undefined);
    }
}
