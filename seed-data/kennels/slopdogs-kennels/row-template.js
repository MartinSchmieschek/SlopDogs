// SlopDogs kennel list · row template. The <template> elements the scripts clone: one row (title link stretched
// over the row, chips, meta, plaque, stars, time, favorite flag, more button), the row menu with its three groups
// and the lock hint, and one skeleton row. No data in here; SlopdogsKennelsScriptRow fills it via textContent.
var flag =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3.5 1.5v13" fill="none" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/><path class="pennant" d="M4.25 2.25h8.5l-2 3.25 2 3.25h-8.5z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
return [
    '<template data-tpl="row"><div class="row" role="listitem">',
    '<span class="no" aria-hidden="true" data-s="no"></span>',
    '<div class="main"><span class="line1"><span class="emoji" aria-hidden="true" data-s="emoji"></span>',
    '<a class="name" target="_blank" rel="noopener" data-s="name"></a>',
    '<span data-s="chips" style="display:contents"></span></span>',
    '<span class="meta sd-small" data-s="meta"></span></div>',
    '<span class="data"><span class="plaque" data-s="plaque"></span><span class="stars" data-s="stars"></span>',
    '<time class="when" data-s="when"></time></span>',
    '<span class="act">',
    '<button type="button" class="sd-btn sd-btn--icon sd-btn--bare fav" aria-pressed="false" data-act="fav">' + flag + '</button>',
    '<span class="more"><button type="button" class="sd-btn sd-btn--icon sd-btn--bare dots" aria-haspopup="menu" ',
    'aria-expanded="false" data-act="menu">⋯</button></span>',
    '</span></div></template>',
    '<template data-tpl="menu"><div class="menu sd-lift sd-rise" role="menu">',
    '<a role="menuitem" data-m="open" target="_blank" rel="noopener" tabindex="-1">Open page <span class="k" aria-hidden="true">↗</span></a>',
    '<button type="button" role="menuitem" data-m="share" tabindex="-1">Share link</button>',
    '<a role="menuitem" data-m="docs" target="_blank" rel="noopener" tabindex="-1">Docs <span class="k" aria-hidden="true">↗</span></a>',
    '<div role="separator" data-m="sep-edit"></div>',
    '<a role="menuitem" data-m="edit" tabindex="-1">Edit</a>',
    '<span class="hint sd-small" data-m="lock"></span>',
    '<button type="button" role="menuitem" data-m="export" tabindex="-1">Export</button>',
    '<div role="separator" data-m="sep-del"></div>',
    '<button type="button" role="menuitem" class="danger" data-m="delete" tabindex="-1">Delete</button>',
    '<p class="note sd-small" data-m="runonly"></p>',
    '</div></template>',
    '<template data-tpl="skeleton"><div class="skel-row"><span></span><span><i class="sd-skel a"></i><i class="sd-skel b"></i></span></div></template>',
].join('');
