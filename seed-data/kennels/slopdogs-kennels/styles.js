// SlopDogs kennel list · styles. Joins the style dogs into the one <style> text of the page, tokens first, phone
// rules after the rules they bend. Throws when a part is missing, so a broken part never ships a half page.
var parts = [
    ['SlopdogsKennelsTokens', SlopdogsKennelsTokens],
    ['SlopdogsKennelsStyleBase', SlopdogsKennelsStyleBase],
    ['SlopdogsKennelsStyleControls', SlopdogsKennelsStyleControls],
    ['SlopdogsKennelsStyleShell', SlopdogsKennelsStyleShell],
    ['SlopdogsKennelsStyleRow', SlopdogsKennelsStyleRow],
    ['SlopdogsKennelsStyleMenu', SlopdogsKennelsStyleMenu],
    ['SlopdogsKennelsStyleSheet', SlopdogsKennelsStyleSheet],
    ['SlopdogsKennelsStyleDialog', SlopdogsKennelsStyleDialog],
    ['SlopdogsKennelsStyleVeil', SlopdogsKennelsStyleVeil],
    ['SlopdogsKennelsStyleShellPhone', SlopdogsKennelsStyleShellPhone],
    ['SlopdogsKennelsStyleRowPhone', SlopdogsKennelsStyleRowPhone],
];
return parts
    .map(function (p) {
        if (typeof p[1] !== 'string' || !p[1]) throw new Error('SlopdogsKennelsStyles: ' + p[0] + ' delivered no CSS.');
        if (p[1].indexOf('</') >= 0) throw new Error('SlopdogsKennelsStyles: ' + p[0] + ' must not close a tag.');
        return '/* ' + p[0] + ' */' + p[1];
    })
    .join('\n');
