/** True when a key press belongs to a field — typing a `?` or `/` into a search must stay a character. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.closest('.monaco-editor');
}

/** Ctrl on Windows and Linux, ⌘ on a Mac — the modifier of the page keys (6.4 S2). */
export function hasModifier(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey;
}

/** The label of that modifier in the shortcut help. */
export const MODIFIER_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
