// SlopDogs kennel list · script: render. Draws the state: kicker and sort note, pressed chips, error banner, auth,
// skeleton and veil while the first page loads, the rows (a further page only appends, so focus and stagger
// stay), the empty state (SlopdogsKennelsScriptEmpty) and the status line (Load more, loading more, End of side A).
function kennelsRender(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY,
        $ = K.$,
        $$ = K.$$,
        d = K.d;
    function kicker() {
        var yours = K.yoursCount();
        return (
            K.t(COPY.kickerN, { n: S.total, unit: COPY.unit[S.total === 1 ? 0 : 1] }) + (yours ? K.t(COPY.kickerYours, { n: yours }) : '')
        );
    }
    K.render = function (fresh) {
        var list = $('#list'),
            skel = $('#skeleton'),
            status = $('#status'),
            empty = $('#empty'),
            showSkel = S.loading && !S.items.length;
        $('#kicker').textContent = showSkel ? COPY.kicker : kicker();
        $('#aside').textContent = K.t(COPY.sortedBy, { key: CFG.sortLabels[S.sort] });
        $$('[data-sort]').forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.dataset.sort === S.sort));
        });
        $('#dir .dir-word').textContent = S.dir;
        $('#dir').setAttribute('aria-label', COPY.dir[S.dir]);
        $('#sort-select').value = S.sort;
        $('#f-mine').setAttribute('aria-pressed', String(S.mine));
        $('#f-fav').setAttribute('aria-pressed', String(S.fav));
        $('#f-fav .pennant').setAttribute('fill', S.fav ? 'currentColor' : 'none');
        if ($('#q') !== d.activeElement) $('#q').value = S.q;
        $('#error').hidden = !S.error;
        if (S.error) $('#error-text').textContent = S.error;
        K.renderAuth();
        list.setAttribute('aria-busy', String(S.loading));
        skel.hidden = !showSkel;
        if (showSkel && !skel.children.length) {
            for (var i = 0; i < 8; i++) {
                var r = $('template[data-tpl="skeleton"]').content.firstElementChild.cloneNode(true);
                r.querySelector('.a').style.width = 30 + ((i * 17) % 35) + '%';
                skel.appendChild(r);
            }
        }
        if (showSkel) K.startVeil();
        else K.stopVeil();
        if (!S.loading || S.items.length) {
            if (fresh || list.children.length > S.items.length) list.textContent = '';
            for (var j = list.children.length; j < S.items.length; j++) list.appendChild(K.buildRow(S.items[j], j));
        } else list.textContent = '';
        empty.textContent = '';
        if (!S.loading && !S.error && !S.items.length) empty.appendChild(K.emptyState());
        status.textContent = '';
        if (S.error || !S.items.length) return;
        if (S.more) status.textContent = COPY.loadingMore;
        else if (K.hasMore()) status.appendChild(K.button(K.t(COPY.loadMore, { n: S.total - S.items.length }), 'more'));
        else status.textContent = K.t(COPY.end, { n: S.total });
        if (status.firstChild && status.firstChild.className) status.firstChild.className = 'sd-btn sd-btn--sm';
    };
}
return String(kennelsRender);
