/**
 * A dog name that fits a 128 px card without losing what tells siblings apart (P6 U5, U3 follow-up):
 * `SlopdogsLandingSkinA` and `SlopdogsLandingSkinB` both ended as `SlopdogsLandi…`. Siblings differ at
 * the end, so when the last words fit, the ellipsis goes in the middle and they stay whole —
 * `Slo…SkinA`, `S…Content`. When even the last word is too long (`QueryRetriever`), the head is the
 * better handle and the name is cut at the end. Words are camel humps, spaces, `-`, `_` and `.`;
 * the full name stays in the title.
 */
export function shortDogLabel(name: string, max = 9): string {
  const text = name.trim();
  if (text.length <= max) return text;
  const words = text.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])|[^A-Za-z0-9]+/g) ?? [text];
  const room = max - 2; // at least one character of the head, and the ellipsis
  let tail = '';
  for (let i = words.length - 1; i >= 0; i--) {
    const next = words[i] + tail;
    if (next.length > room) break;
    tail = next;
  }
  tail = tail.replace(/^[\s\-_.]+/, '');
  if (!tail) return `${text.slice(0, max - 1).replace(/[\s\-_.]+$/, '')}…`;
  const head = text.slice(0, max - 1 - tail.length).replace(/[\s\-_.]+$/, '');
  return `${head || text[0]}…${tail}`;
}
