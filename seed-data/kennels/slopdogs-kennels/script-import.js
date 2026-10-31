// SlopDogs kennel list · script: import. The import dialog (also on a phone): paste the bundle, "Paste from
// clipboard" (asks for permission, says so when refused) or "Choose file" (the exported <ref>.kennel.json), then
// POST /api/kennels/import, a toast and a reload. Errors stay at the field.
function kennelsImport(K) {
    var COPY = K.COPY,
        $ = K.$;
    function fail(ta, hint, text) {
        ta.setAttribute('aria-invalid', 'true');
        hint.textContent = text;
        hint.classList.add('sd-hint--error');
    }
    K.openImport = function () {
        var field = $('template[data-tpl="import-field"]').content.cloneNode(true);
        K.dialog({
            title: COPY.impTitle,
            message: COPY.impMsg,
            ok: COPY.impOk,
            tone: 'primary',
            field: field,
            onOpen: function (box) {
                var ta = $('#imp-text', box),
                    hint = $('#imp-hint', box),
                    file = $('#imp-file', box);
                $('[data-i="paste"]', box).addEventListener('click', function () {
                    var c = navigator.clipboard;
                    if (!c || !c.readText) return fail(ta, hint, COPY.impNoClip);
                    c.readText().then(
                        function (t) {
                            ta.value = t;
                            ta.focus();
                        },
                        function () {
                            fail(ta, hint, COPY.impNoClip);
                        },
                    );
                });
                $('[data-i="file"]', box).addEventListener('click', function () {
                    file.click();
                });
                file.addEventListener('change', function () {
                    var f = file.files && file.files[0];
                    if (f)
                        f.text().then(function (t) {
                            ta.value = t;
                        });
                });
                return ta;
            },
            onOk: function (close, box) {
                var ta = $('#imp-text', box),
                    hint = $('#imp-hint', box),
                    bundle;
                try {
                    bundle = JSON.parse(ta.value);
                } catch {
                    fail(ta, hint, COPY.impBadJson);
                    ta.focus();
                    return;
                }
                K.API.importBundle(bundle).then(
                    function (res) {
                        close();
                        K.toast(K.t(COPY.imported, { id: res.kennelId }));
                        K.load(true);
                    },
                    function (e) {
                        fail(ta, hint, e.error_description || e.error || K.t(COPY.impFail, { s: e.status || 'network' }));
                    },
                );
            },
        });
    };
}
return String(kennelsImport);
