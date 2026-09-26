/**
 * Erkennung von HTML- vs. Markdown-Strings für text/html bzw. text/markdown in OpenAPI.
 * (Analog zur SlopDogs-App: leadResultStringFormat.)
 */

export function isHtmlResultString(s: string): boolean {
    const t = s.trim();
    return (
        t.startsWith('<html') ||
        t.startsWith('<!DOCTYPE') ||
        t.startsWith('<!doctype') ||
        (t.startsWith('<') && t.includes('</'))
    );
}

export function isMarkdownResultString(s: string): boolean {
    if (isHtmlResultString(s)) return false;
    const t = s.trim();
    if (t.startsWith('---')) {
        if (/^---\r?\n[\s\S]*?\r?\n---/.test(t)) return true;
    }
    const firstLine = t.split(/\r?\n/)[0] ?? '';
    return /^#{1,6}\s/.test(firstLine);
}
