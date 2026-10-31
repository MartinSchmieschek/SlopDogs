// SlopDogs kennel list · script. Joins the script dogs into one IIFE: the data (copy, config, verses) as JSON in a
// shared namespace K, each part called with K in order, then K.boot(). One scope, no globals. Throws when a part
// is missing or not a function source.
var parts = [
    ['SlopdogsKennelsScriptState', SlopdogsKennelsScriptState],
    ['SlopdogsKennelsScriptApi', SlopdogsKennelsScriptApi],
    ['SlopdogsKennelsScriptUi', SlopdogsKennelsScriptUi],
    ['SlopdogsKennelsScriptAuth', SlopdogsKennelsScriptAuth],
    ['SlopdogsKennelsScriptList', SlopdogsKennelsScriptList],
    ['SlopdogsKennelsScriptFormat', SlopdogsKennelsScriptFormat],
    ['SlopdogsKennelsScriptRights', SlopdogsKennelsScriptRights],
    ['SlopdogsKennelsScriptRow', SlopdogsKennelsScriptRow],
    ['SlopdogsKennelsScriptMenu', SlopdogsKennelsScriptMenu],
    ['SlopdogsKennelsScriptRowMenu', SlopdogsKennelsScriptRowMenu],
    ['SlopdogsKennelsScriptActions', SlopdogsKennelsScriptActions],
    ['SlopdogsKennelsScriptClipboard', SlopdogsKennelsScriptClipboard],
    ['SlopdogsKennelsScriptImport', SlopdogsKennelsScriptImport],
    ['SlopdogsKennelsScriptCreateFields', SlopdogsKennelsScriptCreateFields],
    ['SlopdogsKennelsScriptCreate', SlopdogsKennelsScriptCreate],
    ['SlopdogsKennelsScriptVeil', SlopdogsKennelsScriptVeil],
    ['SlopdogsKennelsScriptCinema', SlopdogsKennelsScriptCinema],
    ['SlopdogsKennelsScriptEmpty', SlopdogsKennelsScriptEmpty],
    ['SlopdogsKennelsScriptRender', SlopdogsKennelsScriptRender],
    ['SlopdogsKennelsScriptEvents', SlopdogsKennelsScriptEvents],
    ['SlopdogsKennelsScriptBoot', SlopdogsKennelsScriptBoot],
];
var data = JSON.stringify({ COPY: SlopdogsKennelsCopy, CFG: SlopdogsKennelsConfig, VERSES: SlopdogsKennelsVerses }).replace(
    /</g,
    '\\u003c',
);
var calls = parts.map(function (p) {
    if (typeof p[1] !== 'string' || p[1].indexOf('function') !== 0)
        throw new Error('SlopdogsKennelsScript: ' + p[0] + ' delivered no function source.');
    if (/<\/script/i.test(p[1])) throw new Error('SlopdogsKennelsScript: ' + p[0] + ' must not close the script tag.');
    return '(' + p[1] + ')(K);';
});
return '(function () {\n"use strict";\nvar K = ' + data + ';\n' + calls.join('\n') + '\nK.boot();\n})();';
