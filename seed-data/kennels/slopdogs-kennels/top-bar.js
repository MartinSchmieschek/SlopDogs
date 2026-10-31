// SlopDogs kennel list · top bar. HTML of the bar: SD emblem and word mark, the sides (A kennels, B dogs), the
// search (field on a desktop, a lens that opens it on a phone), + New and the auth slot #who that
// SlopdogsKennelsScriptAuth fills. Static markup only; texts are English.
var lens =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.75" fill="none" ' +
    'stroke="currentColor" stroke-width="1.5"/><path d="M10 10l4.5 4.5" stroke="currentColor" stroke-width="1.5"/></svg>';
return [
    '<header class="bar" id="bar">',
    '<a class="mark" href="/kennels" aria-label="SlopDogs, kennels">',
    '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><circle cx="14" cy="14" r="14" fill="var(--ink)"/>',
    '<text x="14" y="19.5" text-anchor="middle" font-family="Pirata One, serif" font-size="16" fill="var(--paper)">SD</text></svg>',
    '<span class="word">SlopDogs</span></a>',
    '<nav class="sides" aria-label="Sides">',
    '<a class="sd-chip sd-chip--soft" href="/kennels" aria-current="page">side A · kennels</a>',
    '<a class="sd-chip sd-chip--soft" href="/dogs">side B · dogs</a></nav>',
    '<div class="mid"><div class="search" role="search"><label class="sr" for="q">Search kennels</label>',
    lens.replace('<svg', '<svg class="lens"'),
    '<input id="q" class="sd-field" type="search" placeholder="Search kennels" autocomplete="off" spellcheck="false" aria-keyshortcuts="/">',
    '</div>',
    '<button type="button" class="sd-btn sd-btn--icon sd-btn--bare search-open" id="search-open" aria-label="Search kennels">',
    lens,
    '</button>',
    '<button type="button" class="sd-btn sd-btn--icon sd-btn--bare search-close" id="search-close" aria-label="Close search">×</button>',
    '</div>',
    '<div class="end"><button type="button" class="sd-btn sd-btn--primary new-top" data-act="new">+ New</button>',
    '<div class="who" id="who"></div></div>',
    '</header>',
].join('');
