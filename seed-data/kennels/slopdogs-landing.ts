import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { SerializedDog } from '@slopdogs/core';
import { kennelExists } from '../seed-helpers';

/** Der absolute Standard fuer `/`: greift, wenn LANDING_KENNEL_IDS leer ist oder keiner der gelisteten Kennels laeuft (PLAN P5). */
export const SLOPDOGS_LANDING_KENNEL_ID = 'slopdogs-landing';

/**
 * Die Quellen des Landing-Kennels: Content-Dog, Skin C "Mixtape" (der einzige Look, PLAN 8.19), Lead — Dog-Code
 * als Dateien unter `seed-data/kennels/slopdogs-landing/`. Dieselben Dateien baut scripts/build-landing.cjs zum
 * statischen Fallback (`public/landing/index.html`); Kennel und Fallback koennen so nicht auseinanderlaufen.
 */
export class SlopdogsLandingSource {
    private constructor(private readonly dir: string) {}

    /** ts-node liest neben dieser Datei, dist/ (tsc kopiert keine .js-Quellen) liest im Repo. */
    static locate(): SlopdogsLandingSource | null {
        const candidates = [
            path.join(__dirname, 'slopdogs-landing'),
            path.join(__dirname, '..', '..', '..', 'seed-data', 'kennels', 'slopdogs-landing'),
            path.join(process.cwd(), 'seed-data', 'kennels', 'slopdogs-landing'),
        ];
        const dir = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'lead.js')));
        return dir ? new SlopdogsLandingSource(dir) : null;
    }

    read(fileName: string): string {
        return fs.readFileSync(path.join(this.dir, fileName), 'utf8');
    }
}

/** Ein oeffentlicher Community-Dog (ownerId null) in seiner ersten Version; liefert die lineageId. */
async function saveLandingDog(store: IStore, dog: {
    displayName: string; theRun: string; parentsRequired: string[]; icon: string; description: string;
}): Promise<string> {
    const versionId = randomUUID();
    const lineageId = randomUUID();
    const cfg = {
        id: versionId, lineageId, parentId: null,
        displayName: dog.displayName,
        description: dog.description,
        icon: dog.icon,
        parentsRequired: dog.parentsRequired,
        parentsOptional: [],
        theRun: dog.theRun,
    };
    await store.save({
        id: versionId, type: SerializedDog.name, lineageId, parentId: null,
        displayName: dog.displayName, serializedDogConfig: JSON.stringify(cfg),
        visibility: 'public', createdAt: new Date(),
    });
    return lineageId;
}

/**
 * Der Landing-Kennel (PLAN P5): `/` liefert seine Lead-Ausgabe. Idempotent wie jeder Seed — steht der
 * Kennel schon, bleibt er unberuehrt (die Instanz wird regelmaessig geleert; danach legt der Boot ihn neu an).
 * `kennelId` nur fuer Tests (ein frischer Kennel aus den Repo-Quellen neben dem gespeicherten).
 */
export async function seedSlopdogsLandingKennel(nodesStore: IStore, kennelsStore: IStore, kennelId: string = SLOPDOGS_LANDING_KENNEL_ID): Promise<void> {
    const existing = await kennelExists(kennelsStore, kennelId);
    if (existing) return;

    const source = SlopdogsLandingSource.locate();
    if (!source) {
        console.warn(`[seed] ${kennelId}: Quellen (seed-data/kennels/slopdogs-landing/) nicht gefunden — / liefert den statischen Fallback.`);
        return;
    }

    // Wave 1: der Inhalt — reine Daten, eine Quelle fuer Skin C.
    const contentId = await saveLandingDog(nodesStore, {
        displayName: 'SlopdogsLandingContent', theRun: source.read('content.js'), parentsRequired: [],
        icon: '🧾', description: 'SlopDogs landing copy as pure data; skin C renders it.',
    });

    // Wave 2: Skin C "Mixtape" rendert den Inhalt als ganze Seite — der einzige Look.
    const skinCId = await saveLandingDog(nodesStore, {
        displayName: 'SlopdogsLandingSkinC', theRun: source.read('skin_c.js'), parentsRequired: [contentId],
        icon: '📼', description: 'Landing skin C "Mixtape" rendering SlopdogsLandingContent.',
    });

    // Wave 3: der Lead nimmt Skin C als Seite und verdrahtet /api/landing und den Host.
    const leadId = await saveLandingDog(nodesStore, {
        displayName: 'SlopdogsLandingLead', theRun: source.read('lead.js'), parentsRequired: [skinCId],
        icon: '🐕', description: 'Takes SlopdogsLandingSkinC as the page and wires the live rankings from /api/landing.',
    });

    const now = new Date().toISOString();
    await kennelsStore.save({
        id: randomUUID(),
        type: 'KennelConfig',
        lineageId: kennelId,
        parentId: null,
        name: 'SlopDogs',
        description: 'The SlopDogs landing page, served by SlopDogs itself at /. Mixtape only.',
        emoji: '🐕',
        visibility: 'public',
        dogIds: [leadId, contentId, skinCId],
        nodes: JSON.stringify([
            { id: leadId, comment: 'Lead: nimmt Skin C als Seite, haengt /api/landing und den Host an.' },
            { id: contentId, comment: 'Inhalt, die eine Quelle fuer Skin C.' },
            { id: skinCId, comment: 'Skin C Mixtape, der einzige Look.' },
        ]),
        task: '## Wunsch\nDie SlopDogs-Landing ist selbst ein Kennel: ein Inhalt, ein Look (Mixtape), ohne Umschalter.\n\n'
            + '## Quelle\nseed-data/kennels/slopdogs-landing/ (Seed); der statische Fallback public/landing/index.html wird daraus gebaut (scripts/build-landing.cjs).\n\n'
            + '## Betrieb\nGET / bedient die Lead-Ausgabe aus einem HTML-Memo (LANDING_HTML_MEMO_MS), Quelle landing (rankt nicht). PLAN P5.',
        createdAt: now,
        updatedAt: now,
    });

    console.log(`✅ Seeded SlopDogs Landing Kennel (kennelId: ${kennelId})`);
}
