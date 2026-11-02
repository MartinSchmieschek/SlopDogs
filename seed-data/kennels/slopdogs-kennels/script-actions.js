// SlopDogs kennel list · script: row actions. "Opened last" per browser, the favorite flag (anonymous signs in;
// otherwise optimistic, one request per row, a late answer after a reload is dropped, failure turns it back with
// a toast) and Delete behind a danger dialog, then a reload. A seeded kennel shows first which dogs go with it.
function kennelsActions(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY,
        $ = K.$;
    K.byRef = function (ref) {
        for (var i = 0; i < S.items.length; i++) if (K.refOf(S.items[i]) === ref) return S.items[i];
        return null;
    };
    function redraw(ref) {
        var k = ref && K.byRef(ref),
            row = ref && $('.row[data-ref="' + CSS.escape(ref) + '"]');
        if (!k || !row) return;
        var next = K.buildRow(k, S.items.indexOf(k));
        next.style.animation = 'none';
        row.replaceWith(next);
    }
    K.markOpened = function (ref) {
        var old = S.lastOpened;
        S.lastOpened = ref;
        K.store(CFG.lastOpenedStore, ref);
        redraw(old);
        if (old !== ref) redraw(ref);
    };
    K.toggleFav = function (btn, k) {
        if (!S.ready || !k) return;
        var ref = K.refOf(k);
        if (!S.user) {
            K.login(location.pathname + location.search);
            return;
        }
        if (S.busy[ref]) return;
        var on = !k.favorite,
            gen = S.gen;
        k.favorite = on;
        S.busy[ref] = true;
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-busy', 'true');
        btn.title = on ? COPY.favOn : COPY.favOff;
        K.API.favorite(ref, on).then(
            function () {
                delete S.busy[ref];
                if (gen !== S.gen) return;
                btn.removeAttribute('aria-busy');
                if (S.fav && !on) K.load(true);
            },
            function (err) {
                delete S.busy[ref];
                if (gen !== S.gen) return;
                k.favorite = !on;
                btn.setAttribute('aria-pressed', String(!on));
                btn.removeAttribute('aria-busy');
                btn.title = !on ? COPY.favOn : COPY.favOff;
                K.toast(err && err.error === 'no_identity' ? COPY.favNoId : K.t(COPY.favFail, { s: (err && err.status) || 'network' }));
            },
        );
    };
    function summary(r, text) {
        var kept = r.dogsKept || [],
            out = [K.t(text, { n: (r.dogsDeleted || []).length })];
        if (kept.length) {
            var names = kept.map(function (d) {
                return d.displayName + ' (' + d.usedBy.join(', ') + ')';
            });
            out.push(K.t(COPY.delKept, { m: kept.length, names: names.join('; ') }));
        }
        return out.concat(COPY.delReseed).join(' ');
    }
    K.askDelete = function (k) {
        var ref = K.refOf(k);
        if (K.seeded(k) && !k.preview) {
            K.API.deletePreview(ref).then(
                function (r) {
                    K.askDelete(Object.assign({}, k, { preview: r }));
                },
                function (e) {
                    S.error = e.error_description || K.t(COPY.delFail, { s: e.status || 'network' });
                    K.render();
                },
            );
            return;
        }
        K.dialog({
            title: K.t(COPY.delTitle, { name: k.name || ref }),
            message: k.preview ? summary(k.preview, COPY.delGone) : K.t(COPY.delMsg, { ref: ref }),
            ok: COPY.delOk,
            tone: 'danger',
            onOk: function (close) {
                K.API.remove(ref).then(
                    function (r) {
                        close();
                        K.toast(k.preview ? summary(r, COPY.deletedSeeded) : K.t(COPY.deleted, { ref: ref }));
                        K.load(true);
                    },
                    function (e) {
                        close();
                        S.error = e.error_description || K.t(COPY.delFail, { s: e.status || 'network' });
                        K.render();
                    },
                );
            },
        });
    };
}
return String(kennelsActions);
