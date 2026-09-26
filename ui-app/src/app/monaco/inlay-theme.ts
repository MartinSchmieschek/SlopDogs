/**
 * Monaco theme "inlay" (PLAN P6 6.2): the editor sits on the same paper as the rest of the app.
 * Monaco themes are JS, not CSS — the colours are the token values from styles.scss, spelled out,
 * because Monaco does not read custom properties.
 */

export const INLAY_THEME = 'inlay';

const PAPER_2 = 'f7f0da';
const PAPER_3 = 'e6dbb8';
const INK = '1b1712';
const INK_3 = '9c917a';
const LIVE_INK = '0d6666';
const WARN_INK = '8a5a00';
const DANGER_INK = 'b3261e';

/** Editor options every Monaco instance in the app shares: Courier Prime 13/20, 2 px ink cursor, no ligatures. */
export const INLAY_EDITOR_OPTIONS = {
  theme: INLAY_THEME,
  fontFamily: "'Courier Prime', ui-monospace, monospace",
  fontSize: 13,
  lineHeight: 20,
  fontLigatures: false,
  cursorWidth: 2,
} as const;

/** Monaco instances that already know the theme (the AMD namespace object is not extensible). */
const registered = new WeakSet<object>();

/** Registers the theme once per Monaco instance; safe to call repeatedly. */
export function registerInlayTheme(monaco: any): void {
  if (!monaco?.editor?.defineTheme || registered.has(monaco)) return;
  monaco.editor.defineTheme(INLAY_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: INK, background: PAPER_2 },
      { token: 'comment', foreground: INK_3, fontStyle: 'italic' },
      { token: 'keyword', foreground: INK, fontStyle: 'bold' },
      { token: 'keyword.json', foreground: INK, fontStyle: 'bold' },
      { token: 'string', foreground: LIVE_INK },
      { token: 'string.key.json', foreground: INK },
      { token: 'string.value.json', foreground: LIVE_INK },
      { token: 'number', foreground: WARN_INK },
      { token: 'regexp', foreground: LIVE_INK },
      { token: 'type', foreground: INK },
      { token: 'identifier', foreground: INK },
      { token: 'delimiter', foreground: INK },
      { token: 'invalid', foreground: DANGER_INK },
    ],
    colors: {
      'editor.background': `#${PAPER_2}`,
      'editor.foreground': `#${INK}`,
      'editorLineNumber.foreground': `#${INK_3}`,
      'editorLineNumber.activeForeground': `#${INK}`,
      'editor.lineHighlightBackground': `#${PAPER_3}`,
      'editor.lineHighlightBorder': `#${PAPER_3}`,
      'editor.selectionBackground': '#ff6a0029',
      'editor.inactiveSelectionBackground': '#ff6a0018',
      'editorCursor.foreground': `#${INK}`,
      'editorError.foreground': `#${DANGER_INK}`,
      'editorWarning.foreground': `#${WARN_INK}`,
      'editorGutter.background': `#${PAPER_2}`,
      'editorWidget.background': `#${PAPER_2}`,
      'editorWidget.border': `#${INK}`,
      'editorIndentGuide.background1': '#1b17121f',
      'scrollbarSlider.background': '#1b171233',
      'scrollbarSlider.hoverBackground': '#1b171255',
      'minimap.background': `#${PAPER_2}`,
    },
  });
  registered.add(monaco);
}
