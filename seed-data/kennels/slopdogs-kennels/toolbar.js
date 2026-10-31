// SlopDogs kennel list · toolbar. HTML of the chapter band (kicker, title, sort note) and the tool row: sort chips
// with the phone select and the direction toggle, the filters mine only / favorites and Import (both only signed
// in, data-auth-only). Labels come from SlopdogsKennelsConfig.sortLabels.
var labels = SlopdogsKennelsConfig.sortLabels;
var chips = ['name', 'updatedAt', 'calls30d', 'rating'];
var flag =
    '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 1.5v13" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75"/><path class="pennant" d="M4.25 2.25h8.5l-2 3.25 2 3.25h-8.5z" fill="none" stroke="currentColor" ' +
    'stroke-width="1.75"/></svg>';
var options = chips.map(function (k) {
    return '<option value="' + k + '">' + labels[k] + '</option>';
});
var buttons = chips.map(function (k) {
    return '<button type="button" class="sd-chip sd-chip--outline" data-sort="' + k + '" aria-pressed="false">' + labels[k] + '</button>';
});
return [
    '<div class="chapter"><div><p class="sd-kicker kicker" id="kicker">side A</p><h1>Kennels</h1></div>',
    '<p class="sd-data aside" id="aside"></p></div>',
    '<div class="tools"><div class="chips sortg" role="group" aria-label="Sort">',
    '<span class="sort-pick"><select id="sort-select" class="sd-chip sd-chip--outline" aria-label="Sort by">',
    options.join(''),
    '</select></span>',
    buttons.join(''),
    '<button type="button" class="sd-chip sd-chip--outline" id="dir" aria-label="Ascending. Switch to descending.">⇅ ',
    '<span class="dir-word">asc</span></button></div>',
    '<div class="chips filterg" role="group" aria-label="Filter" data-auth-only hidden>',
    '<button type="button" class="sd-chip sd-chip--outline" id="f-mine" aria-pressed="false">mine only</button>',
    '<button type="button" class="sd-chip sd-chip--outline" id="f-fav" aria-pressed="false">' + flag + 'favorites</button></div>',
    '<button type="button" class="sd-btn sd-btn--sm import" data-act="import" data-auth-only hidden>Import</button>',
    '</div>',
].join('');
