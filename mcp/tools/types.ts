// Shared tool types. Each tool has a JSON Schema for inputs (for MCP clients
// to introspect) and a handler that runs in the Express request context with
// access to the auth context.

import type { AuthCtx } from '../auth/middleware';
import type { KennelController } from '../../api/KennelController';
import type { Controller } from '../../api/Controller';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import type { IStore } from '../../store/IStore';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import type { KennelSnapshotCache } from '../snapshots/KennelSnapshotCache';
import type { KennelStatsService } from '../../services/KennelStatsService';
import type { KennelCallCounter } from '../../services/KennelCallCounter';
import type { DogStatsService } from '../../services/DogStatsService';
import type { KeyStoreService } from '../../services/KeyStoreService';

export interface BaseDogInfo {
    id: string;
    name: string;
    description: string;
    type: 'BaseDog';
    icon?: string;
    /**
     * Class names this dog needs / can use. Exactly the syntax build_kennel expects in
     * `dogs[].parentsRequired` / `parentsOptional` (bare names, no `base:` prefix).
     * Without these an agent can list the pack but never wire it.
     */
    parentsRequired?: string[];
    parentsOptional?: string[];
    /** True when this entry is a Pact -- a contract a MimicDog or a providing dog must fulfil. */
    isPact?: boolean;
    /** For Pacts: the demanded shape, when the pact declares one. */
    pactTypeDef?: string;
    /**
     * Binding instruction straight from the dog class (`static mcpGuidance`). Present only for
     * infrastructure dogs an agent must NOT re-implement — it travels with the dog so it cannot
     * drift out of sync with a separate document.
     */
    guidance?: string;
    /**
     * The package the dog comes from (`dogs-weather`, `core`) — read once at boot from the loaded
     * module graph (`BaseDogPacks`), the same value GET /api/nodes carries as `pack`.
     */
    pack?: string;
}

export interface ToolDeps {
    kennelsController: KennelController;
    nodesController: Controller<any>;
    kennelRunHandler: KennelRunHandler;
    /** Direct store access for ACL helpers (canMutateNode, etc.). */
    kennelsStore: IStore;
    nodesStore: IStore;
    /** Used by ACL tools to resolve user emails -> user IDs. */
    prisma: PrismaClient;
    baseDogsList: BaseDogInfo[];
    projectRoot: string;
    /** In-memory snapshot store for the inspection tools. Created inside createMcpRouter. */
    snapshotCache: KennelSnapshotCache;
    /** P4: `stats` an list_kennels und get_kennel. */
    kennelStats: KennelStatsService;
    /** P4: health_check meldet den Zaehlerstand (pending, dropped, lastFlushError). */
    callCounter: KennelCallCounter;
    /** P4b: `stats` an list_nodes/get_node, `usage` an get_node, dogStats in health_check. */
    dogStats: DogStatsService;
    /** P4c: set_key/list_keys/delete_key — derselbe Key-Store wie /api/keys. */
    keyStore: KeyStoreService;
}

export interface ToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

export interface ToolDef {
    name: string;
    description: string;
    inputSchema: Record<string, any>; // JSON Schema (object)
    /**
     * Bekannte Fehlnamen auf oberster Ebene -> der richtige Name (`dogIds` -> `extraDogIds` bei build_kennel).
     * Nur fuer den Vorschlag in der Ablehnung; die Ablehnung selbst folgt dem Schema.
     */
    argHints?: Record<string, string>;
    handler: (args: Record<string, any>, ctx: AuthCtx, deps: ToolDeps) => Promise<ToolResult>;
}

/** Ein Feld, das das Eingabeschema nicht kennt — mit Pfad (`dogs[0].code`) und, wo naheliegend, dem gemeinten Namen. */
export interface UnknownArg {
    path: string;
    field: string;
    suggestion?: string;
    allowed: string[];
}

/** Editierdistanz, gedeckelt: mehr als `max` interessiert nicht. */
function editDistance(a: string, b: string, max: number): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = row;
    }
    return prev[b.length];
}

/**
 * Der naheliegende Name fuer ein unbekanntes Feld: gleich bis auf Gross-/Kleinschreibung, ein bekannter Name,
 * der den falschen enthaelt (`dogIds` in `extraDogIds`) oder umgekehrt, sonst wenige Tippfehler entfernt.
 */
function nearestField(field: string, allowed: string[]): string | undefined {
    const lower = field.toLowerCase();
    const exact = allowed.find((a) => a.toLowerCase() === lower);
    if (exact) return exact;
    if (lower.length >= 3) {
        const contained = allowed.find((a) => a.toLowerCase().includes(lower) || (a.length >= 3 && lower.includes(a.toLowerCase())));
        if (contained) return contained;
    }
    // Kurze Namen vertragen weniger: `foo` ist nicht `von`.
    const max = Math.min(2, Math.max(1, Math.floor(lower.length / 3)));
    let best: string | undefined;
    let bestDistance = max + 1;
    for (const a of allowed) {
        const d = editDistance(lower, a.toLowerCase(), max);
        if (d < bestDistance) {
            best = a;
            bestDistance = d;
        }
    }
    return best;
}

/**
 * Alle Felder in `value`, die `schema` mit `additionalProperties: false` nicht kennt — rekursiv durch
 * `properties`, Array-`items` und Objekt-Schemas in `additionalProperties`. Typfehler sind nicht Sache
 * dieser Pruefung; sie sucht nur Namen, die stillschweigend verloren gingen.
 */
export function findUnknownArgs(
    schema: Record<string, any> | undefined,
    value: unknown,
    hints: Record<string, string> = {},
    path = '',
): UnknownArg[] {
    if (!schema || typeof schema !== 'object' || value === null || value === undefined) return [];
    if (Array.isArray(value)) {
        const items = schema.items;
        if (!items || typeof items !== 'object') return [];
        return value.flatMap((item, i) => findUnknownArgs(items, item, {}, `${path}[${i}]`));
    }
    if (typeof value !== 'object') return [];
    const properties: Record<string, any> = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const allowed = Object.keys(properties);
    const out: UnknownArg[] = [];
    for (const [field, inner] of Object.entries(value as Record<string, unknown>)) {
        const at = path ? `${path}.${field}` : field;
        if (field in properties) {
            out.push(...findUnknownArgs(properties[field], inner, {}, at));
        } else if (schema.additionalProperties === false) {
            const hinted = hints[field];
            const suggestion = hinted && allowed.includes(hinted) ? hinted : nearestField(field, allowed);
            out.push({ path: at, field, allowed, ...(suggestion ? { suggestion } : {}) });
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
            out.push(...findUnknownArgs(schema.additionalProperties, inner, {}, at));
        }
    }
    return out;
}

/**
 * Die Ablehnung eines Aufrufs mit unbekannten Feldern, oder null. Frueher ging ein falscher Name (`dogIds` statt
 * `extraDogIds` bei build_kennel) stillschweigend verloren — der Kennel entstand ohne das Gemeinte, und niemand
 * sagte es. MCP und /actions pruefen jeden Aufruf hiermit, bevor das Werkzeug laeuft.
 */
export function unknownArgsRefusal(tool: ToolDef, args: unknown): { message: string; unknown: UnknownArg[] } | null {
    const unknown = findUnknownArgs(tool.inputSchema, args ?? {}, tool.argHints ?? {});
    if (unknown.length === 0) return null;
    const parts = unknown.map((u) => `"${u.path}"${u.suggestion ? ` (did you mean "${u.suggestion}"?)` : ''}`);
    const first = unknown[0];
    const parent = first.path.slice(0, first.path.length - first.field.length).replace(/\.$/, '');
    const message = `Unknown argument${unknown.length > 1 ? 's' : ''} for ${tool.name}: ${parts.join(', ')}. `
        + `Allowed${parent ? ` in ${parent}` : ''}: ${first.allowed.join(', ')}. `
        + 'Nothing was run — fix the call and send it again.';
    return { message, unknown };
}

export function ok(payload: unknown): ToolResult {
    // JSON.stringify(undefined) ist undefined — ein Textblock ohne Text verletzt das MCP-Schema.
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    return {
        content: [
            {
                type: 'text',
                text: text ?? 'null',
            },
        ],
    };
}

export function fail(message: string): ToolResult {
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
    };
}

/**
 * Resolve tsCode-or-tsCodeBase64 into the raw TypeScript source string.
 *
 * Welle 11: many MCP clients have to escape backticks, newlines, quotes and
 * template literals into a JSON string. PowerShell's ConvertTo-Json mangles
 * common dog-code shapes; long template literals turn quoting into a horror.
 * The base64 alternative lets a client pass `Buffer.from(tsCode).toString('base64')`
 * and skip the escape gauntlet entirely.
 *
 * Contract:
 * - Provide exactly one of `tsCode` (raw string) or `tsCodeBase64` (utf8-encoded base64).
 * - Both → error.
 * - Neither → error (when tsCode is required by the tool).
 */
/**
 * Waechter gegen die zwei Selbstbau-Fallen. Bewusst SEHR eng gefasst — eine Warnung, die
 * auf korrektem Code losgeht, bringt nur bei, Warnungen zu ignorieren.
 *
 * Der Renderer-Dog DARF `new WebSocket(wsUrl)` in das HTML schreiben, das er ausliefert —
 * die Seite im Browser muss den Socket ja oeffnen. Falsch ist es erst, wenn dabei KEIN
 * WebSocketChannelRetriever verdrahtet ist: dann hat sich der Agent seine eigene Lobby
 * gebaut, statt die vorhandene zu nehmen. Genau darauf und auf nichts anderes wird geprueft.
 */
/**
 * Ab wann ein Dog zu gross ist. Erfahrungswerte aus echten Bauten: unter ~4000 Zeichen
 * macht ein Dog verlaesslich eine benennbare Sache; darueber sind es fast immer mehrere,
 * und ab ~8000 wird jeder Fehler zum Totalschaden -- ein einziges falsches Zeichen toetet
 * die ganze Ausgabe, und jede Korrektur heisst "den ganzen Block neu erzeugen".
 */
const DOG_GROSS = 4000;
const DOG_ZU_GROSS = 8000;

/**
 * Welche Zustaendigkeiten in einem Dog stecken.
 *
 * Kein Parser, sondern grobe Spuren -- aber sie genuegen fuer die Frage, die zaehlt: haelt
 * dieser Dog EINEN Zweck, oder sind mehrere Klassen darin verklebt? Ein realer Fall aus der
 * Praxis: ein Dog mit 5508 Zeichen und 14 Funktionen trug Socket, Spielregeln, Rendering,
 * Rollenlogik und einen Timer -- unter jeder Groessenschwelle unauffaellig und trotzdem
 * fuenf Dogs. Nur starke, eindeutige Marker, damit sauberer Code nicht angemeckert wird.
 */
function erkannteZustaendigkeiten(code: string): string[] {
    const treffer = (rx: RegExp) => (code.match(rx) || []).length;
    const bereiche: Array<[string, number, number]> = [
        ['Netz/Kanal', treffer(/new\s+WebSocket|"join"|"patch"|"peer-|\bwss?:\/\//g), 1],
        ['Persistenz', treffer(/jsonStore\s*\./g), 1],
        ['Ansicht/DOM', treffer(/getElementById|querySelector|innerHTML|createElement|addEventListener/g), 2],
        ['Markup-Bau', treffer(/["'`]<(div|html|button|span|section|canvas|svg)\b/g), 3],
        ['Zeit/Takt', treffer(/setInterval|setTimeout|requestAnimationFrame/g), 1],
        ['Spielstand/Regeln', treffer(/\b(score|punkte|runde|round|gewinn|winner|sieger)\b/gi), 3],
    ];
    return bereiche.filter(([, n, min]) => n >= min).map(([name]) => name);
}

export function codeHinweise(
    tsCode: unknown,
    parents: { parentsRequired?: unknown; parentsOptional?: unknown },
): string[] {
    if (typeof tsCode !== 'string' || tsCode.length === 0) return [];
    const out: string[] = [];

    // Zustaendigkeiten zuerst -- das ist das eigentliche Mass. Die Zeichenzahl ist nur ein
    // Symptom: ein Dog von 5500 Zeichen kann sauber sein, und einer von 2000 kann drei Klassen
    // enthalten. Was zaehlt, ist ob er EINE Frage beantwortet.
    const bereiche = erkannteZustaendigkeiten(tsCode);
    if (bereiche.length >= 3 || (bereiche.length === 2 && tsCode.length >= 2500)) {
        out.push(
            `Dieser Dog beantwortet mehrere Fragen: ${bereiche.join(', ')}. `
            + 'Ein Dog ist wie eine Klasse -- zusammengehoerige Funktionen um EINEN Zweck. Mehrere '
            + 'Funktionsgruppen ohne gemeinsamen Zweck sind mehrere Klassen in einer Datei, und '
            + 'genau das sind hier mehrere Dogs. Trenn nach Zustaendigkeit, nicht nach Dateityp: '
            + 'Markup hierhin und Script dorthin verschiebt nur Zeichen. '
            + 'Die Probe: sag in EINEM Satz, was dieser Dog beantwortet. Gelingt es nicht, teile ihn.',
        );
    }

    // Groesse als zweites -- ein Symptom, kein Mass.
    if (tsCode.length >= DOG_GROSS) {
        const dringend = tsCode.length >= DOG_ZU_GROSS;
        out.push(
            `Dieser Dog ist ${tsCode.length} Zeichen gross${dringend ? ' -- das ist zu viel' : ''}. `
            + 'Ein Dog tut EINE benennbare Sache; ab dieser Groesse sind es fast immer mehrere. '
            + 'Teile ihn auf: HTML-Fragmente (Kopf, Liste, Legende), der Script-Block, die '
            + 'Datenaufbereitung und das Zusammensetzen sind je ein eigener Dog -- der Lead setzt sie '
            + 'zusammen. Das ist keine Kosmetik: in einem grossen Dog toetet ein einziges falsches '
            + 'Zeichen die ganze Ausgabe, du kannst die Beute der Teile nicht einzeln ansehen, und '
            + 'jede Korrektur bedeutet, den kompletten Block neu zu erzeugen.'
            + (dringend ? ' Bei dieser Groesse: aufteilen, bevor du weitermachst.' : ''),
        );
    }

    const parentNames = [
        ...(Array.isArray(parents.parentsRequired) ? parents.parentsRequired : []),
        ...(Array.isArray(parents.parentsOptional) ? parents.parentsOptional : []),
    ]
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.replace(/^base:/, '').replace(/^@/, ''));
    const hasLobby = parentNames.includes('WebSocketChannelRetriever');

    const usesSocket = /new\s+WebSocket\s*\(/.test(tsCode) || /\bwss?:\/\//.test(tsCode);
    if (usesSocket && !hasLobby) {
        out.push(
            'Dieser Dog benutzt einen WebSocket, hat aber keinen WebSocketChannelRetriever als Parent — '
            + 'du baust dir gerade eine eigene Lobby. Nimm die vorhandene: '
            + 'extraDogIds: ["base:WebSocketChannelRetriever", "base:QueryRetriever"] (MIT base:) und '
            + 'parentsRequired: ["WebSocketChannelRetriever"] (OHNE base:). '
            + 'Sie liefert channelId, wsUrl, heartbeatSec, peers, channelParam und channelQuery — erfinde keine eigene Adresse und keinen eigenen room-Parameter. '
            + 'Den Teilen-Link baut die Seite selbst aus location.origin + location.pathname + channelQuery.',
        );
    }

    if (/require\s*\(\s*['"]fs['"]\s*\)/.test(tsCode) || /\bfs\.(writeFile|readFile|appendFile)/.test(tsCode)) {
        out.push(
            'Dateisystem-Zugriff im Dog-Code — der VM-Sandkasten hat keins. '
            + 'Fuer Zustand und Caches steht `jsonStore` global bereit (get/set/delete/has/list/snapshot, alle async).',
        );
    }

    return out;
}

export function resolveTsCode(args: { tsCode?: unknown; tsCodeBase64?: unknown }): string {
    const hasRaw = typeof args.tsCode === 'string';
    const hasB64 = typeof args.tsCodeBase64 === 'string';
    if (hasRaw && hasB64) {
        throw new Error('Provide either tsCode or tsCodeBase64, not both');
    }
    if (hasB64) {
        try {
            return Buffer.from(args.tsCodeBase64 as string, 'base64').toString('utf8');
        } catch (e: any) {
            throw new Error('tsCodeBase64 decode failed: ' + (e?.message ?? String(e)));
        }
    }
    if (hasRaw) return args.tsCode as string;
    throw new Error('tsCode or tsCodeBase64 required');
}
