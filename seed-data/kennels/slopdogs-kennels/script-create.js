// SlopDogs kennel list · script: create. Opens the New kennel sheet (anonymous signs in first, ?new=1 survives the
// round trip), writes ?new=1 while it is open, POSTs the kennel and goes on to /kennels/<ref>/edit. A taken ID
// (409) is said at the field with the focus back on it; any other error in the sheet banner. Visibility: the three
// radios of COPY.vis, private by default.
function kennelsCreate(K) {
    var S = K.S,
        COPY = K.COPY,
        $ = K.$;
    K.openCreate = function () {
        if (!S.ready) return;
        if (!S.user) {
            K.login('/kennels?new=1');
            return;
        }
        var layer = $('template[data-tpl="create"]').content.firstElementChild.cloneNode(true),
            f = K.createFields(layer),
            submit = layer.querySelector('[data-c="submit"]'),
            err = layer.querySelector('[data-c="error"]'),
            d = K.d;
        COPY.vis.forEach(function (v) {
            var l = d.createElement('label');
            l.className = 'radio';
            l.innerHTML = '<input type="radio" name="nk-vis"><span><span data-l></span> <span class="muted" data-h></span></span>';
            l.querySelector('input').value = v[0];
            l.querySelector('input').checked = v[0] === 'private';
            l.querySelector('[data-l]').textContent = v[1];
            l.querySelector('[data-h]').textContent = '— ' + v[2];
            layer.querySelector('[data-c="vis"]').appendChild(l);
        });
        var close = K.mountLayer(layer, f.id, function () {
            f.setPop(false);
            K.writeUrl(false);
        });
        K.writeUrl(true);
        layer.querySelector('form').addEventListener('submit', function (ev) {
            ev.preventDefault();
            f.touched = true;
            f.check();
            if (submit.disabled) return;
            submit.setAttribute('aria-busy', 'true');
            submit.textContent = COPY.creating;
            var body = {
                id: f.id.value.trim(),
                name: $('#nk-name', layer).value.trim() || undefined,
                description: $('#nk-desc', layer).value.trim() || undefined,
                emoji: f.emoji || undefined,
                visibility: layer.querySelector('input[name="nk-vis"]:checked').value,
                dogIds: [],
            };
            K.API.create(body).then(
                function (res) {
                    var ref = (res.data && res.data.lineageId) || res.id || body.id;
                    close();
                    location.assign('/kennels/' + encodeURIComponent(ref) + '/edit');
                },
                function (e) {
                    submit.removeAttribute('aria-busy');
                    submit.textContent = COPY.create;
                    if (e.status === 409 || e.error === 'id_taken') {
                        err.hidden = true;
                        f.taken((e.error_description || COPY.idTaken) + COPY.idTakenMore);
                        return;
                    }
                    err.hidden = false;
                    err.querySelector('.t').textContent =
                        e.error_description || e.error || K.t(COPY.createFail, { s: e.status || 'network' });
                },
            );
        });
        return { layer: layer, id: f.id, check: f.check };
    };
}
return String(kennelsCreate);
