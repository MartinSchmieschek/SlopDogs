// SlopDogs kennel list · script: version. Asks GET /api/health once and writes the running version into the line
// under the list (#ver): server version, core, short commit. Stays hidden when the request fails — no error text.
function kennelsVersion(K) {
    K.showVersion = function () {
        var el = K.$('#ver');
        if (!el || !window.fetch) return;
        fetch('/api/health', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
            .then(function (r) {
                return r.ok ? r.json() : null;
            })
            .then(
                function (j) {
                    if (!j || !j.version) return;
                    el.textContent = ['v' + j.version, j.core ? 'core ' + j.core : '', j.commit || ''].filter(Boolean).join(' · ');
                    el.hidden = false;
                },
                function () {},
            );
    };
}
return String(kennelsVersion);
