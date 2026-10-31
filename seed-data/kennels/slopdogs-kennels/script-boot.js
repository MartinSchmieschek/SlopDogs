// SlopDogs kennel list · script: boot. Wires the search (debounced 250 ms; Esc clears, then closes), the phone sort
// select, the document click and key handlers (SlopdogsKennelsScriptEvents) and the paging sentinel (240 px
// ahead); then reads the URL, asks /auth/me, loads the first page and opens the sheet for ?new=1.
function kennelsBoot(K) {
    var S = K.S,
        CFG = K.CFG,
        $ = K.$,
        d = K.d;
    K.boot = function () {
        var debounce = null,
            q = $('#q');
        q.addEventListener('input', function () {
            clearTimeout(debounce);
            debounce = setTimeout(function () {
                S.q = q.value.trim();
                K.reload();
            }, CFG.debounceMs);
        });
        q.addEventListener('keydown', function (ev) {
            if (ev.key !== 'Escape') return;
            ev.preventDefault();
            ev.stopPropagation();
            if (q.value) {
                q.value = '';
                S.q = '';
                K.reload();
            } else {
                K.closeSearch();
                q.blur();
            }
        });
        q.addEventListener('blur', function () {
            if (!q.value) K.closeSearch();
        });
        $('#sort-select').addEventListener('change', function (ev) {
            S.sort = ev.target.value;
            S.dir = K.defaultDir(S.sort);
            K.saveSort();
            K.reload();
        });
        d.addEventListener('click', K.onClick);
        d.addEventListener('keydown', K.onKey);
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(
                function (e) {
                    if (e[0].isIntersecting && K.hasMore() && !S.loading && !S.more && !S.error) K.load(false);
                },
                { rootMargin: '240px' },
            ).observe($('#sentinel'));
        }
        var wantsNew = K.readUrl();
        S.loading = true;
        S.startedAt = Date.now();
        K.render();
        K.API.me()
            .then(
                function (me) {
                    S.user = me && me.authenticated ? me.user : null;
                    S.mode = (me && me.mode) || null;
                },
                function () {
                    S.user = null;
                },
            )
            .then(function () {
                S.ready = true;
                K.load(true);
                if (wantsNew) K.openCreate();
            });
    };
}
return String(kennelsBoot);
