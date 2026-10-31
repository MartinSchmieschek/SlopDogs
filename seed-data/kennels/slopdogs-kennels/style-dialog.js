// SlopDogs kennel list · dialog and toast. The confirm/import/key-help dialog, the key list, and the toast that
// sits above the bottom bar on a phone.
return [
    '.dialog{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,calc(100vw - 2 * var(--gutter)));',
    'max-height:calc(100dvh - 2 * var(--gutter));display:flex;flex-direction:column;background:var(--paper-2);',
    'animation:sd-rise var(--dur-base) var(--ease-out) both}',
    '.dialog .body{padding:var(--s4);display:flex;flex-direction:column;gap:var(--s3);overflow-y:auto}',
    '.dialog .foot{display:flex;flex-wrap:wrap;gap:var(--s3);padding:0 var(--s4) var(--s4)}',
    '.dialog .row2{display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center}',
    '.keys{display:grid;grid-template-columns:auto 1fr;gap:var(--s2) var(--s4);margin:0}.keys dt{font-weight:700}',
    '.keys dd{margin:0;color:var(--ink-2)}',
    'kbd{display:inline-block;min-width:24px;padding:0 6px;border:1px solid var(--ink);border-bottom-width:2px;',
    'font:700 12px/20px var(--font-mono);text-align:center}',
    '.toast{position:fixed;left:50%;bottom:var(--s5);z-index:var(--z-toast);transform:translateX(-50%);width:max-content;',
    'max-width:calc(100vw - 32px);pointer-events:none}',
    '.toast p{padding:var(--s2) var(--s4);background:var(--ink);color:var(--paper);border:2px solid var(--paper);',
    'outline:2px solid var(--ink);box-shadow:4px 4px 0 var(--ink);overflow-wrap:anywhere;pointer-events:auto}',
    '@media (max-width:767px){.toast{bottom:calc(var(--bottom-bar-h) + var(--s4) + env(safe-area-inset-bottom))}}',
].join('');
