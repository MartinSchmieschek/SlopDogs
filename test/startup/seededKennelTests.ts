/**
 * Spur K (02.11.): die Seed-Kennels Landing und Kennel-Liste — nur geseedet, wenn sie fehlen; Zuruecksetzen = Loeschen
 * (Maintainer) + Neustart. Geprueft an eigenen Kennel-IDs neben den echten (Test-Parameter `kennelId`), damit die
 * geseedeten Kennels der Suite stehen bleiben:
 *
 * 1. Seed -> 'seeded', feste Dog-Lineages; zweiter Seed -> 'kept', nichts veraendert (auch fuer die echten Kennels).
 * 2. Sperre: die Dogs beider Kennels aendert nur ein Maintainer (REST PUT, save_node, delete_node), Nicht-Maintainer
 *    -> 403 locked_landing; den Kennel loeschen ebenso (REST DELETE, delete_kennel).
 * 3. Loeschen mit Nutzungspruefung: ein fremder Kennel nutzt einen Dog, ein fremder Dog einen anderen -> beide bleiben
 *    (samt Parents, usedBy), alle anderen fallen; Vorschau (REST, MCP dryRun) = Ergebnis.
 * 4. Reseed nach dem Loeschen: dieselben Lineages, behaltene Dogs unveraendert ohne neue Version, geloeschte neu;
 *    unveraenderter Repo-Code -> keine neue Version, geaenderter -> genau eine neue Kopfversion (parentId = alter
 *    Kopf), die Sperre gilt auch fuer sie.
 * 5. Reseed beim Start (SeedReseed): Flag und Marke werden erkannt; neue Marke -> Live-Aenderung weg (Repo-Stand),
 *    dieselbe Marke -> uebersprungen, Live-Aenderung bleibt; das Flag setzt immer zurueck und vermerkt keine Marke.
 */
import type { IStore } from '../../store/IStore';
import type { Controller } from '../../api/Controller';
import type { KennelController } from '../../api/KennelController';
import { ConfigRouteHandler, ControllerRegistry } from '../../api/routes/ConfigRouteHandler';
import { DogReferenceIndex } from '../../services/DogReferenceIndex';
import type { IDogStatsStore } from '../../store/IKennelStatsStore';
import { LandingDogLock } from '../../services/LandingDogLock';
import { SeededKennelDelete, type SeededKennelDeleteReport } from '../../services/SeededKennelDelete';
import { LandingKennels } from '../../mcp/auth/landingKennels';
import { Maintainers } from '../../mcp/auth/maintainers';
import type { AuthCtx } from '../../mcp/auth/middleware';
import { getKennelTools } from '../../mcp/tools/kennels';
import { getNodeTools } from '../../mcp/tools/nodes';
import type { ToolDeps } from '../../mcp/tools/types';
import { BASE_DOG_PREFIX, type ISerializedDogConfig } from '@martinschmieschek/slopdogs-core/runtime';
import { MaintainedSeedDogs, type MaintainedSeedSource } from '../../seed-data/kennels/maintainedSeed';
import { SlopdogsLandingSource, seedSlopdogsLandingKennel } from '../../seed-data/kennels/slopdogs-landing';
import { maintainedSeedLineages } from '../../seed-data/kennels/maintainedSeedLineages';
import { SlopdogsKennelsSource, seedSlopdogsKennelsKennel } from '../../seed-data/kennels/slopdogs-kennels';
import { SeedKeptDogs } from '../../seed-data/kennels/seedKeptDogs';
import { SeedReseed, SeedReseedMarks } from '../../services/SeedReseed';
import { randomUUID } from 'crypto';
import type { TestResultSink } from './packageCandidates';

type Reply = { statusCode: number; body: (SeededKennelDeleteReport & { error?: string; deleted?: string }) | undefined };

/** Fake-Response fuer die Route-Handler: Status und Body, sonst nichts. */
class FakeResponse {
    readonly out: Reply = { statusCode: 200, body: undefined };
    status(code: number): this {
        this.out.statusCode = code;
        return this;
    }
    json(body: Reply['body']): this {
        this.out.body = body;
        return this;
    }
    send(body: Reply['body']): this {
        return this.json(body);
    }
    setHeader(): this {
        return this;
    }
    end(): this {
        return this;
    }
}

export class SeededKennelTests {
    static readonly LANDING = 'startup-seed-landing';
    static readonly LIST = 'startup-seed-kennels';
    static readonly PROBE = 'startup-seed-probe';
    static readonly PROBE_LEGACY = 'startup-seed-probe-legacy';
    static readonly RESEED = 'startup-seed-reseed';
    static readonly RESEED_MARK = 'seed-reseed:startup-test';

    private readonly maintainer: AuthCtx = { user: { id: 'UM', email: 'um@test.invalid', name: null }, isSuperUser: false };
    private readonly stranger: AuthCtx = { user: { id: 'U9', email: 'u9@test.invalid', name: null }, isSuperUser: false };
    private foreignDog: string | null = null;
    private legacyDog: string | null = null;
    private readonly kept: SeedKeptDogs;

    constructor(
        private readonly addResult: TestResultSink,
        private readonly nodesStore: IStore,
        private readonly kennelsStore: IStore,
        private readonly nodesController: Controller<ISerializedDogConfig>,
        private readonly kennelsController: KennelController,
        private readonly baseDogsMap: Map<string, unknown>,
    ) {
        this.kept = new SeedKeptDogs(kennelsStore);
    }

    async run(): Promise<void> {
        const testName = 'Spur K: Seed-Kennels nur wenn fehlend, Loeschen mit Nutzungspruefung, Reset = Loeschen + Neustart';
        const lockedBefore = LandingKennels.lockedDogsSnapshot();
        const env = { landing: process.env.LANDING_KENNEL_IDS, maintainers: process.env[Maintainers.ENV] };
        try {
            await this.cases();
            this.addResult(testName, true);
        } catch (error) {
            this.addResult(testName, false, String(error));
        }
        const reseedName = 'Spur K: Reseed beim Start (--reseed immer, SLOPDOGS_RESEED einmal je Marke)';
        try {
            await this.reseedCases();
            this.addResult(reseedName, true);
        } catch (error) {
            this.addResult(reseedName, false, String(error));
        } finally {
            await this.cleanup();
            LandingKennels.setLockedDogs(lockedBefore);
            SeededKennelTests.restoreEnv('LANDING_KENNEL_IDS', env.landing);
            SeededKennelTests.restoreEnv(Maintainers.ENV, env.maintainers);
        }
    }

    private async cases(): Promise<void> {
        const { LANDING, LIST, PROBE } = SeededKennelTests;
        const landingSource = SlopdogsLandingSource.locate();
        const listSource = SlopdogsKennelsSource.locate();
        if (!landingSource || !listSource) throw new Error('Seed-Quellen nicht gefunden');
        const landingNames = ['SlopdogsLandingContent', 'SlopdogsLandingSkinC', 'SlopdogsLandingLead'];
        const listNames = SlopdogsKennelsSource.DOGS.map((d) => d.displayName);
        const landingLineages = landingNames.map((n) => MaintainedSeedDogs.lineageId(LANDING, n));
        const listLineages = listNames.map((n) => MaintainedSeedDogs.lineageId(LIST, n));
        const lineageOf = (kennelId: string, name: string) => MaintainedSeedDogs.lineageId(kennelId, name);

        // 1. Seed nur, wenn der Kennel fehlt.
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore)) !== 'kept')
            throw new Error('zweiter Boot seedet slopdogs-landing neu');
        if ((await seedSlopdogsKennelsKennel(this.nodesStore, this.kennelsStore)) !== 'kept')
            throw new Error('zweiter Boot seedet slopdogs-kennels neu');
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, LANDING)) !== 'seeded')
            throw new Error(`${LANDING} nicht geseedet`);
        if ((await seedSlopdogsKennelsKennel(this.nodesStore, this.kennelsStore, LIST)) !== 'seeded')
            throw new Error(`${LIST} nicht geseedet`);
        await this.expectKennelDogs(LANDING, landingLineages);
        await this.expectKennelDogs(LIST, listLineages);
        if (listLineages.length !== 45) throw new Error(`Kennel-Liste hat ${listLineages.length} Dogs statt 45`);
        const before = await this.versionCounts([...landingLineages, ...listLineages]);
        if ([...before.values()].some((n) => n !== 1)) throw new Error('frischer Seed: nicht genau eine Version je Dog');
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, LANDING)) !== 'kept')
            throw new Error(`zweiter Seed ${LANDING} nicht kept`);
        if ((await seedSlopdogsKennelsKennel(this.nodesStore, this.kennelsStore, LIST)) !== 'kept')
            throw new Error(`zweiter Seed ${LIST} nicht kept`);
        this.expectSameCounts(before, await this.versionCounts([...landingLineages, ...listLineages]), 'zweiter Seed');
        if ((await this.kennelsStore.findByLineage('KennelConfig', LANDING)).length !== 1)
            throw new Error('zweiter Seed: neue Kennel-Version');

        // 2. Sperre der Dogs und des Kennels: nur Maintainer.
        process.env.LANDING_KENNEL_IDS = [env(process.env.LANDING_KENNEL_IDS), LANDING, LIST].filter(Boolean).join(',');
        process.env[Maintainers.ENV] = this.maintainer.user!.email as string;
        const refIndex = new DogReferenceIndex(this.nodesStore as unknown as IDogStatsStore, this.nodesStore, this.baseDogsMap);
        const lock = this.lock(refIndex);
        await lock.refresh();
        const content = lineageOf(LANDING, 'SlopdogsLandingContent');
        const copy = lineageOf(LIST, 'SlopdogsKennelsCopy');
        for (const dog of [content, copy]) await this.expectDogLocked(dog);

        // 3. Loeschen mit Nutzungspruefung: ein fremder Kennel nutzt Styles (mit 11 Parents), ein fremder Dog Config.
        const styles = lineageOf(LIST, 'SlopdogsKennelsStyles');
        const config = lineageOf(LIST, 'SlopdogsKennelsConfig');
        const foreign = await this.nodesController.create({
            displayName: 'StartupSeedProbeDog',
            theRun: 'return { ok: true };',
            parentsRequired: [config],
            parentsOptional: [],
            visibility: 'public',
            ownerId: 'UO',
        });
        if (!foreign.ok || !foreign.data) throw new Error(`fremder Dog nicht angelegt: ${foreign.error}`);
        this.foreignDog = String(foreign.data.lineageId);
        const probe = await this.kennelsController.create({
            id: PROBE,
            name: 'Probe',
            dogIds: [styles],
            visibility: 'public',
            ownerId: 'UO',
        });
        if (!probe.ok) throw new Error(`Probe-Kennel nicht angelegt: ${probe.error}`);
        await refIndex.rebuild();
        const seeded = this.seededDelete(refIndex);
        const handler = new ConfigRouteHandler(this.registry(), this.kennelsStore);
        handler.useSeededKennelDelete(seeded);
        const deps = this.toolDeps(seeded);
        const deleteKennel = getKennelTools().find((t) => t.name === 'delete_kennel')!;

        const refused = await this.call(handler, 'handleDelete', { subpath: 'kennels', id: LIST }, this.stranger);
        if (refused.statusCode !== 403 || refused.body?.error !== LandingKennels.LOCK_CODE)
            throw new Error(`REST DELETE ${LIST} fuer Nicht-Maintainer: ${refused.statusCode} ${JSON.stringify(refused.body)}`);
        const mcpRefused = await deleteKennel.handler({ id: LIST }, this.stranger, deps);
        if (!mcpRefused.isError || !mcpRefused.content[0].text.includes(LandingKennels.LOCK_CODE))
            throw new Error(`delete_kennel ${LIST} fuer Nicht-Maintainer: ${mcpRefused.content[0].text.slice(0, 200)}`);
        const previewRefused = await this.call(handler, 'handleDeletePreview', { id: LIST }, this.stranger);
        if (previewRefused.statusCode !== 403) throw new Error(`Vorschau fuer Nicht-Maintainer: ${previewRefused.statusCode}`);

        const preview = await this.call(handler, 'handleDeletePreview', { id: LIST }, this.maintainer);
        if (preview.statusCode !== 200) throw new Error(`Vorschau: ${preview.statusCode} ${JSON.stringify(preview.body)}`);
        const mcpPreview = await deleteKennel.handler({ id: LIST, dryRun: true }, this.maintainer, deps);
        if (mcpPreview.isError) throw new Error(`delete_kennel dryRun: ${mcpPreview.content[0].text.slice(0, 200)}`);
        const keptNames = [
            'SlopdogsKennelsStyles',
            ...SlopdogsKennelsSource.DOGS.find((d) => d.displayName === 'SlopdogsKennelsStyles')!.parents!,
            'SlopdogsKennelsConfig',
        ];
        const keptLineages = new Set(keptNames.map((n) => lineageOf(LIST, n)));
        this.expectReport(preview.body, keptLineages, listLineages.length, { [styles]: PROBE, [config]: this.foreignDog! });
        this.expectReport(JSON.parse(mcpPreview.content[0].text), keptLineages, listLineages.length, {});
        if ((await this.kennelsStore.findByLineage('KennelConfig', LIST)).length === 0) throw new Error('Vorschau hat geloescht');

        const deleted = await this.call(handler, 'handleDelete', { subpath: 'kennels', id: LIST }, this.maintainer);
        if (deleted.statusCode !== 200 || deleted.body?.deleted !== LIST || deleted.body?.reseed !== SeededKennelDelete.RESEED)
            throw new Error(`REST DELETE ${LIST} fuer Maintainer: ${deleted.statusCode} ${JSON.stringify(deleted.body).slice(0, 300)}`);
        this.expectReport(deleted.body, keptLineages, listLineages.length, { [styles]: PROBE });
        if ((await this.kennelsStore.findByLineage('KennelConfig', LIST)).length !== 0) throw new Error(`${LIST} nicht geloescht`);
        const afterDelete = await this.versionCounts(listLineages);
        for (const lineage of listLineages) {
            const n = afterDelete.get(lineage) ?? 0;
            if (keptLineages.has(lineage) ? n !== 1 : n !== 0) throw new Error(`nach dem Loeschen: ${lineage} hat ${n} Versionen`);
        }
        if ((await this.kennelsStore.findByLineage('KennelConfig', PROBE)).length !== 1)
            throw new Error('Probe-Kennel beim Loeschen beschaedigt');
        // Kennel weg, behaltener Dog bleibt gesperrt (feste Seed-Lineage): Nicht-Maintainer 403, Maintainer ok.
        await lock.refresh();
        await this.expectDogLocked(config);

        // 4. Reseed: dieselben Lineages, behaltene unveraendert, geloeschte neu — keine neuen Lineages.
        if ((await seedSlopdogsKennelsKennel(this.nodesStore, this.kennelsStore, LIST)) !== 'seeded')
            throw new Error(`Reseed ${LIST} nicht seeded`);
        await this.expectKennelDogs(LIST, listLineages);
        this.expectSameCounts(before, await this.versionCounts(listLineages), 'Reseed nach dem Loeschen', listLineages);

        // Landing: Kennel weg, Dogs bleiben (wie ein behaltener Satz) -> unveraenderter Code wiederverwendet, geaenderter versioniert.
        await this.deleteKennelOnly(LANDING);
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, LANDING)) !== 'seeded')
            throw new Error(`Reseed ${LANDING} nicht seeded`);
        this.expectSameCounts(before, await this.versionCounts(landingLineages), 'Reseed mit unveraendertem Code', landingLineages);
        await this.deleteKennelOnly(LANDING);
        const changed: MaintainedSeedSource = {
            read: (file) => (file === 'content.js' ? `${landingSource.read(file)}\n// startup-seed-change\n` : landingSource.read(file)),
        };
        const oldHead = (await this.nodesStore.findAllVersions('SerializedDog', content))[0];
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, LANDING, changed)) !== 'seeded')
            throw new Error(`Reseed ${LANDING} (geaendert) nicht seeded`);
        const versions = await this.nodesStore.findAllVersions('SerializedDog', content);
        if (
            versions.length !== 2 ||
            versions[0].parentId !== oldHead.id ||
            !JSON.parse(versions[0].serializedDogConfig).theRun.includes('startup-seed-change')
        )
            throw new Error(`geaenderter Code: ${versions.length} Versionen, parentId ${versions[0]?.parentId} statt ${oldHead.id}`);
        const others = await this.versionCounts(landingLineages.filter((l) => l !== content));
        if ([...others.values()].some((n) => n !== 1)) throw new Error('geaenderter Code: andere Landing-Dogs versioniert');
        await this.expectKennelDogs(LANDING, landingLineages);
        await lock.refresh();
        await this.expectDogLocked(content);

        // 5. Bestand mit Zufalls-Lineage: ein fremder Kennel nutzt den Content-Dog, der Maintainer loescht die Landing.
        // Der Merker haelt den Dog gesperrt und setzt den Reseed auf genau diese Lineage — kein zweiter Content-Dog.
        await this.deleteKennelOnly(LANDING);
        for (const lineage of landingLineages) await this.nodesController.deleteRef(lineage);
        const legacy = randomUUID();
        const legacyVersion = randomUUID();
        this.legacyDog = legacy;
        await this.nodesStore.save({
            id: legacyVersion,
            type: 'SerializedDog',
            lineageId: legacy,
            parentId: null,
            displayName: 'SlopdogsLandingContent',
            serializedDogConfig: JSON.stringify({
                id: legacyVersion,
                lineageId: legacy,
                parentId: null,
                displayName: 'SlopdogsLandingContent',
                description: 'legacy content',
                icon: '🧾',
                parentsRequired: [],
                parentsOptional: [],
                theRun: 'return { legacy: true };',
            }),
            visibility: 'public',
            createdAt: new Date(),
        });
        if (!(await this.kennelsController.create({ id: LANDING, name: 'Legacy', dogIds: [legacy], visibility: 'public' })).ok)
            throw new Error('Bestands-Landing nicht angelegt');
        const { PROBE_LEGACY } = SeededKennelTests;
        if (
            !(
                await this.kennelsController.create({
                    id: PROBE_LEGACY,
                    name: 'Probe',
                    dogIds: [legacy],
                    visibility: 'public',
                    ownerId: 'UO',
                })
            ).ok
        )
            throw new Error('Probe-Kennel (Bestand) nicht angelegt');
        await refIndex.rebuild();
        const legacyDelete = await this.call(handler, 'handleDelete', { subpath: 'kennels', id: LANDING }, this.maintainer);
        if (
            legacyDelete.statusCode !== 200 ||
            !legacyDelete.body?.dogsKept?.some((d) => d.lineageId === legacy && d.usedBy.includes(PROBE_LEGACY))
        )
            throw new Error(
                `Bestand: Loeschen meldet den genutzten Dog nicht als behalten: ${JSON.stringify(legacyDelete.body).slice(0, 300)}`,
            );
        if ((await this.kept.lineageFor(LANDING, 'SlopdogsLandingContent')) !== legacy) throw new Error('Bestand: Merker fehlt');
        await lock.refresh();
        await this.expectDogLocked(legacy);
        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, LANDING)) !== 'seeded')
            throw new Error(`Bestand: Reseed ${LANDING} nicht seeded`);
        const reseeded = await this.kennelsController.getById(LANDING);
        const reseededIds: string[] = reseeded.ok && reseeded.data ? (reseeded.data.dogIds ?? []) : [];
        if (!reseededIds.includes(legacy) || reseededIds.includes(content))
            throw new Error(`Bestand: Reseed nutzt nicht die Zufalls-Lineage: ${JSON.stringify(reseededIds)}`);
        if ((await this.nodesStore.findByLineageId(content)).length !== 0)
            throw new Error('Bestand: zweiter Content-Dog auf der festen Lineage');
        const legacyVersions = await this.nodesStore.findAllVersions('SerializedDog', legacy);
        if (legacyVersions.length !== 2 || legacyVersions[0].parentId !== legacyVersion)
            throw new Error(`Bestand: ${legacyVersions.length} Versionen, parentId ${legacyVersions[0]?.parentId} statt ${legacyVersion}`);
        if ((await this.kept.list(LANDING)).length !== 0) throw new Error('Bestand: Merker nach dem Reseed nicht entfernt');
    }

    /** 5. Reseed beim Start an einer eigenen Kennel-ID und einer eigenen Marken-Zeile. */
    private async reseedCases(): Promise<void> {
        const { RESEED } = SeededKennelTests;
        const landingSource = SlopdogsLandingSource.locate();
        if (!landingSource) throw new Error('Seed-Quellen nicht gefunden');
        const trigger = (argv: string[], env: NodeJS.ProcessEnv) => JSON.stringify(SeedReseed.triggerOf(argv, env));
        if (trigger([], {}) !== 'null' || trigger([], { SLOPDOGS_RESEED: '  ' }) !== 'null')
            throw new Error('ohne Flag und Marke ein Ausloeser');
        if (trigger(['--reseed'], { SLOPDOGS_RESEED: 'm' }) !== '{"kind":"flag"}') throw new Error('Flag nicht erkannt');
        const messy = trigger([], { SLOPDOGS_RESEED: ' 2026-11-02 \n b ' });
        if (messy !== '{"kind":"marker","marker":"2026-11-02 b"}') throw new Error(`Marke nicht bereinigt: ${messy}`);

        const marks = new SeedReseedMarks(this.kennelsStore, SeededKennelTests.RESEED_MARK);
        await marks.forget();
        const refIndex = new DogReferenceIndex(this.nodesStore as unknown as IDogStatsStore, this.nodesStore, this.baseDogsMap);
        const lines: string[] = [];
        let afterReseed = 0;
        const reseed = new SeedReseed({
            targets: [
                { kennelId: RESEED, label: 'landing', seed: () => seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, RESEED) },
            ],
            deleteSeeded: (kennelId) => this.seededDelete(refIndex, [RESEED]).delete(kennelId),
            marks,
            afterReseed: () => {
                afterReseed += 1;
            },
            log: (line) => lines.push(line),
        });
        if ((await reseed.run(null)).status !== 'none' || lines.length !== 0) throw new Error('ohne Ausloeser nicht still');

        if ((await seedSlopdogsLandingKennel(this.nodesStore, this.kennelsStore, RESEED)) !== 'seeded')
            throw new Error(`${RESEED} nicht geseedet`);
        const landingLineages = ['SlopdogsLandingContent', 'SlopdogsLandingSkinC', 'SlopdogsLandingLead'].map((n) =>
            MaintainedSeedDogs.lineageId(RESEED, n),
        );
        const content = landingLineages[0];
        const repoCode = landingSource.read('content.js');
        const headCode = async (): Promise<string> =>
            JSON.parse((await this.nodesStore.findAllVersions('SerializedDog', content))[0].serializedDogConfig).theRun;
        const liveChange = async (tag: string) => {
            const saved = await this.nodesController.save({ id: content, theRun: `${repoCode}\n// ${tag}\n` });
            if (!saved.ok) throw new Error(`Live-Aenderung ${tag}: ${saved.error}`);
        };

        // Neue Marke: Live-Aenderung weg, alle drei Dogs geloescht und frisch geseedet, Marke vermerkt.
        await liveChange('live-1');
        const first = await reseed.run({ kind: 'marker', marker: 'startup-m1' });
        const t = first.status === 'reseeded' ? first.targets[0] : null;
        if (!t || t.deleted !== 3 || t.kept !== 0 || t.seed !== 'seeded') throw new Error(`neue Marke: ${JSON.stringify(first)}`);
        if ((await headCode()) !== repoCode) throw new Error('neue Marke: Live-Aenderung nicht zurueckgesetzt');
        if ((await this.nodesStore.findAllVersions('SerializedDog', content)).length !== 1)
            throw new Error('neue Marke: Content-Dog nicht frisch (alte Versionen stehen)');
        if ((await marks.last()) !== 'startup-m1') throw new Error('neue Marke nicht vermerkt');
        if (lines[0] !== '[seed] reseed startup-m1: landing 3 Dogs geloescht, 0 behalten') throw new Error(`Log: ${lines[0]}`);
        await this.expectKennelDogs(RESEED, landingLineages);

        // Dieselbe Marke: nichts passiert, die Live-Aenderung danach bleibt.
        await liveChange('live-2');
        const second = await reseed.run({ kind: 'marker', marker: 'startup-m1' });
        if (second.status !== 'skipped') throw new Error(`gleiche Marke: ${JSON.stringify(second)}`);
        if (!(await headCode()).includes('live-2')) throw new Error('gleiche Marke: Live-Aenderung verloren');
        if (lines[1] !== '[seed] reseed startup-m1 schon angewandt -- uebersprungen') throw new Error(`Log: ${lines[1]}`);

        // Das Flag setzt immer zurueck und laesst die vermerkte Marke stehen.
        const flagged = await reseed.run({ kind: 'flag' });
        if (flagged.status !== 'reseeded' || (await headCode()) !== repoCode) throw new Error(`Flag: ${JSON.stringify(flagged)}`);
        if ((await marks.last()) !== 'startup-m1') throw new Error('Flag hat die Marke ueberschrieben');
        if (afterReseed !== 2) throw new Error(`afterReseed ${afterReseed}x statt 2x`);
    }

    /** Nicht-Maintainer: REST PUT, save_node, delete_node -> locked_landing; Maintainer: REST PUT und save_node ok. */
    private async expectDogLocked(lineageId: string): Promise<void> {
        const versionsBefore = await this.nodesStore.findAllVersions('SerializedDog', lineageId);
        const head = versionsBefore[0];
        if (!head) throw new Error(`Dog ${lineageId} fehlt`);
        const theRun = JSON.parse(head.serializedDogConfig).theRun as string;
        const handler = new ConfigRouteHandler(this.registry(), this.kennelsStore);
        const deps = this.toolDeps(null);
        const tool = (name: string) => getNodeTools().find((t) => t.name === name)!;
        const put = await this.call(handler, 'handleUpdate', { subpath: 'nodes', id: lineageId }, this.stranger, { theRun });
        if (put.statusCode !== 403 || put.body?.error !== LandingKennels.LOCK_CODE)
            throw new Error(`REST PUT ${lineageId} fuer Nicht-Maintainer: ${put.statusCode} ${JSON.stringify(put.body)}`);
        for (const name of ['save_node', 'delete_node']) {
            const r = await tool(name).handler({ id: lineageId, tsCode: theRun }, this.stranger, deps);
            if (!r.isError || !r.content[0].text.startsWith(LandingKennels.LOCK_CODE))
                throw new Error(`${name} ${lineageId} fuer Nicht-Maintainer: ${r.content[0].text.slice(0, 200)}`);
        }
        const okPut = await this.call(handler, 'handleUpdate', { subpath: 'nodes', id: lineageId }, this.maintainer, { theRun });
        if (okPut.statusCode !== 200)
            throw new Error(`REST PUT ${lineageId} fuer Maintainer: ${okPut.statusCode} ${JSON.stringify(okPut.body)}`);
        const okSave = await tool('save_node').handler({ id: lineageId, tsCode: theRun }, this.maintainer, deps);
        if (okSave.isError) throw new Error(`save_node ${lineageId} fuer Maintainer: ${okSave.content[0].text.slice(0, 200)}`);
        const count = (await this.nodesStore.findAllVersions('SerializedDog', lineageId)).length;
        if (count !== versionsBefore.length) throw new Error(`unveraendertes Speichern: ${versionsBefore.length} -> ${count} Versionen`);
    }

    private expectReport(reply: Reply['body'], kept: Set<string>, total: number, usedBy: Record<string, string>): void {
        const body = reply ?? { kennelId: '', dogsDeleted: [], dogsKept: [], reseed: SeededKennelDelete.RESEED };
        const keptIds = new Set((body.dogsKept ?? []).map((d) => d.lineageId));
        const deletedIds = new Set((body.dogsDeleted ?? []).map((d) => d.lineageId));
        if (keptIds.size !== kept.size || [...kept].some((l) => !keptIds.has(l)))
            throw new Error(`behalten: ${keptIds.size} statt ${kept.size} (${JSON.stringify(body.dogsKept).slice(0, 300)})`);
        if (deletedIds.size !== total - kept.size || [...kept].some((l) => deletedIds.has(l)))
            throw new Error(`geloescht: ${deletedIds.size} statt ${total - kept.size}`);
        for (const [lineage, user] of Object.entries(usedBy)) {
            const dog = (body.dogsKept ?? []).find((d) => d.lineageId === lineage);
            if (!dog?.usedBy.includes(user)) throw new Error(`usedBy von ${lineage}: ${JSON.stringify(dog?.usedBy)} ohne ${user}`);
        }
    }

    private async expectKennelDogs(kennelId: string, lineages: string[]): Promise<void> {
        const head = await this.kennelsController.getById(kennelId);
        const dogIds: string[] = head.ok && head.data ? (head.data.dogIds ?? []) : [];
        if (dogIds.length !== lineages.length || lineages.some((l) => !dogIds.includes(l)))
            throw new Error(`${kennelId}: dogIds ${dogIds.length} statt ${lineages.length} feste Lineages`);
    }

    private async versionCounts(lineages: string[]): Promise<Map<string, number>> {
        const out = new Map<string, number>();
        for (const lineage of lineages) out.set(lineage, (await this.nodesStore.findByLineageId(lineage)).length);
        return out;
    }

    private expectSameCounts(before: Map<string, number>, after: Map<string, number>, label: string, only?: string[]): void {
        for (const lineage of only ?? [...before.keys()]) {
            if (before.get(lineage) !== after.get(lineage))
                throw new Error(`${label}: ${lineage} ${before.get(lineage)} -> ${after.get(lineage)} Versionen`);
        }
    }

    private async deleteKennelOnly(kennelId: string): Promise<void> {
        if (!(await this.kennelsController.deleteRef(kennelId)).ok) throw new Error(`${kennelId} nicht geloescht`);
    }

    private lock(refIndex: DogReferenceIndex): LandingDogLock {
        return new LandingDogLock(
            {
                kennelDogIds: async (kennelId) => {
                    const head = await this.kennelsController.getById(kennelId);
                    return head.ok && head.data ? (head.data.dogIds ?? []) : null;
                },
                lineageOf: (ref) => this.lineageOf(refIndex, ref),
                dogHeads: async (ids) => (await this.nodesController.listLatest(undefined, ids)).data ?? [],
                fixedLineages: async () => [
                    ...maintainedSeedLineages(SeededKennelTests.LANDING, SeededKennelTests.LIST),
                    ...(await this.kept.list()).map((entry) => entry.lineageId),
                ],
            },
            { intervalMs: 0 },
        );
    }

    private seededDelete(
        refIndex: DogReferenceIndex,
        seededIds: string[] = [SeededKennelTests.LANDING, SeededKennelTests.LIST],
    ): SeededKennelDelete {
        return new SeededKennelDelete(
            {
                kennelDogIds: async (kennelId) => {
                    const head = await this.kennelsController.getById(kennelId);
                    return head.ok && head.data ? (head.data.dogIds ?? []) : null;
                },
                lineageOf: (ref) => this.lineageOf(refIndex, ref),
                dogHeads: async (ids) => (await this.nodesController.listLatest(undefined, ids)).data ?? [],
                referencesTo: (ids) => refIndex.referencesTo(ids),
                deleteKennel: async (kennelId) => (await this.kennelsController.deleteRef(kennelId)).ok,
                deleteDog: async (lineageId) => (await this.nodesController.deleteRef(lineageId)).ok,
                rememberKept: (kennelId, dogs) => this.kept.remember(kennelId, dogs),
            },
            (kennelId) => seededIds.includes(kennelId),
        );
    }

    private async lineageOf(refIndex: DogReferenceIndex, ref: string): Promise<string | null> {
        const normalized = await refIndex.normalize(ref);
        return normalized.toKey.startsWith(BASE_DOG_PREFIX) ? null : normalized.toKey;
    }

    private registry(): ControllerRegistry {
        const registry = new ControllerRegistry();
        registry.register('nodes', this.nodesController);
        registry.register('kennels', this.kennelsController);
        return registry;
    }

    /** Was delete_kennel, save_node und delete_node hier brauchen; der Rest bleibt leer. */
    private toolDeps(seededKennelDelete: SeededKennelDelete | null): ToolDeps {
        return {
            kennelsController: this.kennelsController,
            nodesController: this.nodesController,
            kennelsStore: this.kennelsStore,
            nodesStore: this.nodesStore,
            baseDogsList: [],
            ...(seededKennelDelete ? { seededKennelDelete } : {}),
        } as unknown as ToolDeps;
    }

    private async call(
        handler: ConfigRouteHandler,
        method: string,
        params: Record<string, string>,
        ctx: AuthCtx,
        body: unknown = {},
    ): Promise<Reply> {
        const res = new FakeResponse();
        const route = (handler as unknown as Record<string, (req: unknown, res: FakeResponse) => Promise<void>>)[method];
        await route.call(handler, { params, query: {}, body, ctx, method: 'GET', get: () => undefined }, res);
        return res.out;
    }

    /** Alles, was der Fall angelegt hat: die drei Test-Kennels, ihre festen Dog-Lineages, der fremde Dog. */
    private async cleanup(): Promise<void> {
        const { LANDING, LIST, PROBE } = SeededKennelTests;
        const lineages = [
            ...['SlopdogsLandingContent', 'SlopdogsLandingSkinC', 'SlopdogsLandingLead'].map((n) =>
                MaintainedSeedDogs.lineageId(LANDING, n),
            ),
            ...SlopdogsKennelsSource.DOGS.map((d) => MaintainedSeedDogs.lineageId(LIST, d.displayName)),
            ...['SlopdogsLandingContent', 'SlopdogsLandingSkinC', 'SlopdogsLandingLead'].map((n) =>
                MaintainedSeedDogs.lineageId(SeededKennelTests.RESEED, n),
            ),
            ...(this.foreignDog ? [this.foreignDog] : []),
            ...(this.legacyDog ? [this.legacyDog] : []),
        ];
        await new SeedReseedMarks(this.kennelsStore, SeededKennelTests.RESEED_MARK).forget();
        for (const kennelId of [LANDING, LIST, PROBE, SeededKennelTests.PROBE_LEGACY, SeededKennelTests.RESEED])
            await this.kennelsController.deleteRef(kennelId).catch(() => undefined);
        for (const entry of [...(await this.kept.list(LANDING)), ...(await this.kept.list(LIST))])
            await this.kept.forget(entry.kennelId, entry.displayName);
        for (const lineage of lineages) await this.nodesController.deleteRef(lineage).catch(() => undefined);
    }

    private static restoreEnv(name: string, value: string | undefined): void {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    }
}

function env(value: string | undefined): string {
    return (value ?? '').trim();
}
