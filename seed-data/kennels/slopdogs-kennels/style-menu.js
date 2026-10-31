// SlopDogs kennel list · menus. The row menu and the account menu (role=menu, three groups, a visible lock hint
// under a disabled Edit, flips up above the bottom bar), and the layer root with its scrim.
return [
    '.menu{position:absolute;top:calc(100% + 4px);right:0;z-index:30;display:flex;flex-direction:column;width:max-content;',
    'min-width:200px;max-width:min(280px,calc(100vw - 2 * var(--gutter)));padding:var(--s1) 0;background:var(--paper-2)}',
    '.menu.up{top:auto;bottom:calc(100% + 4px)}',
    ".menu [role='menuitem']{display:flex;align-items:center;justify-content:space-between;gap:var(--s4);",
    'min-height:max(40px,var(--touch));padding:0 var(--s3);border:0;background:none;color:var(--ink);text-align:left;',
    'text-decoration:none;font:14px/21px var(--font-mono);cursor:pointer}',
    ".menu [role='menuitem']:hover:not([aria-disabled='true']),.menu [role='menuitem']:focus-visible{background:var(--paper-3)}",
    ".menu [role='menuitem']:focus-visible{outline-offset:-3px;box-shadow:none}",
    ".menu [role='menuitem'][aria-disabled='true']{color:var(--ink-3);cursor:not-allowed}",
    '.menu .k{color:var(--ink-3);font-size:12px}.menu .danger{color:var(--danger-ink)}',
    '.menu .hint{padding:0 var(--s3) var(--s2);margin-top:-6px;color:var(--ink-2);max-width:32ch}',
    '.menu .note{padding:var(--s2) var(--s3);color:var(--ink-2);max-width:32ch;overflow-wrap:anywhere}',
    ".menu [role='separator']{height:1px;margin:var(--s1) 0;background:var(--line)}",
    '.layer{position:fixed;inset:0;z-index:var(--z-drawer)}',
    '.layer .scrim{position:absolute;inset:0;background:var(--scrim);animation:sd-fade var(--dur-base) var(--ease-out) both}',
    '@keyframes sd-fade{from{opacity:0}}',
].join('');
