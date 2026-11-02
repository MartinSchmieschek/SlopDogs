import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { IStore } from '../../store/IStore';
import { MaintainedSeedDogs, type MaintainedSeedSource } from './maintainedSeed';
import { SeedKeptDogs } from './seedKeptDogs';
import { kennelExists } from '../seed-helpers';

/** Die Kennel-Liste als Kennel (Spur K): `/kennels` liefert die Lead-Ausgabe, solange sie laeuft (KennelListPage). */
export const SLOPDOGS_KENNELS_KENNEL_ID = 'slopdogs-kennels';

/** Ein Dog des Kennels: Quelldatei unter `seed-data/kennels/slopdogs-kennels/`, Parents per Anzeigename. */
interface KennelListDogSource {
    displayName: string;
    file: string;
    icon: string;
    description: string;
    parents?: string[];
}

const STYLE_DOGS = [
    'SlopdogsKennelsTokens',
    'SlopdogsKennelsStyleBase',
    'SlopdogsKennelsStyleControls',
    'SlopdogsKennelsStyleShell',
    'SlopdogsKennelsStyleRow',
    'SlopdogsKennelsStyleMenu',
    'SlopdogsKennelsStyleSheet',
    'SlopdogsKennelsStyleDialog',
    'SlopdogsKennelsStyleVeil',
    'SlopdogsKennelsStyleShellPhone',
    'SlopdogsKennelsStyleRowPhone',
];
const SCRIPT_DOGS = [
    'SlopdogsKennelsScriptState',
    'SlopdogsKennelsScriptApi',
    'SlopdogsKennelsScriptUi',
    'SlopdogsKennelsScriptAuth',
    'SlopdogsKennelsScriptList',
    'SlopdogsKennelsScriptFormat',
    'SlopdogsKennelsScriptRights',
    'SlopdogsKennelsScriptRow',
    'SlopdogsKennelsScriptMenu',
    'SlopdogsKennelsScriptRowMenu',
    'SlopdogsKennelsScriptActions',
    'SlopdogsKennelsScriptClipboard',
    'SlopdogsKennelsScriptImport',
    'SlopdogsKennelsScriptCreateFields',
    'SlopdogsKennelsScriptCreate',
    'SlopdogsKennelsScriptVeil',
    'SlopdogsKennelsScriptCinema',
    'SlopdogsKennelsScriptEmpty',
    'SlopdogsKennelsScriptRender',
    'SlopdogsKennelsScriptEvents',
    'SlopdogsKennelsScriptBoot',
];

/**
 * Der Schnitt (Amar 5, Follie 3): ein Dog = eine benennbare Sache, jeder unter der Groessengrenze des Dienstes.
 * Reihenfolge = Speicherreihenfolge: Parents stehen vor ihren Kindern. Der Lead steht im Kennel vorn (dogIds[0]).
 */
const DOGS: KennelListDogSource[] = [
    {
        displayName: 'SlopdogsKennelsCopy',
        file: 'copy.js',
        icon: '🧾',
        description: 'Every English text of the kennel list page, as data.',
    },
    {
        displayName: 'SlopdogsKennelsConfig',
        file: 'config.js',
        icon: '⚙️',
        description: 'Paths, paging, timings, sort keys, storage keys, ID rule, emojis.',
    },
    {
        displayName: 'SlopdogsKennelsVerses',
        file: 'verses.js',
        icon: '📜',
        description: 'The nine requiem couplets the veil shows while loading.',
    },
    {
        displayName: 'SlopdogsKennelsTokens',
        file: 'tokens.js',
        icon: '🎨',
        description: 'Design tokens (light, dark) with the contrast fixes and fonts.',
    },
    { displayName: 'SlopdogsKennelsStyleBase', file: 'style-base.js', icon: '🎨', description: 'Base type, focus ring and chips.' },
    {
        displayName: 'SlopdogsKennelsStyleControls',
        file: 'style-controls.js',
        icon: '🎨',
        description: 'Buttons, fields, labels and hints.',
    },
    {
        displayName: 'SlopdogsKennelsStyleShell',
        file: 'style-shell.js',
        icon: '🎨',
        description: 'Top bar, chapter band, tool row and banners.',
    },
    {
        displayName: 'SlopdogsKennelsStyleShellPhone',
        file: 'style-shell-phone.js',
        icon: '🎨',
        description: 'The shell below 768 px: lens, FAB, bottom bar.',
    },
    {
        displayName: 'SlopdogsKennelsStyleRow',
        file: 'style-row.js',
        icon: '🎨',
        description: 'The tracklist row, skeleton, empty states, status line.',
    },
    { displayName: 'SlopdogsKennelsStyleRowPhone', file: 'style-row-phone.js', icon: '🎨', description: 'The row below 768 px.' },
    { displayName: 'SlopdogsKennelsStyleMenu', file: 'style-menu.js', icon: '🎨', description: 'Row and account menus, layer scrim.' },
    {
        displayName: 'SlopdogsKennelsStyleSheet',
        file: 'style-sheet.js',
        icon: '🎨',
        description: 'The create sheet with emoji picker and radios.',
    },
    { displayName: 'SlopdogsKennelsStyleDialog', file: 'style-dialog.js', icon: '🎨', description: 'Dialog, key help and toast.' },
    {
        displayName: 'SlopdogsKennelsStyleVeil',
        file: 'style-veil.js',
        icon: '🎨',
        description: 'Cold-start veil, iris, void cinema, reduced motion.',
    },
    {
        displayName: 'SlopdogsKennelsTopBar',
        file: 'top-bar.js',
        icon: '🧩',
        description: 'HTML of the top bar: emblem, sides, search, + New, auth slot.',
    },
    {
        displayName: 'SlopdogsKennelsToolbar',
        file: 'toolbar.js',
        icon: '🧩',
        description: 'HTML of the chapter band and the sort and filter tools.',
        parents: ['SlopdogsKennelsConfig'],
    },
    {
        displayName: 'SlopdogsKennelsStates',
        file: 'states.js',
        icon: '🧩',
        description: 'HTML of the banners, list stage, veil, empty slot and status.',
    },
    {
        displayName: 'SlopdogsKennelsRowTemplate',
        file: 'row-template.js',
        icon: '🧩',
        description: 'Templates of a row, its menu and a skeleton row.',
    },
    { displayName: 'SlopdogsKennelsCreateSheet', file: 'create-sheet.js', icon: '🧩', description: 'Template of the New kennel sheet.' },
    {
        displayName: 'SlopdogsKennelsChrome',
        file: 'chrome.js',
        icon: '🧩',
        description: 'FAB, bottom bar, toast, layers and dialog, import, keys, cinema templates.',
    },
    {
        displayName: 'SlopdogsKennelsScriptState',
        file: 'script-state.js',
        icon: '📜',
        description: 'Page state, DOM helpers, storage and the URL as state.',
    },
    {
        displayName: 'SlopdogsKennelsScriptApi',
        file: 'script-api.js',
        icon: '📜',
        description: 'Same-origin fetch wrapper and the REST calls, with wake retries.',
    },
    {
        displayName: 'SlopdogsKennelsScriptUi',
        file: 'script-ui.js',
        icon: '📜',
        description: 'Layers, focus trap, dialog, toast and phone search.',
    },
    {
        displayName: 'SlopdogsKennelsScriptAuth',
        file: 'script-auth.js',
        icon: '📜',
        description: 'Auth slot, sign-in paths and the account menu.',
    },
    {
        displayName: 'SlopdogsKennelsScriptList',
        file: 'script-list.js',
        icon: '📜',
        description: 'Paging with generations, dedupe and counts.',
    },
    {
        displayName: 'SlopdogsKennelsScriptFormat',
        file: 'script-format.js',
        icon: '📜',
        description: 'Counts, relative time, chips and stars.',
    },
    {
        displayName: 'SlopdogsKennelsScriptRights',
        file: 'script-rights.js',
        icon: '📜',
        description: 'Run only, edit lock and delete right from myRights.',
    },
    {
        displayName: 'SlopdogsKennelsScriptRow',
        file: 'script-row.js',
        icon: '📜',
        description: 'Fills one row: chips, meta, plaque, stars, time, flag.',
    },
    {
        displayName: 'SlopdogsKennelsScriptMenu',
        file: 'script-menu.js',
        icon: '📜',
        description: 'One open menu at a time, with keys and flip.',
    },
    { displayName: 'SlopdogsKennelsScriptRowMenu', file: 'script-row-menu.js', icon: '📜', description: 'The row menu with lock hints.' },
    {
        displayName: 'SlopdogsKennelsScriptActions',
        file: 'script-actions.js',
        icon: '📜',
        description: 'Opened last, favorite flag and delete.',
    },
    { displayName: 'SlopdogsKennelsScriptClipboard', file: 'script-clipboard.js', icon: '📜', description: 'Share link and export.' },
    {
        displayName: 'SlopdogsKennelsScriptImport',
        file: 'script-import.js',
        icon: '📜',
        description: 'The import dialog: paste, clipboard or file.',
    },
    {
        displayName: 'SlopdogsKennelsScriptCreateFields',
        file: 'script-create-fields.js',
        icon: '📜',
        description: 'ID rule and emoji picker of the New kennel sheet.',
    },
    {
        displayName: 'SlopdogsKennelsScriptCreate',
        file: 'script-create.js',
        icon: '📜',
        description: 'Opens the New kennel sheet and creates the kennel.',
    },
    {
        displayName: 'SlopdogsKennelsScriptVeil',
        file: 'script-veil.js',
        icon: '📜',
        description: 'Cold-start veil with clock, progress and verse.',
    },
    {
        displayName: 'SlopdogsKennelsScriptCinema',
        file: 'script-cinema.js',
        icon: '📜',
        description: 'Void cinema behind the iris and the error text.',
    },
    { displayName: 'SlopdogsKennelsScriptEmpty', file: 'script-empty.js', icon: '📜', description: 'The four empty states.' },
    {
        displayName: 'SlopdogsKennelsScriptRender',
        file: 'script-render.js',
        icon: '📜',
        description: 'Draws the state: rows and status line.',
    },
    { displayName: 'SlopdogsKennelsScriptEvents', file: 'script-events.js', icon: '📜', description: 'What a click or a key does.' },
    {
        displayName: 'SlopdogsKennelsScriptBoot',
        file: 'script-boot.js',
        icon: '📜',
        description: 'Wires the page and loads the first page.',
    },
    {
        displayName: 'SlopdogsKennelsStyles',
        file: 'styles.js',
        icon: '🧵',
        description: 'Joins the style dogs into one style text.',
        parents: STYLE_DOGS,
    },
    {
        displayName: 'SlopdogsKennelsScript',
        file: 'script.js',
        icon: '🧵',
        description: 'Joins copy, config, verses and the script dogs into one IIFE.',
        parents: ['SlopdogsKennelsCopy', 'SlopdogsKennelsConfig', 'SlopdogsKennelsVerses', ...SCRIPT_DOGS],
    },
    {
        displayName: 'SlopdogsKennelsLead',
        file: 'lead.js',
        icon: '🐕',
        description: 'Builds the /kennels document from styles, fragments and script.',
        parents: [
            'SlopdogsKennelsStyles',
            'SlopdogsKennelsTopBar',
            'SlopdogsKennelsToolbar',
            'SlopdogsKennelsStates',
            'SlopdogsKennelsChrome',
            'SlopdogsKennelsRowTemplate',
            'SlopdogsKennelsCreateSheet',
            'SlopdogsKennelsScript',
        ],
    },
];

/** Die Quellen: ts-node liest neben dieser Datei, dist/ (tsc kopiert keine .js-Quellen) liest im Repo. */
export class SlopdogsKennelsSource implements MaintainedSeedSource {
    static readonly DOGS: readonly KennelListDogSource[] = DOGS;

    private constructor(private readonly dir: string) {}

    static locate(): SlopdogsKennelsSource | null {
        const candidates = [
            path.join(__dirname, 'slopdogs-kennels'),
            path.join(__dirname, '..', '..', '..', 'seed-data', 'kennels', 'slopdogs-kennels'),
            path.join(process.cwd(), 'seed-data', 'kennels', 'slopdogs-kennels'),
        ];
        const dir = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'lead.js')));
        return dir ? new SlopdogsKennelsSource(dir) : null;
    }

    read(fileName: string): string {
        return fs.readFileSync(path.join(this.dir, fileName), 'utf8');
    }
}

/**
 * Die Kennel-Liste als Kennel (Spur K). Wie die Landing nur geseedet, wenn es den Kennel unter dieser ID noch nicht
 * gibt: steht er, bleibt er unberuehrt — Kennel und Dogs aendern Maintainer live (neue Versionen derselben
 * Lineages), ein Boot darf das nie ueberschreiben. Zuruecksetzen = Kennel loeschen (Maintainer) und neu starten;
 * die Dogs (oeffentlich, ohne Besitzer, gepflegt per LandingDogLock) tragen feste Lineages (MaintainedSeedDogs).
 * `kennelId` und `source` nur fuer Tests.
 */
export async function seedSlopdogsKennelsKennel(
    nodesStore: IStore,
    kennelsStore: IStore,
    kennelId: string = SLOPDOGS_KENNELS_KENNEL_ID,
    source: MaintainedSeedSource | null = SlopdogsKennelsSource.locate(),
): Promise<'seeded' | 'kept' | 'missing-source'> {
    if (await kennelExists(kennelsStore, kennelId)) return 'kept';
    if (!source) {
        console.warn(
            `[seed] ${kennelId}: Quellen (seed-data/kennels/slopdogs-kennels/) nicht gefunden — /kennels bleibt die Angular-Liste.`,
        );
        return 'missing-source';
    }
    const dogs = new MaintainedSeedDogs(nodesStore, kennelId, new SeedKeptDogs(kennelsStore));
    const lineageOf = new Map<string, string>();
    for (const dog of DOGS) {
        const parents = (dog.parents ?? []).map((name) => {
            const id = lineageOf.get(name);
            if (!id) throw new Error(`[seed] ${kennelId}: Parent ${name} von ${dog.displayName} steht nicht davor.`);
            return id;
        });
        const { lineageId } = await dogs.put({
            displayName: dog.displayName,
            theRun: source.read(dog.file),
            parentsRequired: parents,
            icon: dog.icon,
            description: dog.description,
        });
        lineageOf.set(dog.displayName, lineageId);
    }
    const lead = lineageOf.get('SlopdogsKennelsLead')!;
    const dogIds = [lead, ...DOGS.filter((d) => d.displayName !== 'SlopdogsKennelsLead').map((d) => lineageOf.get(d.displayName)!)];
    const now = new Date().toISOString();
    await kennelsStore.save({
        id: randomUUID(),
        type: 'KennelConfig',
        lineageId: kennelId,
        parentId: null,
        name: 'Kennels',
        description: 'The kennel list, served by SlopDogs itself at /kennels. Built from small dogs; maintainers change it live.',
        emoji: '🎛️',
        visibility: 'public',
        dogIds,
        nodes: JSON.stringify(DOGS.map((d) => ({ id: lineageOf.get(d.displayName), comment: d.description }))),
        task:
            '## Wunsch\nDie Kennel-Liste ist selbst ein Kennel: dieselben Funktionen wie die Angular-Liste, aus kleinen Dogs.\n\n' +
            '## Quelle\nseed-data/kennels/slopdogs-kennels/ (Seed nur, wenn der Kennel fehlt; Zuruecksetzen = Loeschen + Neustart); sonst leben Aenderungen als neue Dog-Versionen.\n\n' +
            '## Betrieb\nGET /kennels liefert die Lead-Ausgabe aus einem Memo (KennelListPage); faellt der Lauf aus, die Angular-Liste.',
        createdAt: now,
        updatedAt: now,
    });
    await dogs.settle();
    console.log(`✅ Seeded SlopDogs Kennel List Kennel (kennelId: ${kennelId}, ${DOGS.length} Dogs)`);
    return 'seeded';
}
