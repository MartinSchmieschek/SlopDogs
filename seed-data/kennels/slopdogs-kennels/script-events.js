// SlopDogs kennel list · script: events. What a click or a key does: sort chips (the same chip turns the direction),
// direction, filters, phone search, row title (marks "opened last"), flag, more, the page actions, the iris and
// the error text (void cinema); Esc closes the top layer, / jumps into the search, ? shows the key help.
function kennelsEvents(K) {
    var S = K.S,
        $ = K.$;
    K.reload = function () {
        K.writeUrl(false);
        K.load(true);
    };
    function sortBy(key, dir) {
        S.sort = key;
        S.dir = dir;
        K.saveSort();
        K.reload();
    }
    K.onClick = function (ev) {
        var t = ev.target,
            row = t.closest('.row'),
            k = row && K.byRef(row.dataset.ref),
            act = t.closest('[data-act]');
        act = act && act.dataset.act;
        if (!K.menuContains(t)) K.closeMenu(false);
        var chip = t.closest('[data-sort]');
        if (chip)
            return sortBy(
                chip.dataset.sort,
                chip.dataset.sort === S.sort ? (S.dir === 'asc' ? 'desc' : 'asc') : K.defaultDir(chip.dataset.sort),
            );
        if (t.closest('#dir')) return sortBy(S.sort, S.dir === 'asc' ? 'desc' : 'asc');
        if (t.closest('#f-mine')) {
            S.mine = !S.mine;
            return K.reload();
        }
        if (t.closest('#f-fav')) {
            S.fav = !S.fav;
            return K.reload();
        }
        if (t.closest('#search-open')) return K.openSearch();
        if (t.closest('#search-close')) {
            $('#q').value = '';
            K.closeSearch();
            if (S.q) {
                S.q = '';
                K.reload();
            }
            return;
        }
        if (row && t.closest('.name')) return K.markOpened(row.dataset.ref);
        if (act === 'fav') return K.toggleFav(t.closest('.fav'), k);
        if (act === 'menu') return K.menuOpenFor(t.closest('.dots')) ? K.closeMenu(true) : K.showMenu(t.closest('.dots'), k);
        if (act === 'new') return K.openCreate();
        if (act === 'import') return K.openImport();
        if (act === 'retry') return K.load(true);
        if (act === 'more') return K.load(false);
        if (act === 'account') return K.accountMenu(t.closest('.trigger'));
        if (act === 'iris') return K.openCinema('loading');
        if (act === 'cinema') return K.openCinema('error');
        if (act === 'copy-cmd') return K.copyText(t.closest('.cmd').querySelector('code').textContent, K.COPY.cmdCopied);
        if (act === 'clear') {
            S.q = '';
            S.mine = false;
            S.fav = false;
            K.reload();
        }
    };
    K.onKey = function (ev) {
        if (ev.key === 'Escape' && K.layers.length) {
            ev.preventDefault();
            K.layers[K.layers.length - 1].close();
            return;
        }
        var cue = ev.target.closest && ev.target.closest('[data-act="cinema"]');
        if (cue && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            return K.openCinema('error');
        }
        if (K.typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey || K.layers.length) return;
        if (ev.key === '/') {
            ev.preventDefault();
            if (K.phone()) K.openSearch();
            else $('#q').focus();
        }
        if (ev.key === '?') {
            ev.preventDefault();
            K.keyHelp();
        }
    };
}
return String(kennelsEvents);
