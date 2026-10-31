// SlopDogs kennel list · lead. Builds the document of /kennels: <html lang=en data-stage="‹stage›"> (the server
// fills the stage), the joined styles, the fragments in page order and the joined script. Runs anonymously on the
// server and only puts strings together; everything personal happens in the browser. Throws on a missing part.
var parts = {
    styles: SlopdogsKennelsStyles,
    topBar: SlopdogsKennelsTopBar,
    toolbar: SlopdogsKennelsToolbar,
    states: SlopdogsKennelsStates,
    chrome: SlopdogsKennelsChrome,
    rows: SlopdogsKennelsRowTemplate,
    create: SlopdogsKennelsCreateSheet,
    script: SlopdogsKennelsScript,
};
Object.keys(parts).forEach(function (name) {
    if (typeof parts[name] !== 'string' || !parts[name]) throw new Error('SlopdogsKennelsLead: part ' + name + ' is missing.');
});
return [
    '<!DOCTYPE html>',
    '<html lang="en" data-stage="‹stage›">',
    '<head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
    '<title>Kennels · SlopDogs</title>',
    '<meta name="description" content="Every kennel you can run, as a tracklist.">',
    '<style>' + parts.styles + '</style></head>',
    '<body>',
    parts.topBar,
    '<main class="page" id="main">' + parts.toolbar + parts.states + '</main>',
    parts.chrome + parts.rows + parts.create,
    '<script>' + parts.script + '</' + 'script>',
    '</body></html>',
].join('\n');
