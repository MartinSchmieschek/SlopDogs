// SlopDogs kennel list · script: share and export. Share uses the share sheet on touch, else the clipboard, else a
// toast with the URL. Export copies the bundle as JSON, else downloads <ref>.kennel.json, which the import
// dialog (SlopdogsKennelsScriptImport) takes back as a file.
function kennelsClipboard(K) {
    var COPY = K.COPY,
        d = K.d;
    /** writeText, but one that never stays silent: no answer within 1.5 s counts as refused. */
    function write(text) {
        var c = navigator.clipboard;
        if (!c || !c.writeText) return Promise.reject(new Error('no clipboard'));
        return Promise.race([
            c.writeText(text),
            new Promise(function (resolve, reject) {
                setTimeout(reject, 1500);
            }),
        ]);
    }
    K.copyText = function (text, done) {
        write(text).then(
            function () {
                K.toast(done);
            },
            function () {
                K.toast(text);
            },
        );
    };
    K.share = function (k) {
        var url = K.absolute(K.publicPath(k));
        if (navigator.share && matchMedia('(pointer:coarse)').matches) {
            navigator.share({ title: k.name || K.refOf(k), url: url }).catch(function (e) {
                if (!e || e.name !== 'AbortError') K.copyText(url, COPY.linkCopied);
            });
            return;
        }
        K.copyText(url, COPY.linkCopied);
    };
    function download(json, ref) {
        var u = URL.createObjectURL(new Blob([json], { type: 'application/json' })),
            a = d.createElement('a');
        a.href = u;
        a.download = ref + '.kennel.json';
        d.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () {
            URL.revokeObjectURL(u);
        }, 0);
        K.toast(COPY.downloaded);
    }
    K.exportBundle = function (ref) {
        K.API.exportBundle(ref).then(
            function (bundle) {
                var json = JSON.stringify(bundle, null, 2);
                write(json).then(
                    function () {
                        K.toast(COPY.exported);
                    },
                    function () {
                        download(json, ref);
                    },
                );
            },
            function (e) {
                K.toast(K.t(COPY.exportFail, { s: e.status || 'network' }));
            },
        );
    };
}
return String(kennelsClipboard);
