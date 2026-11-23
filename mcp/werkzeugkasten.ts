/**
 * Der Werkzeugkasten-Brief — was schon existiert, bevor ein Agent anfaengt zu bauen.
 *
 * Warum das in `initialize` gehoert und nicht in eine Doku-Datei: `initialize` ist der
 * EINZIGE Kanal, den jeder MCP-Client ungefragt sieht. Die Resource `slopdogs://skill`
 * muss ein Agent aktiv holen — viele tun es nie, und genau deshalb sind VM-Globals wie
 * `jsonStore` und Infrastruktur-Dogs wie die Lobby bisher unentdeckt geblieben. Wer
 * nichts findet, baut sich selbst einen WebSocket.
 *
 * Der Text wird aus dem Code erzeugt, nicht von Hand gepflegt: die Globals kommen aus
 * der VM-Capability-Registry, die Infrastruktur-Anweisungen aus `static mcpGuidance` an
 * den Dog-Klassen. Eine neue Faehigkeit ist damit automatisch eine angekuendigte.
 */
import { listVmGlobalCapabilities } from '@martinschmieschek/slopdogs-core/runtime';
import type { BaseDogInfo } from './tools/types';

export function buildWerkzeugkasten(baseDogsList: BaseDogInfo[]): string {
    const globals = listVmGlobalCapabilities();
    const infra = (baseDogsList ?? []).filter((b) => typeof b.guidance === 'string' && b.guidance.length > 0);
    if (globals.length === 0 && infra.length === 0) return '';

    const lines: string[] = ['## Werkzeugkasten — das gibt es schon, bau es NICHT nach', ''];

    if (globals.length > 0) {
        lines.push('### Im Dog-Code global verfuegbar (neben `fetch` und `console`)');
        for (const g of globals) {
            lines.push(`- ${g.doc ? g.doc : '`' + g.name + '`'}`);
        }
        lines.push('');
    }

    if (infra.length > 0) {
        lines.push('### Infrastruktur-Dogs — nimm sie, statt ihre Aufgabe selbst zu loesen');
        for (const d of infra) {
            lines.push(`- **${d.name}** — ${d.description}`);
            lines.push(`  ${d.guidance}`);
        }
        lines.push('');
    }

    lines.push(
        '### Ein Dog bleibt klein',
        'Ein Dog tut EINE benennbare Sache. Kannst du nicht in einem Satz sagen, was er liefert, sind es zwei Dogs. ' +
            'Baue niemals alles in einen grossen Dog: HTML-Fragmente, der Script-Block, die Datenaufbereitung und das ' +
            'Zusammensetzen gehoeren getrennt, der Lead fuegt sie zusammen. In einem grossen Dog toetet ein einziges ' +
            'falsches Zeichen die ganze Ausgabe, die Teile lassen sich nicht einzeln pruefen, und jede Korrektur heisst ' +
            '"den kompletten Block neu erzeugen". Der Dienst sagt dir in seiner Antwort, wenn ein Dog zu gross geworden ist.',
        '',
    );
    lines.push(
        '### Kosten: Base-Dogs vor eigenen Dogs, ein Kennel statt vieler',
        '- **Base-Dogs sind guenstig.** Sie laufen direkt im Dienst und cachen ihre Quelle serverseitig fuer alle Nutzer ' +
            '(z. B. Open-Meteo je 1-km-Zelle, Regenradar je Kachel und Radarlauf). Eigene Dogs laufen in der Sandbox: jeder kostet ' +
            'je Welle spuerbar Laufzeit und Speicher und hat keinen Zugang zu diesem Cache.',
        '- **Jeder Kennel-Lauf zaehlt** gegen das Laufkontingent des Aufrufers, auch wenn alle Daten darunter schon gecacht sind. ' +
            'Zehn kleine Kennels nacheinander abzufragen kostet zehn Laeufe.',
        '- **Orchestrierung ist deshalb die Kernaufgabe:** Buendle, was ein Abnehmer zusammen braucht, in EINEN Kennel aus Base-Dogs, ' +
            'Pact-Mimics und einem schlanken Lead. Eigene Dogs nur als Klebstoff (Parameter pruefen, zusammensetzen, darstellen), ' +
            'nie fuer Daten, die ein Base-Dog schon liefert, und kein eigenes `fetch` auf eine Quelle, die ein Base-Dog abdeckt.',
        '- **Breit statt tief:** Unabhaengige Base-Dogs stehen in derselben Welle und laufen parallel. Jedes Glied einer Kette ' +
            'aus eigenen Dogs verlaengert den Lauf um eine Welle.',
        '',
    );
    lines.push(
        'Alles Weitere: `list_nodes` fragen — dort steht zu jedem Eintrag die `description`, ' +
            'der Vertrag `parentsRequired`/`parentsOptional` (blanke Klassennamen, genau die Syntax von `build_kennel`) ' +
            'und bei Pacts (`isPact: true`) die geforderte Form. Suche dort nach Stichworten statt zu raten; ' +
            'ein Pact wird nie direkt gerufen, sondern per MimicDog (`dogs[].imitates`) oder einem liefernden Dog erfuellt. ' +
            "Sortiere mit `sort:'proven'` — bewaehrte Dogs zuerst; baue keinen Dog neu, den `list_nodes {search}` schon bewaehrt liefert.",
        '',
    );
    lines.push(
        '### Wiederverwenden vor Schreiben (feste Regel)',
        "Fuer jeden Teil, den du bauen willst, ZUERST `list_nodes {search:'<Stichwort>', sort:'proven'}`. " +
            'Gibt es einen passenden, zuverlaessigen Dog (Abzeichen `stats.proven.badge` oder `stats.proven.reliability >= 0.8`), ' +
            'nimm ihn ueber seine lineageId (`parentsRequired`, `extraDogIds`) und schreibe nur, was fehlt. ' +
            '`build_kennel` meldet in `hints[]`, wenn ein neuer Dog einem bewaehrten gleicht, den du ausfuehren darfst — mit dessen lineageId; ' +
            'es ist ein Rat, nichts wird blockiert.',
    );

    return lines.join('\n');
}
