// SlopDogs kennel list · tokens. The design tokens of ui-app/src/styles.scss (light and the tape shell under
// [data-theme='dark']), the measured contrast fixes (yours chip, chapter band, veil, focus ring) and the fonts
// from /static/landing/. Pure CSS text; SlopdogsKennelsStyles puts it first.
return [
    '@font-face{font-family:"Bebas Neue";src:url(/static/landing/bebas-neue.woff2) format("woff2");font-display:swap}',
    '@font-face{font-family:"Courier Prime";src:url(/static/landing/courier-prime-400.woff2) format("woff2");font-weight:400;font-display:swap}',
    '@font-face{font-family:"Courier Prime";src:url(/static/landing/courier-prime-700.woff2) format("woff2");font-weight:700;font-display:swap}',
    '@font-face{font-family:"Pirata One";src:url(/static/landing/pirata-one-sd.woff2) format("woff2");font-display:swap}',
    ':root{--paper:#f0e6c8;--paper-2:#f7f0da;--paper-3:#e6dbb8;--ink:#1b1712;--ink-2:#5a5142;--ink-3:#9c917a;--ink-soft:#bfb595;',
    '--line:rgba(27,23,18,.18);--line-strong:rgba(27,23,18,.40);--accent:#ff6a00;--accent-ink:#1b1712;--accent-soft:rgba(255,106,0,.16);',
    '--live:#117f7f;--live-ink:#0d6666;--live-soft:rgba(17,127,127,.12);--warn-ink:#8a5a00;--danger-ink:#b3261e;--danger-soft:rgba(179,38,30,.12);',
    '--focus:var(--accent);--scrim:rgba(27,23,18,.35);',
    /* Contrast fixes (Follie spec 2.2): yours chip 5.93:1, band kicker in the dark 6.27:1, a veil per theme. */
    '--chip-live-bg:var(--live-ink);--chip-live-fg:var(--paper-2);--band-bg:var(--ink);--band-fg:var(--paper);--band-muted:var(--ink-soft);',
    '--veil:rgba(240,230,200,.92);',
    '--font-display:"Bebas Neue",Impact,"Arial Narrow",sans-serif;--font-mono:"Courier Prime",ui-monospace,"Courier New",monospace;',
    '--font-emblem:"Pirata One",serif;',
    '--s1:4px;--s2:8px;--s3:12px;--s4:16px;--s5:24px;--s6:32px;--s7:48px;--s8:64px;',
    '--gutter:clamp(16px,4vw,40px);--max-list:1120px;--touch:44px;--top-bar-h:52px;--bottom-bar-h:60px;',
    '--ease-out:cubic-bezier(.16,1,.3,1);--dur-fast:120ms;--dur-base:200ms;--dur-slow:320ms;',
    '--z-sticky:20;--z-drawer:80;--z-dialog:100;--z-toast:200;--z-cinema:300;color-scheme:light}',
    '@media (min-width:768px){:root{--touch:36px;--top-bar-h:56px}}',
    "[data-theme='dark']{--paper:#2a241c;--paper-2:#332c22;--paper-3:#3d352a;--ink:#f0e6c8;--ink-2:#bfb595;--ink-3:#7d735f;",
    '--line:rgba(240,230,200,.16);--line-strong:rgba(240,230,200,.36);--accent-soft:rgba(255,106,0,.22);--live-ink:#4fc1b8;',
    '--warn-ink:#e0a53a;--danger-ink:#ff7a70;--chip-live-fg:var(--paper);--band-muted:#5a5142;--veil:rgba(42,36,28,.92);',
    '--scrim:rgba(0,0,0,.5);color-scheme:dark}',
].join('');
