import { isHtmlResultString, isMarkdownResultString } from './stringFormat';
import type { OpenApiGrimoire, Rune, SwaggridCast } from './types';

function inferEssence(value: unknown): Record<string, unknown> {
    if (value === null || value === undefined) return {};
    if (Array.isArray(value)) {
        return { type: 'array', items: value.length > 0 ? inferEssence(value[0]) : {} };
    }
    if (typeof value === 'object') {
        const properties: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            properties[k] = inferEssence(v);
        }
        return { type: 'object', properties };
    }
    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? { type: 'integer', example: value }
            : { type: 'number', example: value };
    }
    if (typeof value === 'boolean') return { type: 'boolean', example: value };
    return { type: 'string', example: value };
}

function hasMeaningfulOffering(body: unknown): boolean {
    if (body == null) return false;
    if (Array.isArray(body)) return body.length > 0;
    if (typeof body === 'object') return Object.keys(body as object).length > 0;
    return true;
}

function findHerald(heraldId: string, strata: Rune[][]): Rune | null {
    if (!heraldId) return null;
    const searchId = heraldId.startsWith('base:') ? heraldId.substring(5) : heraldId;

    for (const stratum of strata) {
        for (const rune of stratum) {
            const lineage = rune.lineageId;
            if (
                rune.id === searchId ||
                rune.id === heraldId ||
                rune.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '') ||
                (lineage != null && (lineage === heraldId || lineage === searchId))
            ) {
                return rune;
            }
        }
    }
    return null;
}

function buildResponseContent(herald: Rune | null): Record<string, unknown> {
    const r = herald?.essence;
    if (typeof r === 'string' && isHtmlResultString(r)) {
        return {
            'text/html': { schema: { type: 'string', example: '<html>…</html>' } },
        };
    }
    if (typeof r === 'string' && isMarkdownResultString(r)) {
        return {
            'text/markdown': {
                schema: { type: 'string', example: '# Ergebnis\n\n…' },
            },
        };
    }
    return {
        'application/json': { schema: { $ref: '#/components/schemas/Response' } },
    };
}

/** Kurzbeschreibung des Knotentyps für Menschen, nicht interne Klassennamen. */
function knotenartLabel(bound?: boolean): string {
    return bound ? 'Hund mit eigenem Code (aus der Bibliothek)' : 'Eingebauter Basis-Hund';
}

/** Liste: welche Knoten in welcher Ausführungswelle liefen (letzter Probelauf). */
function buildWellenUebersicht(strata: Rune[][]): string[] {
    const lines: string[] = [];
    strata.forEach((stratum, si) => {
        for (const knoten of stratum) {
            const icon = knoten.sigil ? `${knoten.sigil} ` : '';
            lines.push(
                `- **Welle ${si + 1}:** ${icon}**${knoten.name}** — ${knotenartLabel(knoten.bound)}`,
            );
        }
    });
    return lines;
}

function buildLeadKnotenBlock(herald: Rune): string {
    const zeilen = [
        '**Lead-Knoten** (sein Ergebnis ist die HTTP-Antwort dieses Endpunkts):',
        `- Anzeigename: **${herald.name}**`,
        `- Instanz-ID: \`${herald.id}\``,
    ];
    if (herald.lineageId) {
        zeilen.push(
            `- Lineage-ID: \`${herald.lineageId}\` (fester Verweis auf dieselbe Hundes-Linie, unabhängig von der Version)`,
        );
    }
    return zeilen.join('\n');
}

function buildQueryParams(whispers?: Record<string, string>): unknown[] {
    if (!whispers) return [];
    return Object.entries(whispers).map(([key, value]) => ({
        name: key,
        in: 'query' as const,
        required: false,
        schema: { type: 'string', default: value },
        description: `Default: "${value}"`,
    }));
}

function safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9]/g, '_');
}

function safeSchemaName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Baut eine OpenAPI-3.0.3-Spezifikation aus einem Cast: ein öffentlicher Pfad pro Kennel,
 * Response-Schema aus dem zuletzt beobachteten Lead-Ergebnis.
 */
export function castGrimoire(input: SwaggridCast): OpenApiGrimoire {
    const { rift, publicPath, title, scroll, heraldId, whispers, offering, strata } = input;
    const riftTitle = title || rift;
    const herald = findHerald(heraldId, strata);

    const responseSchema =
        herald?.essence != null
            ? inferEssence(herald.essence)
            : { description: 'Kein Ausführungsergebnis für den Lead-Knoten verfügbar' };

    const wellenZeilen = buildWellenUebersicht(strata);
    const einleitung =
        scroll ||
        `Öffentlicher Kennel-Endpunkt unter \`${publicPath}\` („${riftTitle}“). Diese Doku stammt von einem Probelauf mit den aktuellen Standard-Query-Parametern und dem Standard-Body.`;
    const wellenBlock =
        wellenZeilen.length > 0
            ? [
                  '**Ausführungsübersicht** (Wellen nacheinander; innerhalb einer Welle können Knoten parallel laufen — wie beim letzten Lauf erfasst):',
                  ...wellenZeilen,
              ].join('\n')
            : '';
    const bloecke = [einleitung, wellenBlock, herald ? buildLeadKnotenBlock(herald) : ''].filter(
        (b) => b.length > 0,
    );
    const description = bloecke.join('\n\n');

    const queryParams = buildQueryParams(whispers);
    const meaningfulBody = hasMeaningfulOffering(offering);

    const schemas: Record<string, unknown> = {
        Response: {
            ...responseSchema,
            description: `JSON-Antwort: Rückgabewert des Lead-Knotens „${herald?.name || '(unbekannt)'}“`,
            ...(herald?.essence != null ? { example: herald.essence } : {}),
        },
    };

    if (meaningfulBody) {
        schemas.RequestBody = {
            ...inferEssence(offering),
            description: 'JSON-Body für den BodyRetriever (Standardwerte siehe Beispiel)',
            example: offering,
        };
    }

    for (const stratum of strata) {
        for (const glyph of stratum) {
            if (glyph.essence != null && glyph !== herald) {
                const schemaName = safeSchemaName(glyph.name);
                schemas[schemaName] = {
                    ...inferEssence(glyph.essence),
                    description: `Zwischenergebnis des Knotens „${glyph.name}“ (Instanz-ID \`${glyph.id}\`)`,
                    example: glyph.essence,
                };
            }
        }
    }

    const getOp: Record<string, unknown> = {
        summary: riftTitle,
        description:
            'Führt das Kennel aus (GET) und gibt das Ergebnis des Lead-Knotens zurück — das ist der erste Eintrag in `dogIds` der Kennel-Konfiguration.',
        operationId: `get_${safeId(rift)}`,
        parameters: [...queryParams],
        responses: {
            '200': {
                description: `OK — Ergebnis des Lead-Knotens (${herald?.name || 'Lead nicht ermittelbar'})`,
                content: buildResponseContent(herald),
            },
            '404': { description: 'Kennel nicht gefunden' },
            '500': { description: 'Fehler bei der Ausführung des Kennels' },
        },
    };

    const postOp: Record<string, unknown> = {
        summary: `${riftTitle} (POST mit Body)`,
        description:
            'Führt das Kennel mit JSON-Body aus (POST). Der Standard-Body aus der Konfiguration dient in dieser Doku als Schema und Beispiel; der BodyRetriever liefert ihn dem Pack zur Laufzeit.',
        operationId: `post_${safeId(rift)}`,
        parameters: [...queryParams],
        requestBody: {
            required: true,
            description: 'JSON-Body für den BodyRetriever (Standardwerte siehe Beispiel)',
            content: {
                'application/json': {
                    schema: { $ref: '#/components/schemas/RequestBody' },
                    example: offering,
                },
            },
        },
        responses: {
            '200': {
                description: `OK — Ergebnis des Lead-Knotens (${herald?.name || 'Lead nicht ermittelbar'})`,
                content: buildResponseContent(herald),
            },
            '404': { description: 'Kennel nicht gefunden' },
            '500': { description: 'Fehler bei der Ausführung des Kennels' },
        },
    };

    const pathMethods: Record<string, unknown> = {};
    if (meaningfulBody) {
        pathMethods.post = postOp;
    } else {
        pathMethods.get = getOp;
    }

    return {
        openapi: '3.0.3',
        info: {
            title: `${riftTitle} API`,
            description,
            version: '0.1.0-alpha.1',
        },
        servers: [{ url: '', description: 'SlopDogs-Server (Basis-URL je nach Umgebung)' }],
        paths: {
            [publicPath]: pathMethods,
        },
        components: { schemas },
    };
}
