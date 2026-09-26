/**
 * Spiegelt services/leadResultStringFormat.ts — bei Änderungen beide Dateien pflegen.
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
