/**
 * Compact Spuren rules for MCP initialize + kennel tool schemas.
 * Keep in sync with mcp/skill.md § „Agenten-Anweisung (kurz)“.
 */

/** Injected at MCP `initialize` — every agent sees this without reading the full skill resource. */
export const SPUREN_AGENTEN_ANWEISUNG_KURZ = `## Spuren — Agenten-Pflicht (kurz)

Nach jeder Pack-Änderung (\`build_kennel\`, \`create_kennel\`, \`update_kennel\`), bevor du „fertig“ meldest: \`task\` + \`nodes[]\` persistieren. **Wunsch festhalten, nicht Vertrag** — JSON-Shape lebt im Code.

### task — vier grobe Blöcke (Markdown)
## Wunsch
<Was will der User?>
## Was wir nicht wissen
<Was offen bleibt — z.B. welche Orte genau>
## Was wir dafür brauchen
<z.B. einen Ort>
## Entscheidungen (grob)
<z.B. Wiki, weil … — eine Zeile pro Wahl>

### nodes[] — eine Zeile pro Hund
Jeder Eintrag in \`dogIds\`: \`{ id, comment }\` — ein Satz, warum dieser Hund für den Wunsch (nicht JSON-Vertrag). Optional \`edges[]\` nur wenn die Wunsch-Kette sonst unklar wäre.

### Eigenes Produkt — Bundle-Export
Wenn der MCP dein Projekt trägt: nach Pack-Änderungen genutzte Pens per \`GET /api/kennels/:id/export\` als JSON ins Repo legen. Import kann \`kennelId\` umbenennen (\`-copy\`) und neue Dog-\`lineageIds\` vergeben — \`kennelId\`/\`idMap\` aus Import-Response lesen, nicht blind aus alter Session. Vollständig: \`mcp/skill.md\` § Eigenes Projekt.`;

export const SPUREN_TASK_FIELD_HINT =
    'User-Wunsch + grobe Lage (Markdown, vier Blöcke: ## Wunsch / ## Was wir nicht wissen / ## Was wir dafür brauchen / ## Entscheidungen (grob)). Kein Query-/JSON-Vertrag — der steht im Code.';

export const SPUREN_NODES_FIELD_HINT =
    'Pro dogIds-Eintrag ein kurzer comment — ein Satz, warum dieser Hund für den Wunsch (nicht JSON-Vertrag).';

export function buildMcpInitializeInstructions(hasFullSkill: boolean, werkzeugkasten?: string): string {
    const tail = hasFullSkill
        ? '\n\n---\nVollständiger MCP-Guide (Ton, Workflows, Sandbox, Beispiele): Resource `slopdogs://skill`.'
        : '';
    // Der Werkzeugkasten steht VOR der Spuren-Pflicht: er wird gebraucht, bevor gebaut wird,
    // die Spuren erst danach.
    const kasten = typeof werkzeugkasten === 'string' && werkzeugkasten.length > 0
        ? werkzeugkasten + '\n\n---\n\n'
        : '';
    return kasten + SPUREN_AGENTEN_ANWEISUNG_KURZ + tail;
}
