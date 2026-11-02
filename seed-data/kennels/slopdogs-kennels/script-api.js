// SlopDogs kennel list · script: api. The same-origin fetch wrapper (session cookie, JSON, the error shape
// {status, error, error_description}) and K.API: me, list, favorite, create, remove, export, import. The list
// call retries like the landing while the server wakes: 2/5/10/15 s on 5xx or network errors, up to 150 s.
function kennelsApi(K) {
    var CFG = K.CFG;
    function call(path, opts) {
        var o = opts || {};
        var init = { method: o.method || 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } };
        if (o.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(o.body);
        }
        return fetch(path, init).then(
            function (r) {
                return r
                    .json()
                    .catch(function () {
                        return {};
                    })
                    .then(function (b) {
                        if (!r.ok) throw { status: r.status, error: b.error, error_description: b.error_description, body: b };
                        return b;
                    });
            },
            function () {
                throw { status: 0, error: 'network' };
            },
        );
    }
    function waking(err) {
        return !err || !err.status || err.status >= 500;
    }
    /** Retries while the server wakes; `gen` lets a newer request cancel the waiting one. */
    function withWake(make, isCurrent) {
        var started = Date.now(),
            tries = 0;
        function attempt() {
            return make().catch(function (err) {
                var delay = CFG.wakeDelays[Math.min(tries, CFG.wakeDelays.length - 1)];
                tries += 1;
                if (!waking(err) || Date.now() - started + delay > CFG.wakeGiveUpMs || !isCurrent()) throw err;
                return new Promise(function (resolve) {
                    setTimeout(resolve, delay);
                }).then(function () {
                    if (!isCurrent()) throw { status: 0, error: 'stale' };
                    return attempt();
                });
            });
        }
        return attempt();
    }
    function kennel(ref) {
        return CFG.api + '/' + encodeURIComponent(ref);
    }
    K.API = {
        me: function () {
            return call(CFG.me).catch(function (err) {
                if (err.status === 401) return { authenticated: false };
                throw err;
            });
        },
        list: function (p, isCurrent) {
            var u = new URLSearchParams({ limit: String(p.limit), offset: String(p.offset), sort: p.sort, dir: p.dir });
            if (p.q) u.set('q', p.q);
            if (p.mine) u.set('mine', '1');
            if (p.favorites) u.set('favorites', '1');
            return withWake(function () {
                return call(CFG.api + '?' + u);
            }, isCurrent);
        },
        favorite: function (ref, on) {
            return call(kennel(ref) + '/favorite', { method: on ? 'PUT' : 'DELETE' });
        },
        create: function (body) {
            return call(CFG.api, { method: 'POST', body: body });
        },
        remove: function (ref) {
            return call(kennel(ref), { method: 'DELETE' });
        },
        deletePreview: function (ref) {
            return call(kennel(ref) + '/delete-preview');
        },
        exportBundle: function (ref) {
            return call(kennel(ref) + '/export');
        },
        importBundle: function (bundle) {
            return call(CFG.api + '/import', { method: 'POST', body: bundle });
        },
        logout: function () {
            return call(CFG.logout, { method: 'POST' });
        },
    };
}
return String(kennelsApi);
