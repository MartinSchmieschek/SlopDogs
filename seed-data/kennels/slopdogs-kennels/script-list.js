// SlopDogs kennel list · script: list. Paging against GET /api/kennels (20 a page): a replacing load starts a new
// generation (the last request wins), a further page appends; duplicates drop out, an empty further page ends the
// list, an answer without `total` is the whole list. Counts for the kicker ("M yours" once everything is loaded).
function kennelsList(K) {
    var S = K.S,
        CFG = K.CFG,
        COPY = K.COPY;
    K.hasMore = function () {
        return S.offset < S.total;
    };
    K.yoursCount = function () {
        if (!S.user || K.hasMore()) return 0;
        return S.items.filter(function (k) {
            return k.myRights && k.myRights.own;
        }).length;
    };
    K.load = function (replace) {
        var gen = replace ? ++S.gen : S.gen;
        if (replace) {
            S.offset = 0;
            S.error = null;
            S.loading = true;
            S.startedAt = Date.now();
        } else S.more = true;
        K.render();
        var p = {
            limit: CFG.pageSize,
            offset: replace ? 0 : S.offset,
            q: S.q,
            sort: S.sort,
            dir: S.dir,
            mine: S.mine && !!S.user,
            favorites: S.fav && !!S.user,
        };
        function current() {
            return gen === S.gen;
        }
        return K.API.list(p, current).then(
            function (res) {
                if (!current()) return;
                var page = Array.isArray(res.data) ? res.data : [],
                    seen = {},
                    kept = (replace ? [] : S.items).filter(function (k) {
                        seen[k.id] = true;
                        return true;
                    });
                S.items = kept.concat(
                    page.filter(function (k) {
                        if (seen[k.id]) return false;
                        seen[k.id] = true;
                        return true;
                    }),
                );
                S.total = typeof res.total === 'number' ? res.total : S.items.length;
                S.offset = p.offset + page.length;
                if (!page.length) S.total = S.items.length;
                S.loading = false;
                S.more = false;
                if (replace) window.scrollTo(0, 0);
                K.render(replace);
            },
            function (err) {
                if (!current()) return;
                S.loading = false;
                S.more = false;
                S.error = K.t(COPY.error, { s: (err && err.status) || 'network' });
                K.render();
            },
        );
    };
}
return String(kennelsList);
