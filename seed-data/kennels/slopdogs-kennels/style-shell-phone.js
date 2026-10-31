// SlopDogs kennel list · shell on a phone (below 768 px). The search folds into a lens, + New becomes the FAB,
// the chapter band stops being sticky, the bottom bar (Kennels · Dogs) appears and the sort chips become one
// select (Follie spec, decisions 5 and 9).
return [
    '@media (max-width:767px){',
    '.sides,.bar .mid .search,.new-top,.who .uname,.who .caret{display:none}.bar{gap:var(--s2)}',
    '.bar .mid{justify-content:flex-end}.search-open{display:inline-flex}',
    '.bar.searching .mark,.bar.searching .end,.bar.searching .search-open{display:none}',
    '.bar.searching .mid .search{display:block;max-width:none}.bar.searching .search-close{display:inline-flex}',
    '.who .trigger{padding:0;width:var(--touch)}.chapter{position:static;padding:var(--s2) var(--s3)}',
    '.chapter h1{font-size:28px;line-height:26px}.page{padding-bottom:calc(var(--s8) + var(--bottom-bar-h))}',
    '.bottom{display:grid;grid-template-columns:1fr 1fr;position:fixed;left:0;right:0;bottom:0;z-index:var(--z-sticky);',
    'height:calc(var(--bottom-bar-h) + env(safe-area-inset-bottom));padding:0 var(--s3) env(safe-area-inset-bottom);',
    'background:var(--paper);border-top:2px solid var(--ink)}',
    '.bottom a{display:grid;place-items:center;min-height:44px;color:var(--ink);text-decoration:none;',
    'font:700 11px/14px var(--font-mono);letter-spacing:.16em;text-transform:uppercase}',
    ".bottom a[aria-current='page']{box-shadow:inset 0 -3px 0 var(--ink)}",
    '.fab{display:inline-flex;position:fixed;right:var(--s4);bottom:calc(var(--bottom-bar-h) + var(--s4) + env(safe-area-inset-bottom));',
    'z-index:var(--z-sticky);width:56px;height:56px;font-size:24px;box-shadow:4px 4px 0 var(--ink)}',
    '.sortg [data-sort]{display:none}.sort-pick{display:inline-flex}.dir-word{display:none}',
    '.filterg{order:2;flex-basis:100%;padding-left:0;border-left:0}.tools .import{order:1}',
    '}',
    '@media (max-width:639px){.chapter .aside{display:none}}',
].join('');
