/**
 * Erkennung des Lead-Ergebnisformats für String-Yields (execute / öffentliche URLs).
 * Muss mit der UI (Monaco / neues Fenster) übereinstimmen — siehe
 * ui-app/src/app/utils/lead-result-string-format.ts
 */

/** True, wenn der String als HTML-Lead ausgeliefert werden soll (text/html). */
export function isHtmlResultString(s: string): boolean {
    const t = s.trim();
    return (
        t.startsWith('<html') ||
        t.startsWith('<!DOCTYPE') ||
        t.startsWith('<!doctype') ||
        (t.startsWith('<') && t.includes('</'))
    );
}

/**
 * True, wenn der String als Markdown-Lead ausgeliefert werden soll (text/markdown).
 * Nicht HTML; erste Zeile ATX-Überschrift (# … ######) oder YAML-Frontmatter --- … ---.
 */
export function isMarkdownResultString(s: string): boolean {
    if (isHtmlResultString(s)) return false;
    const t = s.trim();
    if (t.startsWith('---')) {
        if (/^---\r?\n[\s\S]*?\r?\n---/.test(t)) return true;
    }
    const firstLine = t.split(/\r?\n/)[0] ?? '';
    return /^#{1,6}\s/.test(firstLine);
}
