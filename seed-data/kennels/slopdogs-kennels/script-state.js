// SlopDogs kennel list · script: state. The page state K.S, DOM helpers, the text filler K.t, localStorage with
// try/catch, and the URL as the state (?q ?sort ?dir ?mine=1 ?favorites=1 ?new=1, written with replaceState).
// Source text only: SlopdogsKennelsScript calls it with the shared namespace K first.
function kennelsState(K) {
    var d = document,
        CFG = K.CFG;
    K.d = d;
    K.$ = function (s, root) {
        return (root || d).querySelector(s);
    };
    K.$$ = function (s, root) {
        return [].slice.call((root || d).querySelectorAll(s));
    };
    K.t = function (text, values) {
        return String(text).replace(/\{(\w+)\}/g, function (m, key) {
            return values && values[key] !== undefined ? String(values[key]) : m;
        });
    };
    K.store = function (key, value) {
        try {
            if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            return null;
        }
        return value;
    };
    K.phone = function () {
        return matchMedia(CFG.phone).matches;
    };
    var S = (K.S = {
        user: null,
        mode: null,
        ready: false,
        q: '',
        sort: 'name',
        dir: 'asc',
        mine: false,
        fav: false,
        items: [],
        total: 0,
        offset: 0,
        loading: false,
        more: false,
        error: null,
        gen: 0,
        busy: {},
        startedAt: 0,
        lastOpened: K.store(CFG.lastOpenedStore),
    });
    var saved = K.store(CFG.sortStore);
    if (saved && CFG.sortKeys.indexOf(saved.sortKey) >= 0) {
        S.sort = saved.sortKey;
        S.dir = saved.sortDir === 'desc' ? 'desc' : 'asc';
    }
    K.saveSort = function () {
        K.store(CFG.sortStore, { sortKey: S.sort, sortDir: S.dir });
    };
    K.defaultDir = function (key) {
        return key === 'name' ? 'asc' : 'desc';
    };
    /** Reads the URL into the state; true when ?new=1 asks for the create sheet. */
    K.readUrl = function () {
        var u = new URLSearchParams(location.search);
        S.q = (u.get('q') || '').trim();
        if (CFG.sortKeys.indexOf(u.get('sort')) >= 0) S.sort = u.get('sort');
        if (u.get('dir') === 'asc' || u.get('dir') === 'desc') S.dir = u.get('dir');
        S.mine = u.get('mine') === '1';
        S.fav = u.get('favorites') === '1';
        return u.get('new') === '1';
    };
    K.writeUrl = function (withNew) {
        var u = new URLSearchParams();
        if (S.q) u.set('q', S.q);
        if (S.sort !== 'name' || S.dir !== 'asc') {
            u.set('sort', S.sort);
            u.set('dir', S.dir);
        }
        if (S.mine) u.set('mine', '1');
        if (S.fav) u.set('favorites', '1');
        if (withNew) u.set('new', '1');
        var qs = u.toString();
        try {
            history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
        } catch {
            /* a sandboxed preview may refuse it; the state still holds */
        }
    };
    K.refOf = function (k) {
        return k.lineageId || k.id;
    };
    K.publicPath = function (k) {
        var dq = k.defaultQuery,
            u = new URLSearchParams();
        if (typeof dq === 'string') {
            try {
                dq = JSON.parse(dq);
            } catch {
                dq = null;
            }
        }
        if (dq && typeof dq === 'object') {
            Object.keys(dq).forEach(function (key) {
                if (key.trim()) u.set(key, dq[key]);
            });
        }
        var qs = u.toString();
        return '/k/' + encodeURIComponent(K.refOf(k)) + (qs ? '?' + qs : '');
    };
    K.absolute = function (path) {
        return location.origin + path;
    };
}
return String(kennelsState);
